import apiClient from "../utils/apiClient";

export interface MovimientoInventario {
  id: number;
  servicioId: number;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  motivo: "COMPRA" | "VENTA" | "AJUSTE_MANUAL" | "DEVOLUCION";
  stockResultante: number;
  fecha: string;
  nota: string | null;
  usuario: string | null;
  servicio?: { id: number; nombreServicio: string };
}

export const inventarioService = {
  movimientos: (servicioId?: number): Promise<{ data: MovimientoInventario[] }> =>
    apiClient.get("/inventario/movimientos", { params: { servicioId, limit: 200 } }),
  ajustar: (data: {
    servicioId: number;
    tipo: "ENTRADA" | "SALIDA";
    cantidad: number;
    nota: string;
  }) => apiClient.post("/inventario/ajustes", data),
};
