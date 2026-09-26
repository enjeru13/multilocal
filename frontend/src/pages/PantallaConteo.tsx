import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaArrowLeft, FaBarcode, FaCheck, FaClipboardCheck, FaDownload, FaMinus, FaPlus, FaTimes } from "react-icons/fa";
import type { ConteoDetalle, ConteoInventario } from "@lavanderia/shared/types/types";
import { conteosService } from "../services/conteosService";
import { servicioService, type ServicioConCategoria } from "../services/serviciosService";
import { formatearMoneda, normalizarMoneda } from "../utils/monedaHelpers";
import { exportarExcel, fechaArchivo } from "../utils/exportarExcel";
import { nombreConteo } from "../utils/conteoHelpers";
import { reproducir } from "../sonidos/sonidos";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/configuracionCore";
import { useEsCompacto } from "../hooks/useMediaQuery";
import Button from "../components/ui/Button";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import { FormSkeleton } from "../components/Skeleton";

type Filtro = "CONTADOS" | "SIN_CONTAR" | "DIFERENCIA";

const tarjeta = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";
const num = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 3 });
// Se busca sin distinguir mayúsculas ni tildes: «bujia» encuentra «Bujía».
const plano = (t: string | null | undefined) => (t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const coincideExacto = (s: { sku: string | null; codigoBarras: string | null }, q: string) => {
  const v = q.trim().toLowerCase();
  return !!v && [s.sku, s.codigoBarras].some((x) => x && x.toLowerCase() === v);
};

/** Una toma de inventario: contar producto por producto, ver las diferencias y, al final, ajustar el sistema. */
export default function PantallaConteo() {
  const { id } = useParams();
  const conteoId = Number(id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { config } = useConfiguracion();
  const compacto = useEsCompacto();
  const moneda = normalizarMoneda(config?.monedaPrincipal ?? "USD");
  const entrada = useRef<HTMLInputElement>(null);

  const [conteo, setConteo] = useState<ConteoInventario | null>(null);
  const [catalogo, setCatalogo] = useState<ServicioConCategoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("CONTADOS");
  const [trabajando, setTrabajando] = useState(false);
  const [confirmar, setConfirmar] = useState<null | "aplicar" | "cancelar">(null);

  const abierto = conteo?.estado === "ABIERTO";
  const detalles = useMemo(() => conteo?.detalles ?? [], [conteo]);

  const cargar = useCallback(async () => {
    try {
      const [c, cat] = await Promise.all([conteosService.getById(conteoId), servicioService.getAll()]);
      setConteo(c.data);
      setCatalogo(cat.data);
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo cargar el conteo." : "No se pudo cargar el conteo.");
      navigate("/conteos", { replace: true });
    } finally {
      setCargando(false);
    }
  }, [conteoId, navigate]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Los productos que se pueden contar: los que controlan existencias (y, si el conteo es de una categoría, solo esa).
  const enAlcance = useMemo(() => catalogo.filter((s) => s.controlaStock && (!conteo?.categoriaId || s.categoriaId === conteo.categoriaId)), [catalogo, conteo?.categoriaId]);
  const contadosIds = useMemo(() => new Set(detalles.map((d) => d.servicioId)), [detalles]);
  const sinContar = useMemo(() => enAlcance.filter((s) => !contadosIds.has(s.id)), [enAlcance, contadosIds]);

  const diferenciaDe = (d: ConteoDetalle) => (abierto ? d.contado - d.servicio.stockActual : d.diferencia ?? 0);

  const aplicarDetalle = (d: ConteoDetalle) =>
    setConteo((c) => {
      if (!c) return c;
      const otros = (c.detalles ?? []).filter((x) => x.servicioId !== d.servicioId);
      return { ...c, detalles: [d, ...otros] };
    });

  const contar = async (servicioId: number, cantidad: number, modo: "fijar" | "sumar") => {
    try {
      const res = await conteosService.contar(conteoId, servicioId, cantidad, modo);
      aplicarDetalle(res.data);
      if (modo === "sumar") reproducir("escaneo");
      return res.data;
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo guardar lo contado." : "No se pudo guardar lo contado.");
      return null;
    }
  };

  const quitar = async (servicioId: number) => {
    try {
      await conteosService.quitar(conteoId, servicioId);
      setConteo((c) => (c ? { ...c, detalles: (c.detalles ?? []).filter((x) => x.servicioId !== servicioId) } : c));
    } catch {
      toast.error("No se pudo quitar del conteo.");
    }
  };

  const coincidencias = useMemo(() => {
    const q = plano(buscar.trim());
    if (!q) return [];
    return enAlcance.filter((s) => plano(s.nombreServicio).includes(q) || plano(s.sku).includes(q) || plano(s.codigoBarras).includes(q)).slice(0, 8);
  }, [buscar, enAlcance]);

  // Lectores de código de barras: escriben el código y pulsan Enter; cada lectura cuenta una unidad más.
  const alEnter = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !abierto) return;
    e.preventDefault();
    const q = buscar.trim();
    if (!q) return;
    const exacto = catalogo.find((s) => s.controlaStock && coincideExacto(s, q));
    const elegido = exacto ?? (coincidencias.length === 1 ? coincidencias[0] : undefined);
    if (!elegido) {
      toast.info(coincidencias.length === 0 ? "No se encontró ese código o nombre en el inventario." : "Elige uno de la lista.");
      return;
    }
    if (conteo?.categoriaId && elegido.categoriaId !== conteo.categoriaId) {
      toast.warning(`«${elegido.nombreServicio}» no es de la categoría de este conteo.`);
      return;
    }
    setBuscar("");
    await contar(elegido.id, 1, "sumar");
    if (!compacto) entrada.current?.focus();
  };

  // En curso, el resumen se recalcula con cada lectura; ya aplicado, es el que guardó el servidor.
  const resumen = useMemo(() => {
    if (!conteo) return undefined;
    if (!abierto) return conteo.resumen;
    let sobrantes = 0;
    let faltantes = 0;
    let valorSobrante = 0;
    let valorFaltante = 0;
    let conDif = 0;
    for (const d of detalles) {
      const dif = d.contado - d.servicio.stockActual;
      if (Math.abs(dif) < 1e-9) continue;
      conDif += 1;
      const costo = d.servicio.costoBase ?? 0;
      if (dif > 0) {
        sobrantes += dif;
        valorSobrante += dif * costo;
      } else {
        faltantes += -dif;
        valorFaltante += -dif * costo;
      }
    }
    return { contados: detalles.length, conDiferencia: conDif, sobrantes, faltantes, valorSobrante, valorFaltante };
  }, [conteo, abierto, detalles]);
  const conDiferencia = useMemo(() => detalles.filter((d) => Math.abs(diferenciaDe(d)) > 1e-9), [detalles, abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => {
    if (filtro === "SIN_CONTAR") return [];
    return filtro === "DIFERENCIA" ? conDiferencia : detalles;
  }, [filtro, detalles, conDiferencia]);

  const aplicar = async () => {
    setTrabajando(true);
    try {
      const res = await conteosService.aplicar(conteoId);
      setConteo((c) => ({ ...(c as ConteoInventario), ...res.data, categoriaNombre: c?.categoriaNombre }));
      setFiltro("CONTADOS");
      reproducir("cobro");
      toast.success("Existencias ajustadas.");
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo aplicar el conteo." : "No se pudo aplicar el conteo.");
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  };

  const cancelar = async () => {
    setTrabajando(true);
    try {
      await conteosService.cancelar(conteoId);
      toast.success("Conteo cancelado. No se cambió ninguna existencia.");
      navigate("/conteos", { replace: true });
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo cancelar." : "No se pudo cancelar.");
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  };

  const exportar = async () => {
    if (!conteo) return;
    try {
      await exportarExcel(
        `conteo_${conteo.id}_${fechaArchivo()}.xlsx`,
        "Conteo",
        [
          { titulo: "Producto", ancho: 36, valor: (d: ConteoDetalle) => d.servicio.nombreServicio },
          { titulo: "Código", ancho: 16, valor: (d) => d.servicio.sku ?? d.servicio.codigoBarras },
          { titulo: abierto ? "Sistema (ahora)" : "Sistema", ancho: 14, valor: (d) => (abierto ? d.servicio.stockActual : d.esperado) },
          { titulo: "Contado", ancho: 12, valor: (d) => d.contado },
          { titulo: "Diferencia", ancho: 12, valor: (d) => diferenciaDe(d) },
          { titulo: `Valor de la diferencia (${moneda})`, ancho: 22, formato: "#,##0.00", valor: (d) => diferenciaDe(d) * ((abierto ? d.servicio.costoBase : d.costoUnit) ?? 0) },
        ],
        [...detalles].sort((a, b) => diferenciaDe(a) - diferenciaDe(b))
      );
    } catch {
      toast.error("No se pudo crear el archivo de Excel.");
    }
  };

  if (cargando || !conteo) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }

  const filtros: { id: Filtro; label: string; n: number }[] = [
    { id: "CONTADOS", label: "Contados", n: detalles.length },
    ...(abierto ? [{ id: "SIN_CONTAR" as Filtro, label: "Sin contar", n: sinContar.length }] : []),
    { id: "DIFERENCIA", label: "Con diferencia", n: conDiferencia.length },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/conteos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 mb-1">
            <FaArrowLeft size={11} /> Conteo físico
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1">
            <FaClipboardCheck className="text-blue-600 dark:text-blue-400" /> {nombreConteo(conteo)}
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${abierto ? "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" : conteo.estado === "APLICADO" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
              {abierto ? "En curso" : conteo.estado === "APLICADO" ? "Aplicado" : "Cancelado"}
            </span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {conteo.categoriaNombre ? `Solo «${conteo.categoriaNombre}» · ` : "Todo el inventario · "}
            iniciado el {dayjs(conteo.creadoEn).format("DD/MM/YYYY HH:mm")}
            {conteo.userName ? ` por ${conteo.userName}` : ""}
            {conteo.aplicadoEn ? ` · aplicado el ${dayjs(conteo.aplicadoEn).format("DD/MM/YYYY HH:mm")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {detalles.length > 0 && (
            <Button variant="secondary" size="sm" leftIcon={<FaDownload />} onClick={exportar}>
              Exportar a Excel
            </Button>
          )}
          {abierto && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmar("cancelar")} disabled={trabajando}>
              Cancelar conteo
            </Button>
          )}
        </div>
      </header>

      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { t: "Contados", v: abierto ? `${resumen.contados} de ${enAlcance.length}` : String(resumen.contados), c: "" },
            { t: "Con diferencia", v: String(resumen.conDiferencia), c: resumen.conDiferencia > 0 ? "text-amber-600 dark:text-amber-400" : "" },
            { t: "Faltan", v: `${num(resumen.faltantes)} u.`, sub: formatearMoneda(resumen.valorFaltante, moneda), c: resumen.faltantes > 0 ? "text-red-600 dark:text-red-400" : "" },
            { t: "Sobran", v: `${num(resumen.sobrantes)} u.`, sub: formatearMoneda(resumen.valorSobrante, moneda), c: resumen.sobrantes > 0 ? "text-emerald-600 dark:text-emerald-400" : "" },
          ].map((k) => (
            <div key={k.t} className={`${tarjeta} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{k.t}</p>
              <p className={`text-xl font-bold tabular-nums mt-1 ${k.c}`}>{k.v}</p>
              {"sub" in k && k.sub && <p className="text-xs text-gray-400 mt-0.5">al costo: {k.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {abierto && (
        <section className={`${tarjeta} p-4 space-y-3`}>
          <div className="relative">
            <FaBarcode className="absolute top-3.5 left-4 text-gray-400" />
            <input
              ref={entrada}
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              onKeyDown={alEnter}
              autoFocus={!compacto}
              enterKeyHint="done"
              placeholder={compacto ? "Código o nombre" : "Escanea el código o busca por nombre y pulsa Enter: cada lectura suma una unidad"}
              className="w-full pl-11 pr-4 h-12 text-base rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {coincidencias.length > 0 && (
              <ul className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {coincidencias.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={async () => {
                        setBuscar("");
                        await contar(s.id, 1, "sumar");
                        if (!compacto) entrada.current?.focus();
                      }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.nombreServicio}</span>
                        <span className="block text-xs text-gray-500 truncate">{s.sku || s.codigoBarras || "sin código"}</span>
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">sistema: {num(s.stockActual)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Puedes corregir cualquier cantidad escribiéndola en la lista. Los productos que no cuentes no se tocan.</p>
        </section>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Vista">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={`shrink-0 h-9 px-3.5 rounded-full text-sm font-medium border cursor-pointer transition-colors ${filtro === f.id ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400"}`}
          >
            {f.label} <span className="opacity-70 tabular-nums">{f.n}</span>
          </button>
        ))}
      </div>

      {filtro === "SIN_CONTAR" ? (
        <div className={`${tarjeta} overflow-hidden`}>
          {sinContar.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">¡Ya contaste todo!</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[60dvh] overflow-y-auto">
              {sinContar.slice(0, 300).map((s) => (
                <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.nombreServicio}</span>
                    <span className="block text-xs text-gray-500 truncate">{s.sku || s.codigoBarras || ""}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500">sistema: {num(s.stockActual)}</span>
                    <Button variant="secondary" size="sm" onClick={() => contar(s.id, 1, "sumar")}>
                      Contar
                    </Button>
                  </span>
                </li>
              ))}
              {sinContar.length > 300 && <li className="px-4 py-3 text-center text-xs text-gray-500">… y {sinContar.length - 300} más. Usa el buscador.</li>}
            </ul>
          )}
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          {filtro === "DIFERENCIA" ? "No hay diferencias por ahora." : abierto ? "Aún no has contado nada. Escanea un producto para empezar." : "Este conteo no tiene productos."}
        </div>
      ) : (
        <div className={`${tarjeta} overflow-hidden`}>
          <div className="hidden sm:grid grid-cols-[1fr_6rem_9rem_6rem_2.5rem] gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span>Producto</span>
            <span className="text-right">{abierto ? "Sistema" : "Sistema entonces"}</span>
            <span className="text-center">Contado</span>
            <span className="text-right">Diferencia</span>
            <span />
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {lista.map((d) => (
              <FilaContada key={d.servicioId} d={d} abierto={!!abierto} diferencia={diferenciaDe(d)} onFijar={(v) => contar(d.servicioId, v, "fijar")} onQuitar={() => quitar(d.servicioId)} />
            ))}
          </ul>
        </div>
      )}

      {abierto && (
        <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 pt-2.5 pb-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 min-w-0">
            {detalles.length} contado{detalles.length === 1 ? "" : "s"} · <strong className="text-gray-900 dark:text-gray-100">{conDiferencia.length}</strong> con diferencia
          </p>
          {hasRole(["ADMIN"]) ? (
            <Button variant="primary" leftIcon={<FaCheck />} onClick={() => setConfirmar("aplicar")} disabled={detalles.length === 0 || trabajando}>
              Aplicar ajustes
            </Button>
          ) : (
            <span className="text-xs text-gray-500 text-right">Un administrador aplica el conteo.</span>
          )}
        </div>
      )}

      {confirmar === "aplicar" && (
        <ConfirmacionModal
          titulo="Aplicar el conteo"
          mensaje={`Se ajustarán ${conDiferencia.length} producto(s): faltan ${num(resumen?.faltantes ?? 0)} u. (${formatearMoneda(resumen?.valorFaltante ?? 0, moneda)} al costo) y sobran ${num(resumen?.sobrantes ?? 0)} u. Las existencias quedarán iguales a lo contado. Los productos que no contaste no cambian. Esto no se puede deshacer, pero cada ajuste queda en el historial de movimientos.`}
          textoConfirmar={trabajando ? "Aplicando…" : "Aplicar ajustes"}
          onCancel={() => !trabajando && setConfirmar(null)}
          onConfirm={aplicar}
        />
      )}
      {confirmar === "cancelar" && (
        <ConfirmacionModal titulo="Cancelar el conteo" mensaje="Se descarta lo contado hasta ahora. No cambia ninguna existencia." textoConfirmar="Cancelar conteo" textoCancelar="Seguir contando" onCancel={() => setConfirmar(null)} onConfirm={cancelar} />
      )}
    </div>
  );
}

function FilaContada({ d, abierto, diferencia, onFijar, onQuitar }: { d: ConteoDetalle; abierto: boolean; diferencia: number; onFijar: (v: number) => Promise<unknown>; onQuitar: () => void }) {
  const [texto, setTexto] = useState(String(d.contado));
  const [ultimo, setUltimo] = useState(d.contado);
  // Si el valor cambia por fuera (una lectura del escáner), la caja lo refleja.
  if (d.contado !== ultimo) {
    setUltimo(d.contado);
    setTexto(String(d.contado));
  }

  const guardar = async (valor: number) => {
    if (!Number.isFinite(valor) || valor < 0 || valor === d.contado) {
      setTexto(String(d.contado));
      return;
    }
    await onFijar(valor);
  };

  const sistema = abierto ? d.servicio.stockActual : d.esperado ?? 0;
  const colorDif = Math.abs(diferencia) < 1e-9 ? "text-gray-400" : diferencia > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <li className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_6rem_9rem_6rem_2.5rem] gap-x-3 gap-y-2 px-4 py-3 items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{d.servicio.nombreServicio}</p>
        <p className="text-xs text-gray-500 truncate">
          {d.servicio.sku || d.servicio.codigoBarras || "sin código"}
          <span className="sm:hidden"> · sistema {num(sistema)}</span>
        </p>
      </div>
      <p className="hidden sm:block text-right tabular-nums text-sm text-gray-600 dark:text-gray-400">{num(sistema)}</p>
      <div className="flex items-center justify-center gap-1 max-sm:col-span-1 max-sm:justify-end">
        {abierto && (
          <button type="button" onClick={() => guardar(d.contado - 1)} disabled={d.contado <= 0} className="w-9 h-9 rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center cursor-pointer disabled:opacity-40" aria-label="Uno menos">
            <FaMinus size={9} />
          </button>
        )}
        <input
          type="number"
          min={0}
          step={d.servicio.permiteDecimales ? "any" : 1}
          inputMode={d.servicio.permiteDecimales ? "decimal" : "numeric"}
          value={texto}
          disabled={!abierto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => guardar(parseFloat(texto.replace(",", ".")))}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-16 h-9 text-center tabular-nums rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 disabled:border-transparent disabled:font-semibold"
          aria-label="Cantidad contada"
        />
        {abierto && (
          <button type="button" onClick={() => guardar(d.contado + 1)} className="w-9 h-9 rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center cursor-pointer" aria-label="Uno más">
            <FaPlus size={9} />
          </button>
        )}
      </div>
      <p className={`text-right tabular-nums text-sm font-semibold ${colorDif} max-sm:col-span-1`}>{Math.abs(diferencia) < 1e-9 ? "0" : `${diferencia > 0 ? "+" : ""}${num(diferencia)}`}</p>
      {abierto ? (
        <button type="button" onClick={onQuitar} className="justify-self-end w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer" title="Quitar del conteo" aria-label="Quitar del conteo">
          <FaTimes />
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}
