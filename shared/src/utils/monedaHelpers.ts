export type Moneda = "USD" | "VES" | "COP";

export interface TasasConversion {
  VES?: number | null;
  COP?: number | null;
}

/**
 * Convierte un monto hacia la moneda principal, usando tasas.
 * Ejemplo: Bs 80 / tasa VES → USD
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
 * Convierte desde la moneda principal hacia otra, usando tasas.
 * Ejemplo: USD → Bs (VES) * tasa VES
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
 * Formatea visualmente un monto como moneda local.
 * Ejemplo: 12.5 → "$12.50" o "Bs 12,50"
 */
export function formatearMoneda(monto: number, moneda: Moneda = "USD"): string {
  const locales: Record<Moneda, string> = {
    USD: "en-US",
    VES: "es-VE",
    COP: "es-CO",
  };

  const opciones: Intl.NumberFormatOptions = {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  const locale = locales[moneda] || "en-US";
  return new Intl.NumberFormat(locale, opciones).format(monto);
}

/**
 * Convierte string de tasa (que puede tener coma o miles) en número válido.
 * Ejemplo: "2,500.00" → 2500, "3.5" → 3.5
 */
export function parsearTasa(valor: string): number | undefined {
  if (!valor) return undefined;

  const normalizado = valor.replace(",", ".");
  const limpio = normalizado.replace(/(?<=\d)\.(?=\d{3})/g, "");
  const num = parseFloat(limpio);

  return isNaN(num) ? undefined : num;
}

/**
 * Formatea tasa para mostrar como string con dos decimales.
 */
export function formatearTasa(valor: number | string): string {
  const num =
    typeof valor === "string" ? parseFloat(valor.replace(",", ".")) : valor;

  return isNaN(num) ? "" : num.toFixed(2);
}

/**
 * Sanitiza monto ingresado como texto, acepta coma, punto y elimina símbolos.
 * Ejemplo: "Bs. 12,5" → 12.5
 */
export function parsearMonto(valor: string): number {
  const limpio = valor.replace(",", ".").replace(/[^\d.]/g, "");

  const num = parseFloat(limpio);
  return isNaN(num) ? 0 : num;
}
