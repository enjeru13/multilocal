import apiClient from "../utils/apiClient";

export interface Respaldo {
  nombre: string;
  tipo: "auto" | "manual" | "previo-a-restauracion" | "otro";
  tamano: number;
  fecha: string;
}

export const respaldosService = {
  listar: (): Promise<{ data: Respaldo[] }> => apiClient.get("/respaldos"),
  crear: () => apiClient.post<{ nombre: string }>("/respaldos/crear"),
  descargar: async (nombre: string) => {
    const res = await apiClient.get(`/respaldos/${encodeURIComponent(nombre)}/descargar`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  },
  restaurar: (nombre: string) =>
    apiClient.post(`/respaldos/restaurar/${encodeURIComponent(nombre)}`),
  restaurarArchivo: (archivo: File) =>
    apiClient.post("/respaldos/restaurar-archivo", archivo, {
      headers: { "Content-Type": "application/octet-stream" },
      maxBodyLength: Infinity,
    }),
};
