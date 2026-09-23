import { convertirAmonedaPrincipal } from "@lavanderia/shared/dist/utils/monedaHelpers";
import type { Moneda, TasasConversion } from "@lavanderia/shared/dist/types/types";

export interface ResultadoMoneda {
  moneda: Moneda;
  tasa: number;
  /** Lo que vale el monto en moneda principal (redondeado a 2 decimales). */
  montoPrincipal: number;
}

/**
 * Convierte un monto pagado en `moneda` a moneda principal con la tasa vigente,
 * que queda "congelada" en el registro. Sin tasa válida no se convierte nunca
 * 1:1: devuelve un mensaje de error.
 */
export function resolverMoneda(
  config: { monedaPrincipal?: string | null; tasaVES?: number | null; tasaCOP?: number | null } | null,
  moneda: Moneda,
  monto: number
): ResultadoMoneda | { error: string } {
  const principal = (config?.monedaPrincipal || "USD") as Moneda;
  const tasas: TasasConversion = { VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null };

  let tasa = 1;
  if (moneda === "VES" || moneda === "COP") {
    const t = moneda === "VES" ? tasas.VES : tasas.COP;
    if (t && t > 0) tasa = t;
    else if (moneda !== principal) {
      return { error: `No hay una tasa ${moneda} configurada. Defínela en Configuración antes de usar esa moneda.` };
    }
  }
  const montoPrincipal = convertirAmonedaPrincipal(monto, moneda, tasas, principal);
  if (monto > 0 && montoPrincipal <= 0) {
    return { error: "El monto es demasiado pequeño para la tasa configurada." };
  }
  return { moneda, tasa, montoPrincipal };
}
