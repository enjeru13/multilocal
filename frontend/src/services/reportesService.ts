import apiClient from "../utils/apiClient";
import type { CuentasPorCobrar, DashboardData, ReporteResumen } from "@lavanderia/shared/types/types";

export const reportesService = {
  dashboard: (): Promise<{ data: DashboardData }> => apiClient.get("/reportes/dashboard"),

  resumen: (desde: string, hasta: string): Promise<{ data: ReporteResumen }> =>
    apiClient.get("/reportes/resumen", { params: { desde, hasta } }),

  porCobrar: (): Promise<{ data: CuentasPorCobrar }> => apiClient.get("/reportes/por-cobrar"),
};
