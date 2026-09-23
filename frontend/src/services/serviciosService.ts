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

export const servicioService = {
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
