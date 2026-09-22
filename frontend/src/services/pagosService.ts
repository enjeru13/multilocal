import apiClient from "../utils/apiClient";
import type {
  Pago,
  PagoCreate,
  PagoUpdatePayload,
} from "@lavanderia/shared/types/types";

export const pagosService = {
  /**
   * @param data
   * @returns
   */
  create: (data: PagoCreate): Promise<{ data: Pago }> =>
    apiClient.post("/pagos", data),

  /**
   * @returns
   */
  getAll: (): Promise<{ data: Pago[] }> => apiClient.get("/pagos"),

  /**
   * @param id
   * @returns
   */
  getById: (id: number): Promise<{ data: Pago }> =>
    apiClient.get(`/pagos/${id}`),

  /**
   * @param id
   * @param data
   * @returns
   */
  update: (id: number, data: PagoUpdatePayload): Promise<{ data: Pago }> =>
    apiClient.put(`/pagos/${id}`, data),

  /**
   * @param id
   * @returns
   */
  delete: (id: number): Promise<void> => apiClient.delete(`/pagos/${id}`),
};
