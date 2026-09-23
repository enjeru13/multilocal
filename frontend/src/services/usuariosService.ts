import apiClient from "../utils/apiClient";
import type { Role } from "@lavanderia/shared/types/types";

export interface Usuario {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  activo: boolean;
  createdAt: string;
}

export const usuariosService = {
  getAll: (): Promise<{ data: Usuario[] }> => apiClient.get("/usuarios"),
  create: (data: { email: string; password: string; name: string; role: Role }) =>
    apiClient.post<Usuario>("/usuarios", data),
  update: (
    id: number,
    data: Partial<{ name: string; role: Role; activo: boolean; password: string }>
  ) => apiClient.put<Usuario>(`/usuarios/${id}`, data),
  cambiarMiPassword: (passwordActual: string, passwordNueva: string) =>
    apiClient.post("/auth/change-password", { passwordActual, passwordNueva }),
};
