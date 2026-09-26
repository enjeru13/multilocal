import readExcelFile from "read-excel-file/browser";

/** Lectura de hojas de cálculo (xlsx y csv) y ayuda para reconocer sus columnas. Todo ocurre en el navegador. */

export type Celda = string | number | boolean | null;
export type FilaArchivo = Celda[];

export interface HojaLeida {
  nombre: string;
  filas: FilaArchivo[];
}

export type CampoId = "nombre" | "sku" | "codigoBarras" | "precio" | "costo" | "stock" | "stockMinimo" | "categoria" | "unidad" | "exento" | "descripcion";

export interface CampoImportable {
  id: CampoId;
  etiqueta: string;
  ayuda: string;
  obligatorio?: boolean;
  /** Títulos de columna que suelen significar este dato (sin acentos ni mayúsculas). */
  sinonimos: string[];
}

// El orden importa al reconocer columnas: los más específicos primero ("precio compra" es costo, no precio).
export const CAMPOS: CampoImportable[] = [
  { id: "nombre", etiqueta: "Nombre del producto", ayuda: "Cómo se llama en tu catálogo.", obligatorio: true, sinonimos: ["nombre", "producto", "articulo", "item", "descripcion", "denominacion", "detalle"] },
  { id: "precio", etiqueta: "Precio de venta", ayuda: "Lo que paga el cliente.", obligatorio: true, sinonimos: ["precio venta", "precio de venta", "p venta", "pvp", "precio unitario", "precio", "valor", "price"] },
  { id: "sku", etiqueta: "Código / SKU / referencia", ayuda: "Sirve para reconocer el producto si vuelves a importar.", sinonimos: ["sku", "codigo interno", "codigo", "cod", "referencia", "ref", "numero de parte", "nro parte", "part number"] },
  { id: "codigoBarras", etiqueta: "Código de barras", ayuda: "El que lee el escáner.", sinonimos: ["codigo de barras", "codigo barras", "codigo barra", "barras", "ean", "upc", "barcode"] },
  { id: "costo", etiqueta: "Costo", ayuda: "Lo que te cuesta a ti. Permite calcular la ganancia.", sinonimos: ["precio compra", "precio de compra", "p compra", "costo unitario", "precio de costo", "costo", "cost"] },
  { id: "stock", etiqueta: "Existencias", ayuda: "Cuántas unidades tienes ahora.", sinonimos: ["existencias", "existencia", "stock", "inventario", "disponible", "cantidad", "cant"] },
  { id: "stockMinimo", etiqueta: "Mínimo", ayuda: "Por debajo de esto el sistema avisa que hay que reponer.", sinonimos: ["stock minimo", "existencia minima", "minimo", "min", "punto de reorden", "reorden"] },
  { id: "categoria", etiqueta: "Categoría", ayuda: "Las que no existan se crean solas.", sinonimos: ["categoria", "rubro", "familia", "linea", "grupo", "departamento", "tipo"] },
  { id: "unidad", etiqueta: "Unidad", ayuda: "unidad, kg, litro, metro… (kg, litro y metro admiten decimales).", sinonimos: ["unidad de medida", "unidad", "und", "um", "medida"] },
  { id: "exento", etiqueta: "Exento de impuesto", ayuda: "Sí o No.", sinonimos: ["exento", "exonerado", "iva", "impuesto"] },
  { id: "descripcion", etiqueta: "Descripción adicional", ayuda: "Texto largo opcional.", sinonimos: ["descripcion larga", "observaciones", "notas", "nota"] },
];

const ORDEN_DETECCION: CampoId[] = ["codigoBarras", "stockMinimo", "costo", "precio", "stock", "sku", "categoria", "unidad", "exento", "descripcion", "nombre"];

export const normalizarTitulo = (t: unknown) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Para cada dato, el índice de la columna que parece ser (o null). Cada columna se usa una sola vez. */
export function detectarColumnas(titulos: Celda[]): Record<CampoId, number | null> {
  const norm = titulos.map(normalizarTitulo);
  const usadas = new Set<number>();
  const mapa = Object.fromEntries(CAMPOS.map((c) => [c.id, null])) as Record<CampoId, number | null>;

  const coincide = (titulo: string, sinonimo: string) => titulo === sinonimo || ` ${titulo} `.includes(` ${sinonimo} `);

  for (const id of ORDEN_DETECCION) {
    const campo = CAMPOS.find((c) => c.id === id)!;
    // Primero el sinónimo exacto o más específico; así "código de barras" no se lo lleva "código".
    for (const s of campo.sinonimos) {
      const i = norm.findIndex((t, idx) => !usadas.has(idx) && t !== "" && coincide(t, s));
      if (i >= 0) {
        mapa[id] = i;
        usadas.add(i);
        break;
      }
    }
  }
  return mapa;
}

/** Primera fila que parece un encabezado: la primera con al menos dos celdas de texto. */
export function detectarEncabezado(filas: FilaArchivo[]): number {
  const i = filas.findIndex((f) => f.filter((c) => typeof c === "string" && c.trim() !== "").length >= 2);
  return i < 0 ? 0 : i;
}

// ---- CSV ----

function detectarSeparador(texto: string): string {
  const muestra = texto.split(/\r?\n/).slice(0, 5).join("\n");
  const cuenta = (s: string) => (muestra.match(new RegExp(s === "\t" ? "\\t" : `\\${s}`, "g")) ?? []).length;
  return [";", ",", "\t", "|"].map((s) => [s, cuenta(s)] as const).sort((a, b) => b[1] - a[1])[0][0];
}

/** Lector de CSV con comillas, saltos de línea dentro de comillas y separador ; , tabulador o |. */
export function parsearCsv(texto: string): FilaArchivo[] {
  const limpio = texto.replace(/^\uFEFF/, "");
  const sep = detectarSeparador(limpio);
  const filas: FilaArchivo[] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  const cerrarCelda = () => {
    fila.push(celda);
    celda = "";
  };
  const cerrarFila = () => {
    cerrarCelda();
    filas.push(fila);
    fila = [];
  };

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) cerrarCelda();
    else if (c === "\n") cerrarFila();
    else if (c !== "\r") celda += c;
  }
  if (celda !== "" || fila.length > 0) cerrarFila();
  return filas.map((f) => f.map((c) => (c === "" ? null : c)));
}

// ---- Archivo ----

const aTexto = (c: unknown): Celda => {
  if (c === null || c === undefined) return null;
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === "number" || typeof c === "boolean") return c;
  return String(c);
};

export async function leerArchivo(archivo: File): Promise<HojaLeida[]> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".xls")) {
    throw new Error("Los archivos .xls (Excel antiguo) no se pueden leer. Ábrelo en Excel y guárdalo como .xlsx o como CSV.");
  }
  if (nombre.endsWith(".xlsx")) {
    const hojas = await readExcelFile(archivo);
    return hojas.map((h) => ({ nombre: h.sheet, filas: h.data.map((f) => f.map(aTexto)) })).filter((h) => h.filas.length > 0);
  }
  if (nombre.endsWith(".csv") || nombre.endsWith(".txt") || archivo.type.startsWith("text/")) {
    const buffer = await archivo.arrayBuffer();
    let texto = new TextDecoder("utf-8").decode(buffer);
    // Excel en español suele guardar el CSV en Windows-1252: si sobran «�», se relee así.
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buffer);
    return [{ nombre: "Archivo", filas: parsearCsv(texto) }];
  }
  throw new Error("Formato no admitido. Usa un archivo Excel (.xlsx) o CSV.");
}

/** CSV de ejemplo con las columnas recomendadas (separador ; y BOM para que Excel lo abra bien). */
export function plantillaCsv(): string {
  const filas = [
    ["Nombre", "Código", "Código de barras", "Precio", "Costo", "Existencias", "Mínimo", "Categoría", "Unidad", "Exento", "Descripción"],
    ["Filtro de aceite Toyota", "FA-001", "7591234000012", "12,50", "8,00", "20", "5", "Filtros", "unidad", "No", ""],
    ["Aceite 20W50", "AC-020", "", "9,00", "6,50", "12,5", "4", "Lubricantes", "litro", "No", "Mineral multigrado"],
  ];
  return "\uFEFF" + filas.map((f) => f.map((c) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
}

export function descargarTexto(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
