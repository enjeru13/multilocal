import apiClient from "../utils/apiClient";
import type { AlertasPresupuestos, EstadoPresupuesto, Presupuesto, PresupuestoInput } from "@lavanderia/shared/types/types";

export const presupuestosService = {
  getAll: (params: { estado?: string; q?: string; clienteId?: number } = {}): Promise<{ data: Presupuesto[] }> => apiClient.get("/presupuestos", { params }),
  alertas: (): Promise<{ data: AlertasPresupuestos }> => apiClient.get("/presupuestos/alertas"),
  getById: (id: number): Promise<{ data: Presupuesto }> => apiClient.get(`/presupuestos/${id}`),
  create: (data: PresupuestoInput): Promise<{ data: Presupuesto }> => apiClient.post("/presupuestos", data),
  update: (id: number, data: PresupuestoInput): Promise<{ data: Presupuesto }> => apiClient.put(`/presupuestos/${id}`, data),
  cambiarEstado: (id: number, estado: Exclude<EstadoPresupuesto, "CONVERTIDO">): Promise<{ data: Presupuesto }> =>
    apiClient.patch(`/presupuestos/${id}/estado`, { estado }),
  convertir: (id: number, clienteId?: number): Promise<{ data: { presupuesto: Presupuesto; ordenId: number } }> =>
    apiClient.post(`/presupuestos/${id}/convertir`, clienteId ? { clienteId } : {}),
  eliminar: (id: number) => apiClient.delete(`/presupuestos/${id}`),
};
