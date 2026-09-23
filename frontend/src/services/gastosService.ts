import apiClient from "../utils/apiClient";
import type { Gasto, GastoCreate, GastosListado } from "@lavanderia/shared/types/types";

export const gastosService = {
  listar: (desde: string, hasta: string): Promise<{ data: GastosListado }> =>
    apiClient.get("/gastos", { params: { desde, hasta } }),
  crear: (data: GastoCreate): Promise<{ data: Gasto }> => apiClient.post("/gastos", data),
  eliminar: (id: number): Promise<void> => apiClient.delete(`/gastos/${id}`),
};
