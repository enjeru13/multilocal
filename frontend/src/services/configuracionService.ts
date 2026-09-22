import apiClient from "../utils/apiClient";
import type {
  Configuracion,
  ConfiguracionUpdatePayload,
} from "@lavanderia/shared/types/types";

export const configuracionService = {
  /**
   * @returns
   */
  get: (): Promise<{ data: Configuracion }> => apiClient.get("/configuracion"),

  /**
   * @param data
   * @returns
   */
  update: (data: ConfiguracionUpdatePayload) =>
    apiClient.put<Configuracion>("/configuracion", data),
};
