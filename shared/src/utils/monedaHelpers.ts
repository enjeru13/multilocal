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

const AGRUPAR = /\B(?=(\d{3})+(?!\d))/g;

/** Separadores de la convención de cada moneda: USD "1,234.50"; VES/COP "1.234,50". */
function separadores(moneda: Moneda) {
  return moneda === "USD" ? { dec: ".", mil: "," } : { dec: ",", mil: "." };
}

/**
 * Texto de un monto listo para un campo de entrada: con separador de miles y
 * sin ceros decimales sobrantes. Es el inverso de `parsearMonto`.
 * Ejemplo: (1500.5, "VES") -> "1.500,5"
 */
export function montoAEntrada(n: number, moneda: Moneda = "USD"): string {
  if (typeof n !== "number" || !isFinite(n)) return "";
  const r = moneda === "COP" ? Math.round(n) : Math.round(n * 100) / 100;
  const { dec, mil } = separadores(moneda);
  const [entero, fraccion = ""] = r.toFixed(2).split(".");
  const miles = entero.replace(AGRUPAR, mil);
  const sobrante = fraccion.replace(/0+$/, "");
  return sobrante ? `${miles}${dec}${sobrante}` : miles;
}

/**
 * Da formato al texto de un campo de monto mientras se escribe: agrupa los
 * miles ("1.500.000") y deja como máximo dos decimales. Acepta "." o "," como
 * decimal al teclearlo al final, y al pegar "1500.50" lo entiende como decimal.
 * `previo` es el texto anterior del campo: distingue teclear de borrar o pegar.
 */
export function formatearEntradaMonto(raw: string, moneda: Moneda = "USD", previo = ""): string {
  const { dec, mil } = separadores(moneda);
  const teclado = raw.length === previo.length + 1;
  const pegado = raw.length > previo.length + 1;

  let posDec = raw.indexOf(dec);
  if (posDec < 0) {
    const ultimo = raw.lastIndexOf(mil);
    if (ultimo >= 0) {
      const cola = raw.slice(ultimo + 1);
      const escribioAlFinal = teclado && ultimo === raw.length - 1;
      if (escribioAlFinal || (pegado && /^\d{1,2}$/.test(cola))) posDec = ultimo;
    }
  }

  const soloDigitos = (t: string) => t.replace(/\D/g, "");
  let entero = soloDigitos(posDec < 0 ? raw : raw.slice(0, posDec)).replace(/^0+(?=\d)/, "");
  const fraccion = posDec < 0 ? null : soloDigitos(raw.slice(posDec + 1)).slice(0, 2);

  if (entero === "" && fraccion === null) return "";
  if (entero === "") entero = "0";
  return entero.replace(AGRUPAR, mil) + (fraccion !== null ? dec + fraccion : "");
}
