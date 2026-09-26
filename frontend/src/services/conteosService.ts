import apiClient from "../utils/apiClient";
import type { ConteoDetalle, ConteoInventario } from "@lavanderia/shared/types/types";

export const conteosService = {
  getAll: (): Promise<{ data: ConteoInventario[] }> => apiClient.get("/conteos"),
  getById: (id: number): Promise<{ data: ConteoInventario }> => apiClient.get(`/conteos/${id}`),
  crear: (data: { nombre?: string; categoriaId?: string | null }): Promise<{ data: ConteoInventario }> => apiClient.post("/conteos", data),
  /** modo "sumar": una lectura más del escáner; "fijar": reemplaza lo contado. */
  contar: (id: number, servicioId: number, cantidad: number, modo: "fijar" | "sumar" = "fijar"): Promise<{ data: ConteoDetalle }> =>
    apiClient.put(`/conteos/${id}/items`, { servicioId, cantidad, modo }),
  quitar: (id: number, servicioId: number) => apiClient.delete(`/conteos/${id}/items/${servicioId}`),
  aplicar: (id: number): Promise<{ data: ConteoInventario }> => apiClient.post(`/conteos/${id}/aplicar`),
  cancelar: (id: number) => apiClient.post(`/conteos/${id}/cancelar`),
};
