/** Tamaños de etiqueta y ayudas para el código de barras. Medidas en milímetros. */

export interface FormatoEtiqueta {
  id: string;
  etiqueta: string;
  /** Ancho y alto de cada etiqueta. */
  ancho: number;
  alto: number;
  /** Rollo: una etiqueta por "página" del tamaño exacto. Hoja: cuadrícula sobre papel A4. */
  tipo: "rollo" | "hoja";
  columnas?: number;
  filas?: number;
  /** Margen de la hoja (arriba e izquierda) hasta la primera etiqueta. */
  margenSup?: number;
  margenIzq?: number;
}

export const FORMATOS_ETIQUETA: FormatoEtiqueta[] = [
  { id: "rollo-40x25", etiqueta: "Rollo · 40 × 25 mm", ancho: 40, alto: 25, tipo: "rollo" },
  { id: "rollo-50x30", etiqueta: "Rollo · 50 × 30 mm", ancho: 50, alto: 30, tipo: "rollo" },
  { id: "rollo-60x40", etiqueta: "Rollo · 60 × 40 mm", ancho: 60, alto: 40, tipo: "rollo" },
  { id: "hoja-3x8", etiqueta: "Hoja A4 · 3 × 8 (70 × 37 mm)", ancho: 70, alto: 37, tipo: "hoja", columnas: 3, filas: 8, margenSup: 0, margenIzq: 0 },
  { id: "hoja-4x11", etiqueta: "Hoja A4 · 4 × 11 (48,5 × 25,4 mm)", ancho: 48.5, alto: 25.4, tipo: "hoja", columnas: 4, filas: 11, margenSup: 8.8, margenIzq: 8 },
];

export type FormatoCodigo = "EAN13" | "UPC" | "CODE128";

/** 13 dígitos suele ser EAN-13; 12, UPC-A; cualquier otro código (SKU con letras, etc.) va en Code 128. */
export function formatoDeCodigo(valor: string): FormatoCodigo {
  if (/^\d{13}$/.test(valor)) return "EAN13";
  if (/^\d{12}$/.test(valor)) return "UPC";
  return "CODE128";
}

/** El código que se imprime: el de barras si lo hay; si no, el código o SKU del producto. */
export const codigoDeProducto = (p: { codigoBarras?: string | null; sku?: string | null }) => (p.codigoBarras || p.sku || "").trim();
