import apiClient from "../utils/apiClient";
import type { Moneda } from "@lavanderia/shared/types/types";

export interface CajaSesion {
  id: number;
  usuarioAperturaId: number;
  usuarioApertura?: { id: number; name: string | null; email: string };
  fechaApertura: string;
  montoInicial: number;
  fechaCierre: string | null;
  montoFinalContado: number | null;
  montoFinalSistema: number | null;
  diferencia: number | null;
  estado: "ABIERTA" | "CERRADA";
  observacionCierre: string | null;
  movimientos?: CajaMovimiento[];
}

export interface CajaMovimiento {
  id: number;
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  moneda: Moneda;
  concepto: string;
  fecha: string;
}

export type CajaActual =
  | { abierta: false }
  | {
      abierta: true;
      sesion: CajaSesion;
      cantidadPagos: number;
      montoInicial: number;
      efectivoPagos: number;
      otrosMetodos: number;
      ingresos: number;
      egresos: number;
      efectivoEsperado: number;
    };

export const cajaService = {
  actual: (): Promise<{ data: CajaActual }> => apiClient.get("/caja/actual"),
  historial: (): Promise<{ data: CajaSesion[] }> => apiClient.get("/caja/historial"),
  abrir: (montoInicial: number) => apiClient.post("/caja/abrir", { montoInicial }),
  movimiento: (data: {
    tipo: "INGRESO" | "EGRESO";
    monto: number;
    moneda: Moneda;
    concepto: string;
  }) => apiClient.post("/caja/movimientos", data),
  cerrar: (montoFinalContado: number, observacionCierre?: string) =>
    apiClient.post("/caja/cerrar", { montoFinalContado, observacionCierre }),
};
