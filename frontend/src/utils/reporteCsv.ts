import type { ReporteResumen } from "@lavanderia/shared/types/types";

type Celda = string | number | null | undefined;

// Excel en español espera ";" como separador y "," como decimal, y necesita el
// BOM para leer bien las tildes.
const celda = (v: Celda): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v * 100) / 100).replace(".", ",");
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

const fila = (...celdas: Celda[]) => celdas.map(celda).join(";");

const METODOS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", PAGO_MOVIL: "Pago móvil" };

/** Arma el texto del CSV (separado de la descarga para poder probarlo). */
export function construirReporteCsv(
  d: ReporteResumen,
  etiquetas: { orden: string; servicio: string; cliente: string }
): string {
  const l: string[] = [];
  l.push(fila("Reporte", `${d.rango.desde} a ${d.rango.hasta}`, `Moneda: ${d.moneda}`));
  l.push("");

  l.push(fila("RESUMEN"));
  l.push(fila(`${etiquetas.orden} (cantidad)`, d.ventas.cantidad));
  l.push(fila("Anuladas", d.ventas.canceladas));
  l.push(fila("Facturado", d.ventas.total));
  l.push(fila("Ticket promedio", d.ventas.ticketPromedio));
  l.push(fila("Descuentos", d.ventas.descuentos));
  l.push(fila("Impuestos", d.ventas.impuestos));
  l.push(fila("Devoluciones", d.devoluciones.total));
  l.push(fila("Cobrado", d.cobros.total));
  l.push(fila("Ganancia (líneas con costo)", d.ganancia.ganancia));
  l.push(fila("Margen %", d.ganancia.margen));
  l.push(fila("Por cobrar (total)", d.porCobrar.monto));
  l.push("");

  l.push(fila(d.rango.agrupar === "mes" ? "Mes" : "Fecha", "Facturado", `${etiquetas.orden} (cant.)`, "Cobrado"));
  for (const p of d.serie) l.push(fila(p.fecha, p.ventas, p.cantidad, p.cobrado));
  l.push("");

  l.push(fila(etiquetas.servicio, "Cantidad", "Total", "Ganancia"));
  for (const i of d.topItems) l.push(fila(i.nombre, i.cantidad, i.total, i.ganancia));
  l.push("");

  l.push(fila(etiquetas.cliente, "Cantidad", "Total"));
  for (const c of d.clientes.top) l.push(fila(c.nombre, c.ventas, c.total));
  if (d.clientes.sinCliente.ventas > 0) l.push(fila("(sin cliente)", d.clientes.sinCliente.ventas, d.clientes.sinCliente.total));
  l.push("");

  l.push(fila("Método de pago", `Monto (${d.moneda})`));
  for (const m of d.cobros.porMetodo) l.push(fila(METODOS[m.metodo] ?? m.metodo, m.monto));
  l.push("");
  l.push(fila("Moneda recibida", "Recibido", "Vueltos", "Neto"));
  for (const m of d.cobros.porMoneda) l.push(fila(m.moneda, m.recibido, m.vueltos, m.neto));

  return l.join("\r\n");
}

export function exportarReporteCsv(
  d: ReporteResumen,
  etiquetas: { orden: string; servicio: string; cliente: string }
) {
  const blob = new Blob(["﻿" + construirReporteCsv(d, etiquetas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte_${d.rango.desde}_${d.rango.hasta}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
