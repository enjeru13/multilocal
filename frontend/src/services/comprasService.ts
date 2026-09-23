import apiClient from "../utils/apiClient";
import type { Compra, CompraCreate, CuentasPorPagar, PagoCompraCreate } from "@lavanderia/shared/types/types";

export const comprasService = {
  getAll: (): Promise<{ data: Compra[] }> => apiClient.get("/compras"),
  getById: (id: number): Promise<{ data: Compra }> =>
    apiClient.get(`/compras/${id}`),
  create: (data: CompraCreate): Promise<{ data: Compra }> =>
    apiClient.post("/compras", data),
  porPagar: (): Promise<{ data: CuentasPorPagar }> => apiClient.get("/compras/por-pagar"),
  pagar: (id: number, data: PagoCompraCreate): Promise<{ data: Compra }> =>
    apiClient.post(`/compras/${id}/pagos`, data),
  recibir: (id: number): Promise<{ data: Compra }> =>
    apiClient.patch(`/compras/${id}/recibir`),
  cancelar: (id: number): Promise<{ data: Compra }> =>
    apiClient.patch(`/compras/${id}/cancelar`),
};
