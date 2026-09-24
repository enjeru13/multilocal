// Antigüedad de una deuda (cuentas por cobrar y por pagar): en cuántos días cae y en qué tramo.

export type TramoId = "D0_30" | "D31_60" | "D61_90" | "D90_MAS";

export const TRAMOS: { id: TramoId; etiqueta: string; desde: number; hasta: number }[] = [
  { id: "D0_30", etiqueta: "0–30 días", desde: 0, hasta: 30 },
  { id: "D31_60", etiqueta: "31–60 días", desde: 31, hasta: 60 },
  { id: "D61_90", etiqueta: "61–90 días", desde: 61, hasta: 90 },
  { id: "D90_MAS", etiqueta: "Más de 90 días", desde: 91, hasta: Infinity },
];

const DIA_MS = 24 * 60 * 60 * 1000;

/** Días completos entre la fecha y hoy (por día de calendario); nunca negativo. */
export function diasDeAntiguedad(fecha: Date | string, hoy: Date = new Date()): number {
  const f = new Date(fecha);
  const a = Date.UTC(f.getFullYear(), f.getMonth(), f.getDate());
  const b = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(0, Math.round((b - a) / DIA_MS));
}

export function tramoDe(dias: number): TramoId {
  return (TRAMOS.find((t) => dias >= t.desde && dias <= t.hasta) ?? TRAMOS[TRAMOS.length - 1]).id;
}

export interface ResumenTramo {
  id: TramoId;
  etiqueta: string;
  monto: number;
  cantidad: number;
}

/** Suma lo adeudado por tramo, siempre con los cuatro tramos aunque estén en cero. */
export function resumirAntiguedad(items: { dias: number; monto: number }[]): ResumenTramo[] {
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return TRAMOS.map((t) => {
    const del = items.filter((i) => tramoDe(i.dias) === t.id);
    return { id: t.id, etiqueta: t.etiqueta, monto: r2(del.reduce((s, i) => s + i.monto, 0)), cantidad: del.length };
  });
}
