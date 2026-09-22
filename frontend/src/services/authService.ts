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
      if (response.data.token) {
        localStorage.setItem("authToken", response.data.token);
      }
      return response.data;
    } catch (error) {
      console.error("Error en el login:", error);
      throw error;
    }
  },
  logout: () => {
    localStorage.removeItem("authToken");
  },

  /**
   * @param password
   * @returns
   */
  validarAdminPassword: async (password: string): Promise<boolean> => {
    try {
      const response = await apiClient.post("/auth/validate-admin-password", {
        password,
      });
      return response.status === 200 && response.data.isValid === true;
    } catch (error) {
      console.error("Error al validar contraseña de administrador:", error);
      return false;
    }
  },
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await apiClient.get("/auth/me");
      return response.data.user;
    } catch (error) {
      console.error("Error al obtener el usuario actual:", error);
      localStorage.removeItem("authToken");
      return null;
    }
  },
};
