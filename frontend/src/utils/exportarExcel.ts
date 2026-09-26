import writeExcelFile from "write-excel-file/browser";

/** Exportación a Excel (.xlsx) desde el navegador: números como números, títulos en negrita y columnas con ancho. */

export type ValorCelda = string | number | boolean | Date | null | undefined;

export interface ColumnaExcel<T> {
  titulo: string;
  /** Ancho en caracteres. */
  ancho?: number;
  valor: (fila: T) => ValorCelda;
  /** Formato de número, p. ej. "#,##0.00". */
  formato?: string;
}

export const fechaArchivo = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function exportarExcel<T extends object>(archivo: string, hoja: string, columnas: ColumnaExcel<T>[], filas: T[]) {
  const columnasExcel = columnas.map((c) => ({
    header: { value: c.titulo, fontWeight: "bold" as const },
    width: c.ancho ?? Math.max(12, c.titulo.length + 4),
    cell: (fila: T) => {
      const v = c.valor(fila);
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "number") return { value: v, type: Number, ...(c.formato ? { format: c.formato } : {}) };
      if (v instanceof Date) return { value: v, type: Date, format: "dd/mm/yyyy" };
      if (typeof v === "boolean") return { value: v, type: Boolean };
      return { value: String(v) };
    },
  }));
  await writeExcelFile(filas, { columns: columnasExcel, sheet: hoja }).toFile(archivo);
}
