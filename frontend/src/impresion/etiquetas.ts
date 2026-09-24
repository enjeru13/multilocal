import dayjs from "dayjs";
import "dayjs/locale/es";
import type { EstadoOrden, Moneda } from "@lavanderia/shared/types/types";

export const METODOS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  PAGO_MOVIL: "Pago móvil",
};

export const NOMBRE_MONEDA: Record<Moneda, string> = { USD: "Dólares", VES: "Bolívares", COP: "Pesos colombianos" };

export const ESTADOS: Record<EstadoOrden, string> = {
  PENDIENTE: "Pendiente",
  LISTO: "Listo",
  ENTREGADO: "Entregado",
  CANCELADO: "Anulado",
};

export const fecha = (d: string | Date | null | undefined) => (d ? dayjs(d).format("DD/MM/YYYY") : "—");
export const fechaHora = (d: string | Date | null | undefined) => (d ? dayjs(d).format("DD/MM/YYYY HH:mm") : "—");

/** "1 sep 2026 – 23 sep 2026", o un solo día si coinciden. */
export function textoPeriodo(desde: string, hasta: string) {
  const a = dayjs(desde).locale("es");
  const b = dayjs(hasta).locale("es");
  return a.isSame(b, "day") ? a.format("D [de] MMMM [de] YYYY") : `${a.format("D MMM YYYY")} – ${b.format("D MMM YYYY")}`;
}
