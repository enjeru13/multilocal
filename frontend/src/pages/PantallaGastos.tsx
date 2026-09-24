import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaMoneyCheckAlt, FaPlus, FaTrashAlt } from "react-icons/fa";
import type { GastosListado, MetodoPago, Moneda } from "@lavanderia/shared/types/types";
import { gastosService } from "../services/gastosService";
import { formatearMoneda, montoAEntrada, parsearMonto } from "../utils/monedaHelpers";
import { rangoDePreset, rangoValido, type PresetPeriodo } from "../utils/rangosFecha";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/configuracionCore";
import SelectorPeriodo from "../components/SelectorPeriodo";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import Modal from "../components/ui/Modal";
import CampoMonto from "../components/ui/CampoMonto";
import { Campo, ModalEncabezado, ModalPie, Opcion, campo } from "../components/ui/Formulario";
import Button from "../components/ui/Button";

const METODOS: Record<MetodoPago, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", PAGO_MOVIL: "Pago móvil" };
const tarjeta = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";

function ModalGasto({ categorias, onClose, onGuardado }: { categorias: string[]; onClose: () => void; onGuardado: () => void }) {
  const { config } = useConfiguracion();
  const principal = (config?.monedaPrincipal ?? "USD") as Moneda;
  const monedas = (["USD", "VES", "COP"] as Moneda[]).filter(
    (m) => m === principal || (m === "VES" && config?.tasaVES) || (m === "COP" && config?.tasaCOP)
  );

  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>(principal);
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [fecha, setFecha] = useState(dayjs().format("YYYY-MM-DD"));
  const [nota, setNota] = useState("");
  const [desdeCaja, setDesdeCaja] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Al cambiar de moneda se reescribe el mismo número con el formato de la nueva.
  const cambiarMoneda = (nueva: Moneda) => {
    if (monto) setMonto(montoAEntrada(parsearMonto(monto, moneda), nueva));
    setMoneda(nueva);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parsearMonto(monto, moneda);
    if (!concepto.trim()) return toast.error("Indica en qué se gastó.");
    if (!categoria.trim()) return toast.error("Elige o escribe una categoría.");
    if (isNaN(n) || n <= 0) return toast.error("El monto debe ser mayor a 0.");
    setGuardando(true);
    try {
      await gastosService.crear({
        concepto: concepto.trim(),
        categoria: categoria.trim(),
        monto: n,
        moneda,
        metodoPago: metodo,
        // Mediodía local para que la fecha no cambie de día por zona horaria.
        fecha: dayjs(`${fecha}T12:00:00`).toISOString(),
        nota: nota.trim() || null,
        desdeCaja: config?.moduloCaja && metodo === "EFECTIVO" ? desdeCaja : false,
      });
      toast.success("Gasto registrado.");
      onGuardado();
      onClose();
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo registrar el gasto." : "No se pudo registrar el gasto.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="max-h-[92vh] flex flex-col overflow-hidden">
      <ModalEncabezado icono={<FaMoneyCheckAlt />} titulo="Nuevo gasto" subtitulo="Lo que sale del negocio: servicios, alquiler, sueldos…" onClose={onClose} />
      <form id="gasto-form" onSubmit={guardar} className="px-6 py-5 flex-1 overflow-y-auto space-y-4">
        <Campo etiqueta="¿En qué se gastó?">
          <input className={campo} value={concepto} onChange={(e) => setConcepto(e.target.value)} maxLength={120} autoFocus placeholder="Ej. Recibo de luz de septiembre" />
        </Campo>
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Categoría">
            <input className={campo} list="categorias-gasto" value={categoria} onChange={(e) => setCategoria(e.target.value)} maxLength={40} placeholder="Elige o escribe" />
            <datalist id="categorias-gasto">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Campo>
          <Campo etiqueta="Fecha">
            <input type="date" className={campo} value={fecha} max={dayjs().format("YYYY-MM-DD")} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Campo etiqueta="Monto">
            <div className="flex gap-2">
              <CampoMonto moneda={moneda} className={`${campo} text-right tabular-nums`} value={monto} onValue={setMonto} placeholder="0.00" />
              <select className={`${campo} w-24!`} value={moneda} onChange={(e) => cambiarMoneda(e.target.value as Moneda)} aria-label="Moneda">
                {monedas.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </Campo>
          <Campo etiqueta="Método de pago">
            <select className={campo} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {(Object.keys(METODOS) as MetodoPago[]).map((m) => (
                <option key={m} value={m}>
                  {METODOS[m]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {config?.moduloCaja && metodo === "EFECTIVO" && <Opcion activo={desdeCaja} onChange={setDesdeCaja} titulo="Sale de la caja abierta" detalle="Queda como egreso de la caja." />}
        <Campo etiqueta="Nota" opcional>
          <input className={campo} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
        </Campo>
      </form>
      <ModalPie>
        <Button type="button" variant="secondary" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" form="gasto-form" variant="primary" isLoading={guardando}>
          Guardar gasto
        </Button>
      </ModalPie>
    </Modal>
  );
}

export default function PantallaGastos() {
  const { hasRole } = useAuth();
  const [preset, setPreset] = useState<PresetPeriodo>("mes");
  const [rango, setRango] = useState(() => rangoDePreset("mes"));
  const [data, setData] = useState<GastosListado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [aEliminar, setAEliminar] = useState<number | null>(null);
  const peticion = useRef(0);

  const cargar = useCallback(async () => {
    if (!rangoValido(rango)) return;
    const id = ++peticion.current;
    setCargando(true);
    try {
      const res = await gastosService.listar(rango.desde, rango.hasta);
      if (id === peticion.current) setData(res.data);
    } catch {
      if (id === peticion.current) toast.error("No se pudieron cargar los gastos.");
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, [rango]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const moneda = (data?.moneda ?? "USD") as Moneda;
  const fmt = (n: number) => formatearMoneda(n, moneda);

  const eliminar = async () => {
    if (aEliminar === null) return;
    try {
      await gastosService.eliminar(aEliminar);
      toast.success("Gasto eliminado.");
      cargar();
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo eliminar." : "No se pudo eliminar.");
    } finally {
      setAEliminar(null);
    }
  };

  const maxCat = Math.max(1, ...(data?.porCategoria.map((c) => c.monto) ?? [1]));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FaMoneyCheckAlt className="text-rose-500" /> Gastos
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Lo que sale del negocio: alquiler, servicios, sueldos…</p>
        </div>
        <Button variant="primary" onClick={() => setNuevo(true)} leftIcon={<FaPlus />}>
          Nuevo gasto
        </Button>
      </header>

      <SelectorPeriodo
        preset={preset}
        rango={rango}
        onChange={(r, p) => {
          setRango(r);
          setPreset(p);
        }}
      />

      <div className={`space-y-6 transition-opacity ${cargando ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className={`${tarjeta} p-5`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total del periodo</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{fmt(data?.total ?? 0)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {data?.gastos.length ?? 0} {data?.gastos.length === 1 ? "gasto" : "gastos"}
            </p>
          </section>

          <section className={`${tarjeta} p-5 lg:col-span-2`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Por categoría</h2>
            {!data || data.porCategoria.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">Sin gastos en este periodo.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.porCategoria.map((c) => (
                  <li key={c.categoria} className="text-sm">
                    <div className="flex justify-between gap-3 mb-1">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{c.categoria}</span>
                      <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmt(c.monto)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full bg-rose-500" style={{ width: `${(c.monto / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Concepto</th>
                <th className="px-5 py-3 text-left">Categoría</th>
                <th className="px-5 py-3 text-left">Pago</th>
                <th className="px-5 py-3 text-right">Monto</th>
                {hasRole(["ADMIN"]) && <th className="px-5 py-3 text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {(!data || data.gastos.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400 italic">
                    No hay gastos en este periodo.
                  </td>
                </tr>
              )}
              {data?.gastos.map((g) => (
                <tr key={g.id} className="border-t border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                  <td className="px-5 py-3 whitespace-nowrap">{dayjs(g.fecha).format("DD/MM/YYYY")}</td>
                  <td className="px-5 py-3">
                    <div className="text-gray-900 dark:text-gray-100 font-medium">{g.concepto}</div>
                    {g.nota && <div className="text-xs text-gray-400">{g.nota}</div>}
                  </td>
                  <td className="px-5 py-3">{g.categoria}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {METODOS[g.metodoPago]}
                    {g.cajaMovimientoId && <span className="ml-2 text-[10px] uppercase font-semibold text-gray-400">caja</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{fmt(g.monto)}</div>
                    {g.moneda !== moneda && <div className="text-xs text-gray-400">{formatearMoneda(g.montoMoneda, g.moneda)}</div>}
                  </td>
                  {hasRole(["ADMIN"]) && (
                    <td className="px-5 py-3 text-center">
                      <Button variant="iconDanger" size="icon" title="Eliminar gasto" onClick={() => setAEliminar(g.id)}>
                        <FaTrashAlt size={12} />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {nuevo && <ModalGasto categorias={data?.categoriasSugeridas ?? []} onClose={() => setNuevo(false)} onGuardado={cargar} />}

      {aEliminar !== null && (
        <ConfirmacionModal
          titulo="Eliminar gasto"
          textoConfirmar="Eliminar"
          mensaje="¿Eliminar este gasto? Si salió de la caja abierta, también se quita ese egreso."
          onConfirm={eliminar}
          onCancel={() => setAEliminar(null)}
        />
      )}
    </div>
  );
}
