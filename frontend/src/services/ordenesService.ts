import apiClient from "../utils/apiClient";
import type {
  Orden,
  Pago,
  OrdenCreate,
  OrdenUpdatePayload,
  DevolucionCreate,
} from "@lavanderia/shared/types/types";

const API_URL = "/ordenes";

interface UpdateObservacionPayload {
  observaciones: string | null;
}

export const ordenesService = {
  /**
   * @returns
   */
  getAll: () => {
    return apiClient.get<Orden[]>(API_URL);
  },

  /**
   * @param id
   * @returns
   */
  getById: (id: number) => {
    return apiClient.get<Orden>(`${API_URL}/${id}`);
  },

  /**
   * @param orden
   * @returns
   */
  create: (orden: OrdenCreate) => {
    return apiClient.post<Orden>(API_URL, orden);
  },

  /**
   * Actualiza una orden existente.
   * @param id
   * @param orden
   * @returns
   */
  update: (id: number, orden: OrdenUpdatePayload) => {
    return apiClient.put<Orden>(`${API_URL}/${id}`, orden);
  },

  /**
   * @param id
   * @returns
   */
  delete: (id: number) => {
    return apiClient.delete(`${API_URL}/${id}`);
  },

  /** Devolución parcial de una venta (ADMIN/EMPLOYEE). */
  devolver: (id: number, datos: DevolucionCreate) => {
    return apiClient.post<Orden>(`${API_URL}/${id}/devolucion`, datos);
  },

  anular: (id: number) => {
    return apiClient.patch<Orden>(`${API_URL}/${id}/anular`);
  },

  /**
   * @param id
   * @param observaciones
   * @returns
   */
  updateObservacion: (id: number, observaciones: string | null) => {
    const payload: UpdateObservacionPayload = { observaciones };
    return apiClient.patch<Orden>(`${API_URL}/${id}/observacion`, payload);
  },

  /**
   * @param ordenId
   * @param pago
   * @returns
   */
  createPago: (ordenId: number, pago: Partial<Pago>) => {
    return apiClient.post<Orden>(`${API_URL}/${ordenId}/pagos`, pago);
  },
};
