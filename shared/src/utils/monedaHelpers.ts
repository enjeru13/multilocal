export type Moneda = "USD" | "VES" | "COP";

export interface TasasConversion {
  VES?: number | null;
  COP?: number | null;
}

/** Convierte cualquier valor a una moneda soportada (por defecto USD). */
export function normalizarMoneda(input: unknown): Moneda {
  const valor = String(input).toUpperCase();
  if (valor === "VES") return "VES";
  if (valor === "COP") return "COP";
  return "USD";
}

/**
 * Convierte un monto hacia la moneda principal, usando tasas (unidades de
 * la moneda por 1 USD). Sin tasa válida devuelve 0: nunca convierte 1:1.
 * Ejemplo: Bs 80 / tasa VES -> USD
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
 * Ejemplo: USD -> Bs (VES) * tasa VES
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
 * COP sin decimales cuando el monto es entero.
 */
export function formatearMoneda(monto: number, moneda: Moneda = "USD"): string {
  const opciones: Intl.NumberFormatOptions = {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  let locale = "en-US";
  if (moneda === "VES") {
    locale = "es-VE";
  } else if (moneda === "COP") {
    locale = "es-CO";
    if (Number.isInteger(monto)) {
      opciones.minimumFractionDigits = 0;
      opciones.maximumFractionDigits = 0;
    }
  }

  return new Intl.NumberFormat(locale, opciones).format(monto);
}

/**
 * Convierte string de tasa (con coma decimal o miles) en número válido.
 * Ejemplo: "2,500.00" -> 2500, "3.5" -> 3.5
 */
export function parsearTasa(valor: string): number | undefined {
  if (!valor) return undefined;
  const normalizado = valor.replace(",", ".");
  const limpio = normalizado.replace(/(?<=\d)\.(?=\d{3})/g, "");
  const num = parseFloat(limpio);
  return isNaN(num) ? undefined : num;
}

/** Formatea una tasa con dos decimales. */
export function formatearTasa(valor: number | string): string {
  const num =
    typeof valor === "string" ? parseFloat(valor.replace(",", ".")) : valor;

  return isNaN(num) ? "" : num.toFixed(2);
}

/**
 * Interpreta un monto escrito por el usuario según la convención de la
 * moneda: en VES/COP el punto separa miles y la coma es el decimal
 * ("1.234,50"); en USD la coma separa miles ("1,234.50"). Ignora símbolos
 * ("Bs.", "$") y texto.
 */
export function parsearMonto(valor: string, moneda: Moneda = "USD"): number {
  if (!valor) return 0;

  let limpio = valor.replace(/[^\d.,-]/g, "").replace(/^[.,]+/, "");

  if (moneda === "VES" || moneda === "COP") {
    limpio = limpio.replace(/\./g, "").replace(/,/g, ".");
  } else {
    limpio = limpio.replace(/,/g, "");
  }

  const num = parseFloat(limpio);
  return isNaN(num) ? 0 : num;
}
