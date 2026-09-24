import type { LibroVentas } from "@lavanderia/shared/types/types";

type Celda = string | number | null | undefined;

// Igual que el resto de exportaciones: ";" como separador, "," decimal y BOM para Excel en español.
const celda = (v: Celda): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v * 100) / 100).replace(".", ",");
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
const fila = (...c: Celda[]) => c.map(celda).join(";");

const ddmmaaaa = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/** Arma el texto del CSV del libro de ventas (separado de la descarga para poder probarlo). */
export function construirLibroVentasCsv(d: LibroVentas): string {
  const l: string[] = [];
  l.push(fila("Libro de ventas", d.contribuyente.nombre, d.contribuyente.rif ? `RIF ${d.contribuyente.rif}` : ""));
  l.push(fila("Periodo", `${d.desde} a ${d.hasta}`, `Importes en ${d.moneda}`, d.moneda !== d.principal ? `Tasa usada: ${d.tasa} ${d.moneda} por 1 ${d.principal}` : ""));
  l.push("");
  l.push(fila("N.º de operación", "Fecha", "Cliente", "RIF / cédula", "N.º de venta", "Total ventas (con IVA)", "Ventas exentas o no gravadas", "Base imponible", "Alícuota %", "Impuesto (IVA)", "Nota"));
  d.filas.forEach((f, i) => {
    l.push(fila(i + 1, ddmmaaaa(f.fecha), f.cliente, f.identificacion, f.id, f.total, f.exento, f.baseImponible, f.alicuota, f.iva, f.conDevolucion ? "Neto de devolución" : ""));
  });
  l.push(fila("", "", "", "", "TOTALES", d.totales.total, d.totales.exento, d.totales.baseImponible, "", d.totales.iva));
  return l.join("\r\n");
}

export function exportarLibroVentasCsv(d: LibroVentas) {
  const blob = new Blob(["﻿" + construirLibroVentasCsv(d)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `libro_ventas_${d.desde}_${d.hasta}_${d.moneda}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
