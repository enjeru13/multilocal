import { createContext, useContext, useEffect, useId, useRef } from "react";

/** Un atajo de teclado: "F9", "Alt+V", "Ctrl+K", "?"… */
export interface Atajo {
  /** Combinación, p. ej. "Alt+V", "F9", "Ctrl+Shift+K". */
  combo: string;
  descripcion: string;
  accion: () => void;
  /** Agrupa el atajo en la ayuda ("Navegación", "Venta"…). */
  grupo?: string;
  /** Dispara aunque se esté escribiendo en un campo (las teclas F y Alt/Ctrl ya lo hacen). */
  enCampo?: boolean;
  /** Oculto en la ayuda pero activo. */
  oculto?: boolean;
}

export interface AtajosContextType {
  registrar: (id: string, atajos: Atajo[]) => () => void;
  lista: () => Atajo[];
  ayudaAbierta: boolean;
  abrirAyuda: (abrir: boolean) => void;
  paletaAbierta: boolean;
  abrirPaleta: (abrir: boolean) => void;
}

export const AtajosContext = createContext<AtajosContextType>({
  registrar: () => () => {},
  lista: () => [],
  ayudaAbierta: false,
  abrirAyuda: () => {},
  paletaAbierta: false,
  abrirPaleta: () => {},
});

export const useAtajosContext = () => useContext(AtajosContext);

export interface ComboParseado {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  tecla: string;
}

export function parsearCombo(combo: string): ComboParseado {
  const partes = combo.split("+").map((p) => p.trim());
  const tecla = (partes.pop() ?? "").toLowerCase();
  const mods = partes.map((p) => p.toLowerCase());
  return { ctrl: mods.includes("ctrl"), alt: mods.includes("alt"), shift: mods.includes("shift"), tecla };
}

/** ¿Este evento corresponde al combo? Usa `code` para letras/dígitos: Alt+V no cambia con el teclado. */
export function coincide(e: KeyboardEvent, c: ComboParseado): boolean {
  if (e.ctrlKey !== c.ctrl || e.altKey !== c.alt) return false;
  const simbolo = c.tecla.length === 1 && !/[a-z0-9]/.test(c.tecla);
  // Símbolos como "?" ya llevan Shift implícito; el resto debe coincidir exacto.
  if (simbolo) return e.key === c.tecla;
  if (e.shiftKey !== c.shift) return false;
  if (c.tecla.length === 1) {
    // Por posición física: Alt+V funciona igual con cualquier distribución de teclado.
    return e.code === `Key${c.tecla.toUpperCase()}` || e.code === `Digit${c.tecla}` || e.key.toLowerCase() === c.tecla;
  }
  return e.key.toLowerCase() === c.tecla;
}

export function esCampoDeTexto(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Registra atajos mientras el componente esté montado. */
export function useAtajos(atajos: Atajo[]) {
  const { registrar } = useAtajosContext();
  const id = useId();
  // Siempre se ejecuta la versión más reciente de cada acción sin re-registrar.
  const ref = useRef(atajos);
  useEffect(() => {
    ref.current = atajos;
  });
  const firma = atajos.map((a) => `${a.combo}|${a.descripcion}|${a.grupo ?? ""}`).join(";");

  useEffect(() => {
    const envueltos: Atajo[] = ref.current.map((a, i) => ({
      ...a,
      accion: () => ref.current[i]?.accion(),
    }));
    return registrar(id, envueltos);
  }, [firma, registrar, id]);
}
