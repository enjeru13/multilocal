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
};
