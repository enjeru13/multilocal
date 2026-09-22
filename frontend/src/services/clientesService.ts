import apiClient from "../utils/apiClient";
import type {
  Cliente,
  ClienteCreate,
  ClienteUpdatePayload,
} from "@lavanderia/shared/types/types";

export const clientesService = {
  getAll: () => apiClient.get<Cliente[]>("/clientes"),

  getById: (id: number) => apiClient.get<Cliente>(`/clientes/${id}`),

  create: (data: ClienteCreate) => apiClient.post<Cliente>("/clientes", data),

  update: (id: number, data: ClienteUpdatePayload) =>
    apiClient.put<Cliente>(`/clientes/${id}`, data),

  delete: (id: number) => apiClient.delete<void>(`/clientes/${id}`),
};
