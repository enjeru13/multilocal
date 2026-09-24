import { convertirAmonedaPrincipal, monedasActivas, tasaCruzada } from "@lavanderia/shared/dist/utils/monedaHelpers";
import type { Moneda, TasasConversion } from "@lavanderia/shared/dist/types/types";

export interface ConfigMonedas {
  monedaPrincipal?: string | null;
  monedasActivas?: string | null;
  tasaVES?: number | null;
  tasaCOP?: number | null;
}

export interface ResultadoMoneda {
  moneda: Moneda;
  /** Unidades de `moneda` por 1 de la moneda principal, congelada en el registro. */
  tasa: number;
  /** Lo que vale el monto en moneda principal (redondeado a 2 decimales). */
  montoPrincipal: number;
}

export function tasasDe(config: ConfigMonedas | null): TasasConversion {
  return { VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null };
}

/**
 * Tasa congelada para usar `moneda`: solo monedas activas y con tasa definida; nunca se
 * convierte 1:1, si falta algo se devuelve un mensaje de error.
 */
export function resolverTasa(config: ConfigMonedas | null, moneda: Moneda): { tasa: number } | { error: string } {
  const principal = (config?.monedaPrincipal || "USD") as Moneda;

  if (!monedasActivas(config?.monedasActivas, principal).includes(moneda)) {
    return { error: `El negocio no trabaja en ${moneda}. Actívala en Configuración para usarla.` };
  }
  const tasa = tasaCruzada(moneda, principal, tasasDe(config));
  if (!tasa) {
    return { error: `No hay una tasa ${moneda} configurada. Defínela en Configuración antes de usar esa moneda.` };
  }
  return { tasa };
}

/** Convierte un monto en `moneda` a moneda principal con la tasa vigente (que queda congelada). */
export function resolverMoneda(config: ConfigMonedas | null, moneda: Moneda, monto: number): ResultadoMoneda | { error: string } {
  const r = resolverTasa(config, moneda);
  if ("error" in r) return r;
  const principal = (config?.monedaPrincipal || "USD") as Moneda;
  const montoPrincipal = convertirAmonedaPrincipal(monto, moneda, tasasDe(config), principal);
  if (monto > 0 && montoPrincipal <= 0) {
    return { error: "El monto es demasiado pequeño para la tasa configurada." };
  }
  return { moneda, tasa: r.tasa, montoPrincipal };
}
