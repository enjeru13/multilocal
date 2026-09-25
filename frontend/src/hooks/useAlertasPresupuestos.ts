import { useEffect, useSyncExternalStore } from "react";
import { presupuestosService } from "../services/presupuestosService";
import { useConfiguracion } from "../context/configuracionCore";
import { useAuth } from "./useAuth";
import { reproducir } from "../sonidos/sonidos";

interface Alertas {
  vencidos: number;
  porVencer: number;
}

// Una sola consulta compartida por el menú, la barra inferior y el resto de pantallas.
const VACIO: Alertas = { vencidos: 0, porVencer: 0 };
let actual: Alertas = VACIO;
const oyentes = new Set<() => void>();
let suscriptoresActivos = 0;
let temporizador: ReturnType<typeof setInterval> | null = null;
// Para avisar con sonido: al abrir si ya hay alertas y cada vez que aparecen más.
let totalConocido: number | null = null;
// Varios componentes piden a la vez al montarse: comparten la misma consulta en curso.
let enCurso: Promise<void> | null = null;

const suscribir = (cb: () => void) => {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
};

function publicar(nuevo: Alertas) {
  if (nuevo.vencidos === actual.vencidos && nuevo.porVencer === actual.porVencer) return;
  actual = nuevo;
  oyentes.forEach((cb) => cb());
}

/** Vuelve a pedir las alertas; se llama tras crear, editar, cambiar de estado o convertir un presupuesto. */
export function refrescarAlertasPresupuestos(conSonido = false): Promise<void> {
  if (enCurso) return enCurso;
  enCurso = pedirAlertas(conSonido).finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function pedirAlertas(conSonido: boolean) {
  try {
    const r = await presupuestosService.alertas();
    const total = r.data.vencidos + r.data.porVencer;
    if (conSonido && total > 0 && (totalConocido === null || total > totalConocido)) reproducir("alerta");
    totalConocido = total;
    publicar({ vencidos: r.data.vencidos, porVencer: r.data.porVencer });
  } catch {
    // Sin conexión o módulo apagado: se conserva lo último que se supo.
  }
}

/**
 * Cuántos presupuestos pendientes ya vencieron o están por vencer. Se actualiza al abrir la app,
 * al volver a la ventana y cada 5 minutos; vale 0 si el módulo está apagado o el rol no lo usa.
 */
export function useAlertasPresupuestos() {
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const activo = !!config?.moduloPresupuestos && hasRole(["ADMIN", "EMPLOYEE"]);

  useEffect(() => {
    if (!activo) return;
    suscriptoresActivos += 1;
    refrescarAlertasPresupuestos(suscriptoresActivos === 1);
    if (suscriptoresActivos === 1) temporizador = setInterval(() => refrescarAlertasPresupuestos(true), 5 * 60_000);
    const alVolver = () => document.visibilityState === "visible" && refrescarAlertasPresupuestos(true);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      suscriptoresActivos -= 1;
      if (suscriptoresActivos === 0 && temporizador) {
        clearInterval(temporizador);
        temporizador = null;
        actual = VACIO;
        totalConocido = null;
      }
    };
  }, [activo]);

  const datos = useSyncExternalStore(suscribir, () => actual);
  return activo ? { ...datos, total: datos.vencidos + datos.porVencer } : { ...VACIO, total: 0 };
}
