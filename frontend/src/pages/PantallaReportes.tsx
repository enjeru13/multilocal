import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { useNavigate } from "react-router-dom";
import { FaChartLine, FaDownload, FaArrowUp, FaArrowDown, FaPrint, FaChevronDown } from "react-icons/fa";
import type { ReporteResumen } from "@lavanderia/shared/types/types";
import { reportesService } from "../services/reportesService";
import { formatearMoneda } from "../utils/monedaHelpers";
import { useConfiguracion, useEtiquetas } from "../context/configuracionCore";
import ImprimirResumen from "../impresion/informes/InformeResumen";
import ImprimirLibroVentas from "../impresion/informes/InformeLibroVentas";
import ImprimirPorCobrar from "../impresion/informes/InformeCobrar";
import ImprimirPorPagar from "../impresion/informes/InformePagar";
import ImprimirInventario, { type ModoInventario } from "../impresion/informes/InformeInventario";
import GraficoBarras from "../components/charts/GraficoBarras";
import Button from "../components/ui/Button";
import { exportarReporteCsv } from "../utils/reporteCsv";
import SelectorPeriodo from "../components/SelectorPeriodo";
import { rangoDePreset, rangoValido, type PresetPeriodo } from "../utils/rangosFecha";

const METODOS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  PAGO_MOVIL: "Pago móvil",
};

const tarjeta =
  "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";

function Variacion({ valor }: { valor: number | null }) {
  if (valor === null) {
    return <span className="text-xs text-gray-400">Sin periodo anterior</span>;
  }
  const sube = valor >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        sube ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {sube ? <FaArrowUp size={9} /> : <FaArrowDown size={9} />}
      {Math.abs(valor).toLocaleString("es", { maximumFractionDigits: 1 })}% vs. periodo anterior
    </span>
  );
}

function Kpi({
  titulo,
  valor,
  pie,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  pie?: React.ReactNode;
  destacado?: boolean;
}) {
  return (
    <div className={`${tarjeta} p-5 ${destacado ? "ring-1 ring-blue-500/30" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{valor}</p>
      <div className="mt-1 min-h-4 text-xs text-gray-500 dark:text-gray-400">{pie}</div>
    </div>
  );
}

export default function PantallaReportes() {
  const et = useEtiquetas();
  const { config } = useConfiguracion();
  const navigate = useNavigate();
  const [imprimir, setImprimir] = useState<null | "libro" | "resumen" | "cobrar" | "pagar" | ModoInventario>(null);
  const [preset, setPreset] = useState<PresetPeriodo>("mes");
  const [rango, setRango] = useState(() => rangoDePreset("mes"));
  const [data, setData] = useState<ReporteResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const peticion = useRef(0);

  const cargar = useCallback(async (desde: string, hasta: string) => {
    const id = ++peticion.current;
    setCargando(true);
    setError(null);
    try {
      const res = await reportesService.resumen(desde, hasta);
      if (id === peticion.current) setData(res.data);
    } catch (err) {
      if (id !== peticion.current) return;
      const mensaje = isAxiosError(err) ? err.response?.data?.message : null;
      setError(mensaje ?? "No se pudo generar el reporte.");
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (rangoValido(rango)) cargar(rango.desde, rango.hasta);
  }, [rango, cargar]);

  const m = data?.moneda ?? "USD";
  const fmt = (n: number) => formatearMoneda(n, m);

  const exportar = () => {
    if (!data) return;
    exportarReporteCsv(data, { orden: et.ordenes, servicio: et.servicios, cliente: et.clientes });
    toast.success("Reporte exportado.");
  };

  const hayCosto = !!data && data.ganancia.ventaConCosto > 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FaChartLine className="text-blue-600 dark:text-blue-400" /> Reportes
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {data
              ? `${dayjs(data.rango.desde).locale("es").format("D MMM YYYY")} – ${dayjs(data.rango.hasta)
                  .locale("es")
                  .format("D MMM YYYY")}`
              : "Elige un periodo."}
          </p>
        </div>
        <div className="flex gap-2">
          <Menu as="div" className="relative">
            <MenuButton className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer">
              <FaPrint /> Imprimir <FaChevronDown size={9} />
            </MenuButton>
            <MenuItems anchor="bottom end" className="z-60 mt-2 w-72 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1 focus:outline-none">
              {[
                { id: "resumen", titulo: "Resumen del periodo", detalle: "Ventas, cobros, ganancia y más vendidos", mostrar: !!data, accion: () => setImprimir("resumen") },
                { id: "libro", titulo: "Libro de ventas", detalle: "Exento, base imponible e IVA de cada venta", mostrar: true, accion: () => setImprimir("libro") },
                { id: "cobrar", titulo: "Cuentas por cobrar", detalle: "Quién debe y desde cuándo", mostrar: true, accion: () => setImprimir("cobrar") },
                { id: "pagar", titulo: "Cuentas por pagar", detalle: "Lo que se debe a proveedores", mostrar: !!config?.moduloProveedores, accion: () => setImprimir("pagar") },
                { id: "inv", titulo: "Inventario", detalle: "Existencias y su valor", mostrar: !!config?.moduloInventario, accion: () => setImprimir("existencias") },
                { id: "rep", titulo: "Lista de reposición", detalle: "Lo que está en el mínimo, para pedir", mostrar: !!config?.moduloInventario, accion: () => setImprimir("reposicion") },
                { id: "pagos", titulo: "Reporte de pagos", detalle: "Se imprime desde Pagos, con sus filtros", mostrar: true, accion: () => navigate("/pagos") },
                { id: "ord", titulo: `Reporte de ${et.ordenesMin}`, detalle: `Se imprime desde ${et.ordenes}, con sus filtros`, mostrar: true, accion: () => navigate("/estado-ordenes") },
                { id: "caja", titulo: "Cierres de caja", detalle: "Cada cierre tiene su comprobante en Caja", mostrar: !!config?.moduloCaja, accion: () => navigate("/caja") },
              ]
                .filter((o) => o.mostrar)
                .map((o) => (
                  <MenuItem key={o.id}>
                    <button type="button" onClick={o.accion} className="w-full text-left px-3 py-2 rounded-lg data-focus:bg-gray-100 dark:data-focus:bg-gray-800 cursor-pointer">
                      <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">{o.titulo}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{o.detalle}</span>
                    </button>
                  </MenuItem>
                ))}
            </MenuItems>
          </Menu>
          <Button variant="secondary" onClick={exportar} disabled={!data || cargando} leftIcon={<FaDownload />}>
            Exportar CSV
          </Button>
        </div>
      </header>

      <ImprimirResumen open={imprimir === "resumen"} onClose={() => setImprimir(null)} data={data} />
      <ImprimirLibroVentas open={imprimir === "libro"} onClose={() => setImprimir(null)} desde={rango.desde} hasta={rango.hasta} />
      <ImprimirPorCobrar open={imprimir === "cobrar"} onClose={() => setImprimir(null)} />
      <ImprimirPorPagar open={imprimir === "pagar"} onClose={() => setImprimir(null)} />
      <ImprimirInventario open={imprimir === "existencias" || imprimir === "reposicion"} modo={imprimir === "reposicion" ? "reposicion" : "existencias"} onClose={() => setImprimir(null)} />

      <SelectorPeriodo
        preset={preset}
        rango={rango}
        onChange={(r, p) => {
          setRango(r);
          setPreset(p);
        }}
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!data && cargando && <div className={`${tarjeta} h-64 animate-pulse`} />}

      {data && (
        <div className={`space-y-6 transition-opacity ${cargando ? "opacity-60" : ""}`}>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              destacado
              titulo={`${et.ordenes} facturadas`}
              valor={fmt(data.ventas.total)}
              pie={
                <>
                  <Variacion valor={data.comparacion.variacionVentas} />
                  <div>
                    {data.ventas.cantidad} {data.ventas.cantidad === 1 ? et.ordenMin : et.ordenesMin}
                    {data.ventas.canceladas > 0 && ` · ${data.ventas.canceladas} anulada(s)`}
                  </div>
                </>
              }
            />
            <Kpi
              titulo="Cobrado"
              valor={fmt(data.cobros.total)}
              pie={
                <>
                  <Variacion valor={data.comparacion.variacionCobrado} />
                  <div>
                    {data.cobros.cantidad} {data.cobros.cantidad === 1 ? "pago" : "pagos"}
                  </div>
                </>
              }
            />
            <Kpi
              titulo="Ticket promedio"
              valor={fmt(data.ventas.ticketPromedio)}
              pie={`por ${et.ordenMin}`}
            />
            {hayCosto ? (
              <Kpi
                titulo="Ganancia"
                valor={fmt(data.ganancia.ganancia)}
                pie={
                  <>
                    {data.ganancia.margen !== null && <div>Margen {data.ganancia.margen.toLocaleString("es")}%</div>}
                    {data.ganancia.lineasSinCosto > 0 && (
                      <div>{data.ganancia.lineasSinCosto} línea(s) sin costo no cuentan</div>
                    )}
                  </>
                }
              />
            ) : (
              <Kpi
                titulo="Por cobrar (total)"
                valor={fmt(data.porCobrar.monto)}
                pie={`${data.porCobrar.cantidad} ${data.porCobrar.cantidad === 1 ? et.ordenMin : et.ordenesMin} con saldo`}
              />
            )}
          </section>

          {(data.ventas.descuentos > 0 || data.ventas.impuestos > 0 || data.devoluciones.cantidad > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
              {data.ventas.impuestos > 0 && (
                <span>
                  Impuestos cobrados: <strong className="text-gray-900 dark:text-gray-100">{fmt(data.ventas.impuestos)}</strong>
                </span>
              )}
              {data.ventas.descuentos > 0 && (
                <span>
                  Descuentos dados: <strong className="text-gray-900 dark:text-gray-100">{fmt(data.ventas.descuentos)}</strong>
                </span>
              )}
              {data.devoluciones.cantidad > 0 && (
                <span>
                  Devoluciones: <strong className="text-gray-900 dark:text-gray-100">{fmt(data.devoluciones.total)}</strong> ({data.devoluciones.cantidad})
                </span>
              )}
            </div>
          )}

          {(data.gastos.total > 0 || data.porPagar.monto > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
              {data.gastos.total > 0 && (
                <span>
                  Gastos: <strong className="text-gray-900 dark:text-gray-100">{fmt(data.gastos.total)}</strong>
                  {data.gastos.porCategoria[0] && <> (el mayor: {data.gastos.porCategoria[0].categoria})</>}
                </span>
              )}
              {hayCosto && data.gastos.total > 0 && (
                <span>
                  Ganancia neta:{" "}
                  <strong className={data.gastos.gananciaNeta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {fmt(data.gastos.gananciaNeta)}
                  </strong>
                </span>
              )}
              {data.porPagar.monto > 0 && (
                <span>
                  Por pagar a proveedores: <strong className="text-gray-900 dark:text-gray-100">{fmt(data.porPagar.monto)}</strong> ({data.porPagar.cantidad})
                </span>
              )}
            </div>
          )}

          {hayCosto && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Por cobrar (total): <strong className="text-gray-900 dark:text-gray-100">{fmt(data.porCobrar.monto)}</strong>{" "}
              en {data.porCobrar.cantidad} {data.porCobrar.cantidad === 1 ? et.ordenMin : et.ordenesMin}.
            </div>
          )}

          <section className={`${tarjeta} p-5`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Evolución {data.rango.agrupar === "mes" ? "mensual" : "diaria"}
            </h2>
            <GraficoBarras datos={data.serie} moneda={m} agrupar={data.rango.agrupar} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className={`${tarjeta} p-5 lg:col-span-2`}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{et.servicios} más vendidos</h2>
              {data.topItems.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Sin ventas en este periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="py-2 text-left font-semibold">{et.servicio}</th>
                        <th className="py-2 text-right font-semibold">Cant.</th>
                        <th className="py-2 text-right font-semibold">Total</th>
                        <th className="py-2 text-right font-semibold">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topItems.slice(0, 10).map((i) => (
                        <tr key={i.servicioId} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">{i.nombre}</td>
                          <td className="py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {i.cantidad.toLocaleString("es")}
                          </td>
                          <td className="py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                            {fmt(i.total)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {i.ganancia === null ? "—" : fmt(i.ganancia)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={`${tarjeta} p-5 space-y-5`}>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Cómo te pagan</h2>
                {data.cobros.porMetodo.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">Sin cobros.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.cobros.porMetodo.map((x) => (
                      <li key={x.metodo} className="flex justify-between gap-3">
                        <span className="text-gray-600 dark:text-gray-400">{METODOS[x.metodo] ?? x.metodo}</span>
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmt(x.monto)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {data.cobros.porMoneda.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Por moneda recibida</h3>
                  <ul className="space-y-2 text-sm">
                    {data.cobros.porMoneda.map((x) => (
                      <li key={x.moneda} className="flex justify-between gap-3">
                        <span className="text-gray-600 dark:text-gray-400">{x.moneda}</span>
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {formatearMoneda(x.neto, x.moneda as "USD" | "VES" | "COP")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className={`${tarjeta} p-5`}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Mejores {et.clientesMin}</h2>
              {data.clientes.top.length === 0 && data.clientes.sinCliente.ventas === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Sin ventas en este periodo.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.clientes.top.slice(0, 5).map((c) => (
                    <li key={c.clienteId} className="flex justify-between gap-3">
                      <span className="text-gray-900 dark:text-gray-100 truncate">
                        {c.nombre}{" "}
                        <span className="text-gray-400">
                          · {c.ventas} {c.ventas === 1 ? et.ordenMin : et.ordenesMin}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmt(c.total)}</span>
                    </li>
                  ))}
                  {data.clientes.sinCliente.ventas > 0 && (
                    <li className="flex justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">
                        Sin {et.clienteMin} · {data.clientes.sinCliente.ventas}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                        {fmt(data.clientes.sinCliente.total)}
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </section>

            <section className={`${tarjeta} p-5`}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Atención</h2>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between gap-3">
                  <span className="text-gray-600 dark:text-gray-400">Por cobrar</span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {fmt(data.porCobrar.monto)}{" "}
                    <span className="font-normal text-gray-400">({data.porCobrar.cantidad})</span>
                  </span>
                </li>
                {data.stockBajo.cantidad > 0 ? (
                  <li>
                    <p className="text-amber-600 dark:text-amber-400 font-medium mb-1">
                      {data.stockBajo.cantidad} {data.stockBajo.cantidad === 1 ? "producto" : "productos"} con stock bajo
                    </p>
                    <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                      {data.stockBajo.items.slice(0, 5).map((s) => (
                        <li key={s.id} className="flex justify-between gap-3">
                          <span className="truncate">{s.nombreServicio}</span>
                          <span className="tabular-nums">
                            {s.stockActual} / mín. {s.stockMinimo}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li className="text-gray-500 dark:text-gray-400">Sin alertas de stock.</li>
                )}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
