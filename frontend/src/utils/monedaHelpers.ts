export type Moneda = "USD" | "VES" | "COP";

export interface TasasConversion {
  VES?: number | null;
  COP?: number | null;
}

/**
 * @param input
 * @returns
 */
export function normalizarMoneda(input: unknown): Moneda {
  const valor = String(input).toUpperCase();
  if (valor === "VES") return "VES";
  if (valor === "COP") return "COP";
  return "USD";
}

/**
 * @param monto
 * @param moneda
 * @param tasas
 * @param principal
 * @returns
 */
export function convertirAmonedaPrincipal(
  monto: number,
  moneda: Moneda,
  tasas: TasasConversion,
  principal: Moneda = "USD"
): number {
  if (typeof monto !== "number" || isNaN(monto)) return 0;
  if (moneda === principal) return parseFloat(monto.toFixed(2));

  const tasa =
    moneda === "VES" ? tasas.VES : moneda === "COP" ? tasas.COP : undefined;

  return tasa && tasa > 0 ? parseFloat((monto / tasa).toFixed(2)) : 0;
}

/**
 * @param monto
 * @param destino
 * @param tasas
 * @param principal
 * @returns
 */
export function convertirDesdePrincipal(
  monto: number,
  destino: Moneda,
  tasas: TasasConversion,
  principal: Moneda = "USD"
): number {
  if (typeof monto !== "number" || isNaN(monto)) return 0;
  if (destino === principal) return parseFloat(monto.toFixed(2));

  const tasa =
    destino === "VES" ? tasas.VES : destino === "COP" ? tasas.COP : undefined;

  return tasa && tasa > 0 ? parseFloat((monto * tasa).toFixed(2)) : 0;
}

/**
 * @param monto
 * @param moneda
 * @returns
 */
export function formatearMoneda(monto: number, moneda: Moneda = "USD"): string {
  const formatterOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  let locale = "en-US";
  switch (moneda) {
    case "VES":
      locale = "es-VE";
      break;
    case "COP":
      locale = "es-CO";
      if (Number.isInteger(monto)) {
        formatterOptions.minimumFractionDigits = 0;
        formatterOptions.maximumFractionDigits = 0;
      }
      break;
    case "USD":
    default:
      locale = "en-US";
      break;
  }

  return new Intl.NumberFormat(locale, formatterOptions).format(monto);
}

/**
 * @param valor
 * @returns
 */
export function parsearTasa(valor: string): number | undefined {
  if (!valor) return undefined;
  const normalizado = valor.replace(",", ".");
  const limpio = normalizado.replace(/(?<=\d)\.(?=\d{3})/g, "");
  const num = parseFloat(limpio);
  return isNaN(num) ? undefined : num;
}

/**
 * @param valor
 * @returns
 */
export function formatearTasa(valor: number | string): string {
  const num =
    typeof valor === "string" ? parseFloat(valor.replace(",", ".")) : valor;

  return isNaN(num) ? "" : num.toFixed(2);
}

/**
 * @param valor
 * @param moneda
 * @returns
 */
export function parsearMonto(valor: string, moneda: Moneda): number {
  if (!valor) return 0;

  let limpio = valor.trim();

  if (moneda === "VES" || moneda === "COP") {
    limpio = limpio.replace(/\./g, "");
    limpio = limpio.replace(/,/g, ".");
  } else {
    limpio = limpio.replace(/,/g, "");
  }

  const num = parseFloat(limpio);
  return isNaN(num) ? 0 : num;
}
