import {
  type Moneda,
  type TasasConversion,
  tasaCruzada,
} from "./monedaHelpers";

export interface Pago {
  monto: number;
  moneda: Moneda;
  tasa?: number | null;
  vueltos?: { monto: number; moneda: string }[];
}

export interface OrdenPago {
  total: number;
  pagos?: Pago[];
}

export type EstadoPagoTexto = "Sin pagos" | "Parcial" | "Pagado";
export type EstadoPagoRaw = "COMPLETO" | "INCOMPLETO";

/**
 * Calcula el total abonado en moneda principal (USD por defecto)
 */
export function calcularTotalAbonado(
  pagos: Pago[] = [],
  tasasActuales: TasasConversion,
  principal: Moneda = "USD"
): number {
  const convertir = (monto: number, tasa: number | null) => (tasa ? parseFloat((monto / tasa).toFixed(2)) : 0);

  return pagos.reduce((sum, p) => {
    // La tasa congelada del pago es "unidades de su moneda por 1 de la principal".
    // Una tasa 1 en una moneda distinta de la principal es el viejo error de 1:1: se
    // ignora y se usa la tasa actual.
    const global = tasaCruzada(p.moneda, principal, tasasActuales);
    const congelada = p.tasa && p.tasa > 0 && (p.moneda === principal ? p.tasa === 1 : p.tasa !== 1) ? p.tasa : null;
    const tasaDelPago = congelada ?? global;

    const montoAbonado = convertir(p.monto, tasaDelPago);

    // Los vueltos se descuentan con la misma tasa del pago (y la actual si son de otra moneda).
    const totalVueltos = (p.vueltos ?? []).reduce((vSum, v) => {
      const vMoneda = v.moneda as Moneda;
      const t = vMoneda === p.moneda ? tasaDelPago : tasaCruzada(vMoneda, principal, tasasActuales);
      return vSum + convertir(v.monto, t);
    }, 0);

    return sum + (montoAbonado - totalVueltos);
  }, 0);
}

/**
 * Devuelve texto descriptivo del estado de pago (frontend)
 */
export function obtenerEstadoPagoTexto(
  total: number,
  abonado: number
): EstadoPagoTexto {
  const epsilon = 0.005;
  if (abonado === 0) return "Sin pagos";
  if (abonado >= total - epsilon) return "Pagado";
  return "Parcial";
}

/**
 * Devuelve estado crudo usado en backend (COMPLETO o INCOMPLETO)
 */
export function obtenerEstadoPagoRaw(
  total: number,
  abonado: number
): EstadoPagoRaw {
  const epsilon = 0.005;
  return abonado >= total - epsilon ? "COMPLETO" : "INCOMPLETO";
}

/**
 * Calcula resumen completo de pago de una orden
 */
export function calcularResumenPago(
  orden: OrdenPago,
  tasas: TasasConversion,
  principal: Moneda = "USD"
) {
  const abonado = calcularTotalAbonado(orden.pagos ?? [], tasas, principal);
  const faltante = Math.max(orden.total - abonado, 0);
  const estadoRaw = obtenerEstadoPagoRaw(orden.total, abonado);
  const estadoTexto = obtenerEstadoPagoTexto(orden.total, abonado);

  return { abonado, faltante, estadoRaw, estadoTexto };
}
