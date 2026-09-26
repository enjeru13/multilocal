import apiClient from "../utils/apiClient";

export interface Respaldo {
  nombre: string;
  tipo: "auto" | "manual" | "previo-a-restauracion" | "otro";
  tamano: number;
  fecha: string;
}

export interface ResumenLegado {
  categorias: number;
  clientes: number;
  servicios: number;
  ordenes: number;
  detalles: number;
  pagos: number;
  vueltos: number;
  usuarios: number;
  negocio: string | null;
  abonadosCorregidos: number;
}

const binario = { headers: { "Content-Type": "application/octet-stream" }, maxBodyLength: Infinity } as const;

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
  /** Cuenta lo que trae un respaldo del sistema anterior, sin importar nada. */
  revisarLegado: (archivo: File): Promise<{ data: { resumen: ResumenLegado } }> =>
    apiClient.post("/respaldos/importar-legado?simular=1", archivo, binario),
  /** Reemplaza todos los datos actuales por los del sistema anterior. */
  importarLegado: (archivo: File): Promise<{ data: { resumen: ResumenLegado; respaldoPrevio: string } }> =>
    apiClient.post("/respaldos/importar-legado", archivo, binario),
  restaurarArchivo: (archivo: File) =>
    apiClient.post("/respaldos/restaurar-archivo", archivo, {
      headers: { "Content-Type": "application/octet-stream" },
      maxBodyLength: Infinity,
    }),
};
