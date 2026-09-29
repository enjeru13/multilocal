import apiClient from "../utils/apiClient";

export const correoService = {
  enviar: (datos: { para: string; asunto: string; html: string; texto?: string }): Promise<{ data: { ok: true } }> => apiClient.post("/correo/enviar", datos),
};
