import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaColumns, FaSearch, FaWhatsapp, FaCheck, FaArrowRight, FaMoneyBillWave, FaClock, FaSyncAlt } from "react-icons/fa";
import type { EstadoOrden, Orden } from "@lavanderia/shared/types/types";
import { calcularResumenPago } from "@lavanderia/shared/utils/pagoFinance";
import { ordenesService } from "../services/ordenesService";
import { useConfiguracion, useEtiquetas } from "../context/configuracionCore";
import { formatearMoneda, normalizarMoneda } from "../utils/monedaHelpers";
import { nombreCliente } from "../utils/clienteHelpers";
import { generarEnlaceWhatsApp } from "../utils/whatsappHelpers";
import { useAtajos } from "../atajos/atajosCore";
import Kbd from "../atajos/Kbd";
import ModalDetalleOrden from "../components/modal/ModalDetalleOrden";
import ModalPago from "../components/modal/ModalPago";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import { TableSkeleton } from "../components/Skeleton";

type Columna = "PENDIENTE" | "LISTO" | "ENTREGADO";

const COLUMNAS: { id: Columna; titulo: string; ayuda: string; barra: string; chip: string }[] = [
  { id: "PENDIENTE", titulo: "Por hacer", ayuda: "Recibido, en proceso", barra: "bg-amber-500", chip: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300" },
  { id: "LISTO", titulo: "Listo para entregar", ayuda: "Avísale al cliente", barra: "bg-emerald-500", chip: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300" },
  { id: "ENTREGADO", titulo: "Entregado hoy", ayuda: "Ya salió", barra: "bg-slate-400", chip: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
];

function etiquetaEntrega(o: Orden): { texto: string; clase: string } | null {
  if (!o.fechaEntrega || o.estado === "ENTREGADO") return null;
  const f = dayjs(o.fechaEntrega).startOf("day");
  const hoy = dayjs().startOf("day");
  const dif = f.diff(hoy, "day");
  if (dif < 0) return { texto: `Vencida hace ${-dif} d`, clase: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" };
  if (dif === 0) return { texto: "Hoy", clase: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300" };
  if (dif === 1) return { texto: "Mañana", clase: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" };
  return { texto: f.locale("es").format("DD MMM"), clase: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" };
}

const resumenArticulos = (o: Orden) => {
  const d = o.detalles ?? [];
  const partes = d.slice(0, 2).map((x) => `${x.cantidad} ${x.servicio?.nombreServicio ?? ""}`.trim());
  return partes.join(", ") + (d.length > 2 ? ` y ${d.length - 2} más` : "");
};

/**
 * Tablero de la lavandería: qué está por hacer, qué está listo para entregar y
 * lo que salió hoy. Se mueve con botones o arrastrando; "Entrega rápida" busca
 * por número de orden para despachar sin navegar.
 */
export default function PantallaTablero() {
  const { config } = useConfiguracion();
  const et = useEtiquetas();
  const moneda = normalizarMoneda(config?.monedaPrincipal ?? "USD");
  const tasas = useMemo(() => ({ VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null }), [config]);

  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [entregaRapida, setEntregaRapida] = useState("");
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [detalle, setDetalle] = useState<Orden | null>(null);
  const [aCobrar, setACobrar] = useState<Orden | null>(null);
  const [confirmarEntrega, setConfirmarEntrega] = useState<Orden | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [destino, setDestino] = useState<Columna | null>(null);
  const inputRapido = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await ordenesService.tablero();
      setOrdenes(res.data);
    } catch {
      toast.error("No se pudo cargar el tablero.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    // Se refresca solo: en el mostrador suele haber más de una persona trabajando.
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [cargar]);

  const saldoDe = useCallback((o: Orden) => calcularResumenPago(o, tasas, moneda).faltante, [tasas, moneda]);

  const reemplazar = (o: Orden) => setOrdenes((prev) => prev.map((x) => (x.id === o.id ? { ...x, ...o, cliente: o.cliente ?? x.cliente, detalles: o.detalles ?? x.detalles } : x)));

  const mover = async (o: Orden, estado: EstadoOrden) => {
    try {
      const res = await ordenesService.update(o.id, { estado });
      reemplazar(res.data);
      toast.success(estado === "LISTO" ? `${et.orden} #${o.id} lista para entregar.` : estado === "ENTREGADO" ? `${et.orden} #${o.id} entregada.` : `${et.orden} #${o.id} de vuelta a "Por hacer".`);
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo actualizar." : "No se pudo actualizar.");
    }
  };

  /** Entregar con saldo pendiente pide confirmación (o cobrar antes). */
  const entregar = (o: Orden) => {
    if (o.estado === "ENTREGADO") return toast.info(`${et.orden} #${o.id} ya fue entregada.`);
    if (saldoDe(o) > 0.005) return setConfirmarEntrega(o);
    mover(o, "ENTREGADO");
  };

  const avisar = (o: Orden) => {
    const link = generarEnlaceWhatsApp(o, config?.nombreNegocio ?? "nuestro negocio", tasas);
    if (!link) return toast.warning(`Este ${et.clienteMin} no tiene un teléfono válido.`);
    window.open(link, "_blank");
  };

  const rapida = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(entregaRapida.replace(/\D/g, ""), 10);
    if (!n) return;
    const o = ordenes.find((x) => x.id === n);
    if (!o) return toast.error(`No hay una ${et.ordenMin} #${n} pendiente de entrega.`);
    setEntregaRapida("");
    entregar(o);
  };

  useAtajos([{ combo: "F2", descripcion: "Entrega rápida por número", grupo: "Tablero", accion: () => inputRapido.current?.focus() }]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ordenes.filter((o) => {
      if (soloVencidas && !(etiquetaEntrega(o)?.texto ?? "").startsWith("Vencida")) return false;
      if (!q) return true;
      return String(o.id) === q.replace("#", "") || nombreCliente(o.cliente).toLowerCase().includes(q) || resumenArticulos(o).toLowerCase().includes(q);
    });
  }, [ordenes, busqueda, soloVencidas]);

  const soltar = (col: Columna) => {
    const o = ordenes.find((x) => x.id === arrastrando);
    setArrastrando(null);
    setDestino(null);
    if (!o || o.estado === col || o.estado === "ENTREGADO") return;
    if (col === "ENTREGADO") entregar(o);
    else mover(o, col);
  };

  if (cargando) {
    return (
      <div className="p-6">
        <TableSkeleton rows={6} cols={3} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FaColumns className="text-blue-600" /> Tablero
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Arrastra las tarjetas o usa los botones para avanzar cada {et.ordenMin}.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={rapida} className="flex items-center gap-2">
            <input
              ref={inputRapido}
              value={entregaRapida}
              onChange={(e) => setEntregaRapida(e.target.value)}
              placeholder={`N° de ${et.ordenMin} para entregar`}
              inputMode="numeric"
              className="w-52 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
              aria-label="Entrega rápida por número"
            />
            <Kbd combo="F2" className="text-gray-400" />
          </form>
          <div className="relative">
            <FaSearch className="absolute top-2.5 left-3 text-gray-400" size={12} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={`Buscar ${et.clienteMin} o prenda`}
              className="pl-8 pr-3 py-2 w-56 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={soloVencidas} onChange={(e) => setSoloVencidas(e.target.checked)} className="accent-red-600 w-4 h-4" />
            Solo vencidas
          </label>
          <button type="button" onClick={cargar} title="Actualizar" className="p-2 text-gray-400 hover:text-blue-600 cursor-pointer">
            <FaSyncAlt />
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        {COLUMNAS.map((col) => {
          const lista = visibles.filter((o) => o.estado === col.id);
          const saldo = lista.reduce((s, o) => s + saldoDe(o), 0);
          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDestino(col.id);
              }}
              onDragLeave={() => setDestino((d) => (d === col.id ? null : d))}
              onDrop={() => soltar(col.id)}
              className={`rounded-xl border bg-gray-100/60 dark:bg-gray-900/60 transition-colors ${
                destino === col.id ? "border-blue-400 bg-blue-50/60 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.barra}`} />
                    {col.titulo}
                  </h2>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.chip}`}>{lista.length}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {col.ayuda}
                  {saldo > 0.005 && <span className="ml-2 text-red-500">· por cobrar {formatearMoneda(saldo, moneda)}</span>}
                </p>
              </div>

              <div className="p-3 pt-1 space-y-3 min-h-40 max-h-[calc(100vh-18rem)] overflow-y-auto">
                {lista.length === 0 && <p className="text-center text-sm text-gray-400 dark:text-gray-600 py-8">Nada por aquí.</p>}
                {lista.map((o) => {
                  const saldoO = saldoDe(o);
                  const entrega = etiquetaEntrega(o);
                  return (
                    <article
                      key={o.id}
                      draggable={o.estado !== "ENTREGADO"}
                      onDragStart={() => setArrastrando(o.id)}
                      onDragEnd={() => {
                        setArrastrando(null);
                        setDestino(null);
                      }}
                      className={`rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-3 space-y-2 ${
                        o.estado !== "ENTREGADO" ? "cursor-grab active:cursor-grabbing" : ""
                      } ${arrastrando === o.id ? "opacity-40" : ""}`}
                    >
                      <button type="button" onClick={() => setDetalle(o)} className="w-full text-left cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-blue-700 dark:text-blue-400">#{o.id}</span>
                          {entrega && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${entrega.clase}`}><FaClock size={9} />{entrega.texto}</span>}
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{nombreCliente(o.cliente)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{resumenArticulos(o) || "Sin detalle"}</p>
                      </button>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{formatearMoneda(o.total, moneda)}</span>
                        {saldoO > 0.005 ? (
                          <span className="font-semibold text-red-600 dark:text-red-400">Debe {formatearMoneda(saldoO, moneda)}</span>
                        ) : (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><FaCheck size={9} /> Pagada</span>
                        )}
                      </div>

                      {o.estado !== "ENTREGADO" && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {o.estado === "PENDIENTE" && (
                            <button type="button" onClick={() => mover(o, "LISTO")} className="flex-1 px-2 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer">
                              Listo <FaArrowRight size={10} />
                            </button>
                          )}
                          {o.estado === "LISTO" && (
                            <>
                              <button type="button" onClick={() => entregar(o)} className="flex-1 px-2 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
                                Entregar
                              </button>
                              {o.cliente?.telefono && (
                                <button type="button" onClick={() => avisar(o)} title="Avisar por WhatsApp" className="px-2.5 py-1.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-pointer">
                                  <FaWhatsapp />
                                </button>
                              )}
                            </>
                          )}
                          {saldoO > 0.005 && (
                            <button type="button" onClick={() => setACobrar(o)} title="Registrar pago" className="px-2.5 py-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 cursor-pointer">
                              <FaMoneyBillWave />
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {detalle && (
        <ModalDetalleOrden
          orden={detalle}
          tasas={tasas}
          monedaPrincipal={moneda}
          onClose={() => setDetalle(null)}
          onPagoRegistrado={(o) => {
            reemplazar(o);
            setDetalle(o);
          }}
          onAbrirPagoExtra={(o) => {
            setDetalle(null);
            setACobrar(o);
          }}
        />
      )}

      {aCobrar && (
        <ModalPago
          orden={aCobrar}
          tasas={tasas}
          monedaPrincipal={moneda}
          onClose={() => setACobrar(null)}
          onPagoRegistrado={(o) => {
            reemplazar(o);
            setACobrar(null);
          }}
        />
      )}

      {confirmarEntrega && (
        <ConfirmacionModal
          titulo={`Entregar ${et.ordenMin} #${confirmarEntrega.id}`}
          textoConfirmar="Entregar de todos modos"
          mensaje={`Tiene un saldo de ${formatearMoneda(saldoDe(confirmarEntrega), moneda)}. ¿Entregar sin cobrar el resto? (Puedes cancelar y cobrarla primero.)`}
          onConfirm={() => {
            const o = confirmarEntrega;
            setConfirmarEntrega(null);
            mover(o, "ENTREGADO");
          }}
          onCancel={() => setConfirmarEntrega(null)}
        />
      )}
    </div>
  );
}
