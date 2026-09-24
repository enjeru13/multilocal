import { createContext, useContext } from "react";

export type PreferenciaTema = "system" | "light" | "dark";

export interface TemaContextType {
  /** Lo que eligió la persona: claro, oscuro o seguir al sistema. */
  preferencia: PreferenciaTema;
  /** Lo que se está mostrando ahora mismo. */
  oscuro: boolean;
  elegir: (p: PreferenciaTema) => void;
  /** Rota system → claro → oscuro. */
  alternar: () => void;
}

export const CLAVE_TEMA = "mostrador.tema";

export const TemaContext = createContext<TemaContextType>({
  preferencia: "system",
  oscuro: false,
  elegir: () => {},
  alternar: () => {},
});

export const useTema = () => useContext(TemaContext);

export function leerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CLAVE_TEMA);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export const sistemaEsOscuro = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
