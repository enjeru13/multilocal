import apiClient from "../utils/apiClient";
import type {
  Servicio,
  ServicioCreate,
  ServicioUpdatePayload,
  Categoria,
} from "@lavanderia/shared/types/types";
export interface ServicioConCategoria extends Servicio {
  categoria: Categoria;
}

export interface FilaImportacion {
  fila: number;
  nombre?: string | number | boolean | null;
  sku?: string | number | boolean | null;
  codigoBarras?: string | number | boolean | null;
  precio?: string | number | boolean | null;
  costo?: string | number | boolean | null;
  stock?: string | number | boolean | null;
  stockMinimo?: string | number | boolean | null;
  categoria?: string | number | boolean | null;
  unidad?: string | number | boolean | null;
  exento?: string | number | boolean | null;
  descripcion?: string | number | boolean | null;
}

export interface FilaImportada {
  fila: number;
  accion: "CREAR" | "ACTUALIZAR" | "ERROR";
  nombre: string;
  errores: string[];
  avisos: string[];
  coincide?: { id: number; nombre: string; por: "código" | "código de barras" | "nombre" };
  cambios?: string[];
}

export interface ResultadoImportacion {
  resumen: { total: number; crear: number; actualizar: number; sinCambios: number; errores: number };
  filas: FilaImportada[];
  aplicado: boolean;
}

export const servicioService = {
  /** Con simular=true solo revisa el archivo; con false lo guarda. */
  importar: (filas: FilaImportacion[], moneda: string, simular: boolean): Promise<{ data: ResultadoImportacion }> =>
    apiClient.post("/servicios/importar", { filas, moneda, simular }),

  /**
   * @returns
   */
  getAll: (): Promise<{ data: ServicioConCategoria[] }> =>
    apiClient.get("/servicios"),

  /**
   * @param id
   * @returns
   */
  getById: (id: number): Promise<{ data: ServicioConCategoria }> =>
    apiClient.get(`/servicios/${id}`),

  /**
   * @param data
   * @returns
   */
  create: (data: ServicioCreate): Promise<{ data: ServicioConCategoria }> =>
    apiClient.post("/servicios", data),

  /**
   * @param id
   * @param data
   * @returns
   */
  update: (
    id: number,
    data: ServicioUpdatePayload
  ): Promise<{ data: ServicioConCategoria }> =>
    apiClient.put(`/servicios/${id}`, data),

  /**
   * @param id
   * @returns
   */
  delete: (id: number): Promise<void> => apiClient.delete(`/servicios/${id}`),

  /** Sube la foto del producto (reemplaza la anterior si tenía). */
  subirImagen: (id: number, archivo: File): Promise<{ data: ServicioConCategoria }> => {
    const form = new FormData();
    form.append("imagen", archivo);
    return apiClient.post(`/servicios/${id}/imagen`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },

  eliminarImagen: (id: number): Promise<{ data: ServicioConCategoria }> => apiClient.delete(`/servicios/${id}/imagen`),

  /** Sube o baja precios en %. Con simular=true solo devuelve qué cambiaría. */
  ajustarPrecios: (datos: {
    porcentaje: number;
    categoriaId?: string | null;
    redondeo: "CENTAVOS" | "ENTERO" | "MEDIO";
    simular: boolean;
  }): Promise<{
    data: {
      aplicado: boolean;
      cantidad: number;
      ejemplos: { id: number; nombre: string; antes: number; despues: number }[];
    };
  }> => apiClient.post("/servicios/ajuste-precios", datos),
};
