import apiClient from "../utils/apiClient";
import type {
  Proveedor,
  ProveedorCreate,
  ProveedorUpdatePayload,
} from "@lavanderia/shared/types/types";

export const proveedoresService = {
  getAll: (): Promise<{ data: Proveedor[] }> => apiClient.get("/proveedores"),
  getById: (id: number): Promise<{ data: Proveedor }> =>
    apiClient.get(`/proveedores/${id}`),
  create: (data: ProveedorCreate): Promise<{ data: Proveedor }> =>
    apiClient.post("/proveedores", data),
  update: (
    id: number,
    data: ProveedorUpdatePayload
  ): Promise<{ data: Proveedor }> => apiClient.put(`/proveedores/${id}`, data),
  delete: (id: number): Promise<void> => apiClient.delete(`/proveedores/${id}`),
};
