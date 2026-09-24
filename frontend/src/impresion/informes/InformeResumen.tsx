import dayjs from "dayjs";
import "dayjs/locale/es";
import type { ReporteResumen } from "@lavanderia/shared/types/types";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import { useEtiquetas } from "../../context/configuracionCore";
import { BarrasImpresas, EvolucionImpresa, FilaKpis, HojaReporte, KpiImpreso, NotaImpresa, SeccionImpresa, TablaImpresa } from "../Hoja";
import { TicketPapel, TkEncabezado, TkLinea, TkPie, TkRenglon, TkSeparador, TkTitulo } from "../Ticket";
import ModalImpresion from "../ModalImpresion";
import { METODOS, textoPeriodo } from "../etiquetas";

interface Props {
  open: boolean;
  onClose: () => void;
  data: ReporteResumen | null;
}

const num = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 2 });

function etiquetaSerie(fecha: string, agrupar: "dia" | "mes") {
  const d = dayjs(fecha).locale("es");
  return agrupar === "mes" ? d.format("MMM YY") : d.format("D/M");
}

export default function ImprimirResumen({ open, onClose, data }: Props) {
  const et = useEtiquetas();
  if (!data) return null;
  const m = data.moneda;
  const fmt = (n: number) => formatearMoneda(n, m);
  const hayCosto = data.ganancia.ventaConCosto > 0;
  const periodo = textoPeriodo(data.rango.desde, data.rango.hasta);
  const variacion = (v: number | null) => (v === null ? undefined : `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toLocaleString("es", { maximumFractionDigits: 1 })}% vs. periodo anterior`);

  // Cifras del periodo: solo las filas que tienen algo que decir.
  const cifras: { concepto: string; valor: string; nota?: string; fuerte?: boolean }[] = [
    { concepto: `${et.ordenes} facturadas`, valor: fmt(data.ventas.total), nota: `${data.ventas.cantidad} ${data.ventas.cantidad === 1 ? et.ordenMin : et.ordenesMin}${data.ventas.canceladas > 0 ? ` · ${data.ventas.canceladas} anulada(s)` : ""}` },
    ...(data.ventas.impuestos > 0 ? [{ concepto: "Impuestos cobrados", valor: fmt(data.ventas.impuestos) }] : []),
    ...(data.ventas.descuentos > 0 ? [{ concepto: "Descuentos otorgados", valor: fmt(data.ventas.descuentos) }] : []),
    ...(data.devoluciones.cantidad > 0 ? [{ concepto: "Devoluciones", valor: fmt(data.devoluciones.total), nota: `${data.devoluciones.cantidad}` }] : []),
    ...(hayCosto
      ? [
          { concepto: "Costo de lo vendido", valor: fmt(data.ganancia.costo) },
          { concepto: "Ganancia", valor: fmt(data.ganancia.ganancia), nota: data.ganancia.margen !== null ? `margen ${num(data.ganancia.margen)}%` : undefined, fuerte: true },
        ]
      : []),
    ...(data.gastos.total > 0 ? [{ concepto: "Gastos del periodo", valor: fmt(data.gastos.total), nota: `${data.gastos.cantidad}` }] : []),
    ...(hayCosto && data.gastos.total > 0 ? [{ concepto: "Ganancia neta (después de gastos)", valor: fmt(data.gastos.gananciaNeta), fuerte: true }] : []),
  ];

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo="Vista previa · Resumen del periodo"
      subtitulo={periodo}
      documentTitle={`Resumen_${data.rango.desde}_${data.rango.hasta}`}
      hoja={(ref) => (
        <HojaReporte ref={ref} titulo="Resumen del periodo" subtitulo={`${periodo} · ${data.rango.dias} ${data.rango.dias === 1 ? "día" : "días"} · importes en ${m}`}>
          <FilaKpis>
            <KpiImpreso titulo={`${et.ordenes} facturadas`} valor={fmt(data.ventas.total)} nota={variacion(data.comparacion.variacionVentas) ?? `${data.ventas.cantidad} ${et.ordenesMin}`} />
            <KpiImpreso titulo="Cobrado" valor={fmt(data.cobros.total)} nota={variacion(data.comparacion.variacionCobrado) ?? `${data.cobros.cantidad} pago(s)`} />
            <KpiImpreso titulo="Ticket promedio" valor={fmt(data.ventas.ticketPromedio)} nota={`por ${et.ordenMin}`} />
            {hayCosto ? (
              <KpiImpreso titulo="Ganancia" valor={fmt(data.ganancia.ganancia)} tono={data.ganancia.ganancia >= 0 ? "bueno" : "malo"} nota={data.ganancia.margen !== null ? `margen ${num(data.ganancia.margen)}%` : undefined} />
            ) : (
              <KpiImpreso titulo="Por cobrar" valor={fmt(data.porCobrar.monto)} nota={`${data.porCobrar.cantidad} ${et.ordenesMin}`} />
            )}
          </FilaKpis>

          <SeccionImpresa titulo="Cifras del periodo">
            <table className="w-full text-[10pt] border-collapse">
              <tbody>
                {cifras.map((c) => (
                  <tr key={c.concepto} className={`border-b border-neutral-200 break-inside-avoid ${c.fuerte ? "font-bold bg-neutral-50" : ""}`}>
                    <td className="py-1.5 px-2">{c.concepto}</td>
                    <td className="py-1.5 px-2 text-neutral-500 text-[9pt]">{c.nota}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{c.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hayCosto && data.ganancia.lineasSinCosto > 0 && <NotaImpresa>La ganancia no cuenta {data.ganancia.lineasSinCosto} línea(s) vendidas sin costo registrado.</NotaImpresa>}
          </SeccionImpresa>

          {data.serie.length > 1 && (
            <SeccionImpresa titulo={`Evolución ${data.rango.agrupar === "mes" ? "mensual" : "diaria"}`} nota="ventas facturadas">
              <EvolucionImpresa puntos={data.serie.map((p) => ({ etiqueta: etiquetaSerie(p.fecha, data.rango.agrupar), valor: p.ventas }))} formato={fmt} />
            </SeccionImpresa>
          )}

          <SeccionImpresa titulo={`${et.servicios} más vendidos`}>
            <TablaImpresa
              clave={(i) => i.servicioId}
              filas={data.topItems.slice(0, 10)}
              vacio="Sin ventas en este periodo."
              columnas={[
                { titulo: "#", ancho: "6%", celda: (_, i) => i + 1 },
                { titulo: et.servicio, celda: (i) => i.nombre },
                { titulo: "Cant.", alinear: "right", celda: (i) => num(i.cantidad) },
                { titulo: "Total", alinear: "right", nowrap: true, celda: (i) => fmt(i.total) },
                ...(hayCosto ? [{ titulo: "Ganancia", alinear: "right" as const, nowrap: true, celda: (i: ReporteResumen["topItems"][number]) => (i.ganancia === null ? "—" : fmt(i.ganancia)) }] : []),
              ]}
            />
          </SeccionImpresa>

          <div className="grid grid-cols-2 gap-8">
            <SeccionImpresa titulo="Cómo pagan">
              {data.cobros.porMetodo.length === 0 ? <NotaImpresa>Sin cobros en el periodo.</NotaImpresa> : <BarrasImpresas datos={data.cobros.porMetodo.map((x) => ({ etiqueta: METODOS[x.metodo] ?? x.metodo, valor: x.monto }))} formato={fmt} />}
              {data.cobros.porMoneda.length > 0 && (
                <ul className="mt-3 pt-2 border-t border-neutral-200 space-y-1 text-[9.5pt]">
                  {data.cobros.porMoneda.map((x) => (
                    <li key={x.moneda} className="flex justify-between gap-3">
                      <span className="text-neutral-600">Recibido en {x.moneda}</span>
                      <span className="font-semibold tabular-nums">{formatearMoneda(x.neto, x.moneda as Moneda)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SeccionImpresa>
            <SeccionImpresa titulo={`Mejores ${et.clientesMin}`}>
              {data.clientes.top.length === 0 && data.clientes.sinCliente.ventas === 0 ? (
                <NotaImpresa>Sin ventas en el periodo.</NotaImpresa>
              ) : (
                <ul className="space-y-1 text-[9.5pt]">
                  {data.clientes.top.slice(0, 5).map((c) => (
                    <li key={c.clienteId} className="flex justify-between gap-3 break-inside-avoid">
                      <span className="truncate">
                        {c.nombre} <span className="text-neutral-500">· {c.ventas}</span>
                      </span>
                      <span className="font-semibold tabular-nums shrink-0">{fmt(c.total)}</span>
                    </li>
                  ))}
                  {data.clientes.sinCliente.ventas > 0 && (
                    <li className="flex justify-between gap-3 pt-1 border-t border-neutral-200 text-neutral-600">
                      <span>Sin {et.clienteMin} · {data.clientes.sinCliente.ventas}</span>
                      <span className="tabular-nums">{fmt(data.clientes.sinCliente.total)}</span>
                    </li>
                  )}
                </ul>
              )}
            </SeccionImpresa>
          </div>

          {data.gastos.porCategoria.length > 0 && (
            <SeccionImpresa titulo="Gastos por categoría" nota={`total ${fmt(data.gastos.total)}`}>
              <BarrasImpresas datos={data.gastos.porCategoria.slice(0, 8).map((g) => ({ etiqueta: g.categoria, valor: g.monto }))} formato={fmt} />
            </SeccionImpresa>
          )}

          {(data.porCobrar.monto > 0 || data.porPagar.monto > 0 || data.stockBajo.cantidad > 0) && (
            <SeccionImpresa titulo="Pendientes al cierre del reporte">
              <ul className="space-y-1 text-[10pt]">
                {data.porCobrar.monto > 0 && (
                  <li className="flex justify-between"><span>Por cobrar a {et.clientesMin} ({data.porCobrar.cantidad})</span><strong className="tabular-nums">{fmt(data.porCobrar.monto)}</strong></li>
                )}
                {data.porPagar.monto > 0 && (
                  <li className="flex justify-between"><span>Por pagar a proveedores ({data.porPagar.cantidad})</span><strong className="tabular-nums">{fmt(data.porPagar.monto)}</strong></li>
                )}
                {data.stockBajo.cantidad > 0 && (
                  <li>
                    <div className="flex justify-between"><span>Productos con stock bajo</span><strong>{data.stockBajo.cantidad}</strong></div>
                    <p className="text-[9pt] text-neutral-600 pl-3">{data.stockBajo.items.slice(0, 8).map((s) => `${s.nombreServicio} (${s.stockActual})`).join(" · ")}</p>
                  </li>
                )}
              </ul>
            </SeccionImpresa>
          )}
        </HojaReporte>
      )}
      ticket={(ref) => (
        <TicketPapel ref={ref}>
          <TkEncabezado titulo="Resumen del periodo" subtitulo={periodo} />
          <TkSeparador />
          <TkLinea etiqueta={`${et.ordenes}`} valor={String(data.ventas.cantidad)} />
          <TkLinea etiqueta="Facturado" valor={fmt(data.ventas.total)} fuerte />
          <TkLinea etiqueta="Cobrado" valor={fmt(data.cobros.total)} fuerte />
          <TkLinea etiqueta="Ticket promedio" valor={fmt(data.ventas.ticketPromedio)} />
          {data.ventas.descuentos > 0 && <TkLinea etiqueta="Descuentos" valor={fmt(data.ventas.descuentos)} />}
          {data.ventas.impuestos > 0 && <TkLinea etiqueta="Impuestos" valor={fmt(data.ventas.impuestos)} />}
          {data.devoluciones.cantidad > 0 && <TkLinea etiqueta="Devoluciones" valor={fmt(data.devoluciones.total)} />}
          {hayCosto && <TkLinea etiqueta="Ganancia" valor={fmt(data.ganancia.ganancia)} fuerte />}
          {data.gastos.total > 0 && <TkLinea etiqueta="Gastos" valor={fmt(data.gastos.total)} />}
          {hayCosto && data.gastos.total > 0 && <TkLinea etiqueta="Ganancia neta" valor={fmt(data.gastos.gananciaNeta)} fuerte />}

          {data.cobros.porMetodo.length > 0 && (
            <>
              <TkTitulo>Cómo pagaron</TkTitulo>
              {data.cobros.porMetodo.map((x) => (
                <TkLinea key={x.metodo} etiqueta={METODOS[x.metodo] ?? x.metodo} valor={fmt(x.monto)} />
              ))}
            </>
          )}
          {data.cobros.porMoneda.length > 0 && (
            <>
              <TkTitulo>Recibido por moneda</TkTitulo>
              {data.cobros.porMoneda.map((x) => (
                <TkLinea key={x.moneda} etiqueta={x.moneda} valor={formatearMoneda(x.neto, x.moneda as Moneda)} />
              ))}
            </>
          )}
          {data.topItems.length > 0 && (
            <>
              <TkTitulo>Más vendidos</TkTitulo>
              {data.topItems.slice(0, 5).map((i) => (
                <TkRenglon key={i.servicioId} nombre={i.nombre} detalle={`${num(i.cantidad)} und.`} valor={fmt(i.total)} />
              ))}
            </>
          )}
          {data.porCobrar.monto > 0 && (
            <>
              <TkSeparador />
              <TkLinea etiqueta="Por cobrar" valor={fmt(data.porCobrar.monto)} fuerte />
            </>
          )}
          <TkPie />
        </TicketPapel>
      )}
    />
  );
}
