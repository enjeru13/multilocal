import apiClient from "../utils/apiClient";
import type { Compra, CompraCreate } from "@lavanderia/shared/types/types";

export const comprasService = {
  getAll: (): Promise<{ data: Compra[] }> => apiClient.get("/compras"),
  getById: (id: number): Promise<{ data: Compra }> =>
    apiClient.get(`/compras/${id}`),
  create: (data: CompraCreate): Promise<{ data: Compra }> =>
    apiClient.post("/compras", data),
  recibir: (id: number): Promise<{ data: Compra }> =>
    apiClient.patch(`/compras/${id}/recibir`),
  cancelar: (id: number): Promise<{ data: Compra }> =>
    apiClient.patch(`/compras/${id}/cancelar`),
};
