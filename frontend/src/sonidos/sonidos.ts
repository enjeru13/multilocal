import { useSyncExternalStore } from "react";

/**
 * Sonidos de la interfaz, generados con Web Audio (sin archivos). Las preferencias son de ESTE
 * equipo: el mostrador puede tener sonido y el teléfono no.
 */
export type EventoSonido = "escaneo" | "cobro" | "error" | "alerta" | "listo";

export const EVENTOS_SONIDO: { id: EventoSonido; titulo: string; detalle: string }[] = [
  { id: "cobro", titulo: "Cobro registrado", detalle: "Campanita cuando se registra un pago." },
  { id: "error", titulo: "Errores y avisos", detalle: "Tono grave cuando algo no se puede hacer (sin stock, caja cerrada…)." },
  { id: "escaneo", titulo: "Producto agregado", detalle: "Pitido corto al escanear o agregar un producto a la venta." },
  { id: "alerta", titulo: "Presupuestos por atender", detalle: "Aviso suave al abrir el sistema y cuando aparece un presupuesto vencido o por vencer." },
  { id: "listo", titulo: "Orden lista", detalle: "Timbre cuando una orden pasa a «Lista» en el tablero." },
];

export interface PreferenciasSonido {
  /** Interruptor general: apagado, no suena nada. */
  activo: boolean;
  /** 0 a 1. */
  volumen: number;
  eventos: Record<EventoSonido, boolean>;
}

const CLAVE = "mostrador.sonidos";
const PREDETERMINADAS: PreferenciasSonido = {
  activo: true,
  volumen: 0.6,
  eventos: { cobro: true, error: true, escaneo: false, alerta: false, listo: false },
};

const limitarVolumen = (v: number) => Math.min(1, Math.max(0, v));

function leer(): PreferenciasSonido {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return PREDETERMINADAS;
    const p = JSON.parse(crudo) as Partial<PreferenciasSonido>;
    return {
      activo: typeof p.activo === "boolean" ? p.activo : PREDETERMINADAS.activo,
      volumen: typeof p.volumen === "number" ? limitarVolumen(p.volumen) : PREDETERMINADAS.volumen,
      eventos: { ...PREDETERMINADAS.eventos, ...(p.eventos ?? {}) },
    };
  } catch {
    return PREDETERMINADAS;
  }
}

let actual = leer();
const oyentes = new Set<() => void>();

export function guardarPreferenciasSonido(cambios: Partial<Omit<PreferenciasSonido, "eventos">> & { eventos?: Partial<PreferenciasSonido["eventos"]> }) {
  actual = {
    ...actual,
    ...cambios,
    volumen: limitarVolumen(cambios.volumen ?? actual.volumen),
    eventos: { ...actual.eventos, ...(cambios.eventos ?? {}) },
  };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
  oyentes.forEach((o) => o());
}

export function usePreferenciasSonido() {
  const prefs = useSyncExternalStore(
    (cb) => {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    () => actual,
    () => PREDETERMINADAS
  );
  return [prefs, guardarPreferenciasSonido] as const;
}

// ---- Motor de audio ----

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Los navegadores no dejan sonar nada hasta el primer toque: se prepara el audio en ese momento.
if (typeof window !== "undefined") {
  const desbloquear = () => {
    contexto();
    window.removeEventListener("pointerdown", desbloquear, true);
    window.removeEventListener("keydown", desbloquear, true);
  };
  window.addEventListener("pointerdown", desbloquear, true);
  window.addEventListener("keydown", desbloquear, true);
}

interface Nota {
  /** Segundos desde el inicio del sonido. */
  en: number;
  freq: number;
  dur: number;
  tipo?: OscillatorType;
  /** Volumen relativo 0–1 de esta nota. */
  vol?: number;
  /** Si se indica, la frecuencia se desliza hasta este valor. */
  hasta?: number;
}

const MELODIAS: Record<EventoSonido, Nota[]> = {
  // Pitido de lector de código de barras.
  escaneo: [{ en: 0, freq: 1850, dur: 0.07, tipo: "square", vol: 0.35 }],
  // Dos notas ascendentes, tipo campanita de caja.
  cobro: [
    { en: 0, freq: 880, dur: 0.16, tipo: "sine", vol: 0.8 },
    { en: 0.11, freq: 1320, dur: 0.32, tipo: "sine", vol: 0.8 },
    { en: 0.11, freq: 2640, dur: 0.2, tipo: "sine", vol: 0.15 },
  ],
  // Grave y corto, con una caída.
  error: [
    { en: 0, freq: 200, hasta: 140, dur: 0.22, tipo: "triangle", vol: 0.9 },
    { en: 0.16, freq: 170, hasta: 120, dur: 0.24, tipo: "triangle", vol: 0.9 },
  ],
  // Tres notas suaves.
  alerta: [
    { en: 0, freq: 660, dur: 0.22, tipo: "sine", vol: 0.55 },
    { en: 0.2, freq: 523, dur: 0.22, tipo: "sine", vol: 0.55 },
    { en: 0.4, freq: 660, dur: 0.4, tipo: "sine", vol: 0.55 },
  ],
  // Timbre con armónicos y cola larga.
  listo: [
    { en: 0, freq: 988, dur: 0.7, tipo: "sine", vol: 0.7 },
    { en: 0, freq: 1976, dur: 0.45, tipo: "sine", vol: 0.2 },
    { en: 0.18, freq: 1319, dur: 0.8, tipo: "sine", vol: 0.6 },
  ],
};

/**
 * Hace sonar un evento si el sonido está encendido para él. Con `forzar` (botón «Probar») suena
 * aunque el evento esté apagado. Nunca lanza errores: el sonido es un extra, no puede romper nada.
 */
export function reproducir(evento: EventoSonido, opciones: { forzar?: boolean } = {}) {
  if (!opciones.forzar && (!actual.activo || !actual.eventos[evento])) return;
  if (actual.volumen <= 0) return;
  const c = contexto();
  if (!c) return;
  try {
    const salida = c.createGain();
    // El volumen se aplica con curva cuadrática: el oído distingue mejor los pasos bajos.
    salida.gain.value = actual.volumen * actual.volumen * 0.5;
    salida.connect(c.destination);
    const t0 = c.currentTime + 0.01;
    for (const n of MELODIAS[evento]) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = n.tipo ?? "sine";
      osc.frequency.setValueAtTime(n.freq, t0 + n.en);
      if (n.hasta) osc.frequency.exponentialRampToValueAtTime(n.hasta, t0 + n.en + n.dur);
      const pico = n.vol ?? 0.7;
      g.gain.setValueAtTime(0.0001, t0 + n.en);
      g.gain.exponentialRampToValueAtTime(pico, t0 + n.en + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.en + n.dur);
      osc.connect(g).connect(salida);
      osc.start(t0 + n.en);
      osc.stop(t0 + n.en + n.dur + 0.05);
    }
  } catch {
    /* sin audio disponible */
  }
}
