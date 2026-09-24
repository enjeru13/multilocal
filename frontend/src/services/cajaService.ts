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
  /** JSON con el arqueo por moneda (esperado, contado y diferencia). */
  detalleCierre?: string | null;
  movimientos?: CajaMovimiento[];
}

export interface CajaMonedaResumen {
  moneda: Moneda;
  inicial: number;
  cobrado: number;
  vueltos: number;
  ingresos: number;
  egresos: number;
  esperado: number;
}

export interface DetalleCierreMoneda {
  moneda: Moneda;
  esperado: number;
  contado: number;
  diferencia: number;
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
      principal: Moneda;
      porMoneda: CajaMonedaResumen[];
    };

export const cajaService = {
  actual: (): Promise<{ data: CajaActual }> => apiClient.get("/caja/actual"),
  comprobante: (id: number): Promise<{ data: ComprobanteCaja }> => apiClient.get(`/caja/${id}/comprobante`),
  historial: (): Promise<{ data: CajaSesion[] }> => apiClient.get("/caja/historial"),
  abrir: (montoInicial: number) => apiClient.post("/caja/abrir", { montoInicial }),
  movimiento: (data: {
    tipo: "INGRESO" | "EGRESO";
    monto: number;
    moneda: Moneda;
    concepto: string;
  }) => apiClient.post("/caja/movimientos", data),
  cerrar: (datos: {
    contadoPorMoneda?: Partial<Record<Moneda, number>>;
    montoFinalContado?: number;
    observacionCierre?: string;
  }) => apiClient.post("/caja/cerrar", datos),
};

/** Todo lo necesario para imprimir el arqueo de una sesión (abierta o cerrada). */
export interface ComprobanteCaja {
  principal: Moneda;
  sesion: CajaSesion & { movimientos: CajaMovimiento[] };
  porMoneda: CajaMonedaResumen[];
  cantidadPagos: number;
  otrosMetodos: number;
  efectivoEsperado: number;
  tasas: { VES: number | null; COP: number | null };
}
