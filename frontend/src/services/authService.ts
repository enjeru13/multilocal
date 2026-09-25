import apiClient from "../utils/apiClient";
import type {
  User,
  UserLoginPayload,
  UserRegisterPayload,
} from "@lavanderia/shared/types/types";
interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export const authService = {
  /**
   * @param data
   * @returns
   */
  register: async (data: UserRegisterPayload): Promise<AuthResponse> => {
    const response = await apiClient.post("/auth/register", data);
    return response.data;
  },

  /**
   * @param data
   * @returns
   */
  login: async (data: UserLoginPayload): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post("/auth/login", data);
      return response.data;
    } catch (error) {
      console.error("Error en el login:", error);
      throw error;
    }
  },

  getBranding: async (): Promise<{ nombreNegocio: string | null; rubro: string | null }> => {
    try {
      const response = await apiClient.get("/auth/branding");
      return response.data;
    } catch {
      return { nombreNegocio: null, rubro: null };
    }
  },

  getSetupStatus: async (): Promise<boolean> => {
    try {
      const response = await apiClient.get("/auth/setup-status");
      return !!response.data.needsSetup;
    } catch (error) {
      console.error("Error al verificar estado de configuración inicial:", error);
      return false;
    }
  },
  /** ¿Pide el servidor un código de instalación para crear la cuenta inicial? (solo en la nube) */
  requiereCodigoInstalacion: async (): Promise<boolean> => {
    try {
      const response = await apiClient.get("/auth/setup-status");
      return !!response.data.requiereCodigo;
    } catch {
      return false;
    }
  },
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await apiClient.get("/auth/me");
      return response.data.user;
    } catch (error) {
      console.error("Error al obtener el usuario actual:", error);
      return null;
    }
  },
};
