import apiClient from "../utils/apiClient";
import { Categoria } from "@lavanderia/shared/types/types";

export const categoriasService = {
  getAll: async (): Promise<{ data: Categoria[] }> => {
    const timestamp = new Date().getTime();
    const response = await apiClient.get(`/categorias?_t=${timestamp}`);
    return response.data;
  },

  getById: async (id: string): Promise<{ data: Categoria }> => {
    const timestamp = new Date().getTime();
    const response = await apiClient.get(`/categorias/${id}?_t=${timestamp}`);
    return response.data;
  },

  create: async (data: { nombre: string }): Promise<{ data: Categoria }> => {
    const response = await apiClient.post("/categorias", data);
    return response.data;
  },

  update: async (
    id: string,
    data: { nombre: string }
  ): Promise<{ data: Categoria }> => {
    const response = await apiClient.put(`/categorias/${id}`, data);
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/categorias/${id}`);
  },
};
