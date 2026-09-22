import apiClient from "../utils/apiClient";
import type {
  DetalleOrden,
  DetalleOrdenCreate,
  DetalleOrdenUpdatePayload,
} from "@lavanderia/shared/types/types";

export const detalleOrdenService = {
  /**
   * @param ordenId
   * @returns
   */
  getByOrdenId: (ordenId: number) =>
    apiClient.get<DetalleOrden[]>(
      `/detalleOrdenes/by-order?ordenId=${ordenId}`
    ),

  /**
   * @param detalleId
   * @returns
   */
  getById: (detalleId: number) =>
    apiClient.get<DetalleOrden>(`/detalleOrdenes/${detalleId}`),

  /**
   * @param data
   * @returns
   */
  create: (data: DetalleOrdenCreate) =>
    apiClient.post<DetalleOrden>("/detalleOrdenes", data),

  /**
   * @param detalleId
   * @param data
   * @returns
   */
  update: (detalleId: number, data: DetalleOrdenUpdatePayload) =>
    apiClient.put<DetalleOrden>(`/detalleOrdenes/${detalleId}`, data),

  /**
   * @param detalleId
   * @returns
   */
  delete: (detalleId: number) =>
    apiClient.delete<void>(`/detalleOrdenes/${detalleId}`),
};
