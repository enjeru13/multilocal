import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AtajosContext, coincide, esCampoDeTexto, parsearCombo, type Atajo } from "./atajosCore";
import PaletaComandos from "./PaletaComandos";
import AyudaAtajos from "./AyudaAtajos";

/** Escucha el teclado una sola vez y despacha al atajo registrado que corresponda. */
export function AtajosProvider({ children }: { children: ReactNode }) {
  const registro = useRef(new Map<string, Atajo[]>());
  const [ayudaAbierta, abrirAyuda] = useState(false);
  const [paletaAbierta, abrirPaleta] = useState(false);

  const registrar = useCallback((id: string, atajos: Atajo[]) => {
    registro.current.set(id, atajos);
    return () => {
      registro.current.delete(id);
    };
  }, []);

  const lista = useCallback(() => [...registro.current.values()].flat(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const escribiendo = esCampoDeTexto(e.target);
      const conModificador = e.ctrlKey || e.altKey || /^F\d{1,2}$/.test(e.key);

      // Ayuda: "?" fuera de campos de texto.
      if (!escribiendo && !conModificador && e.key === "?") {
        e.preventDefault();
        abrirAyuda((v) => !v);
        return;
      }

      // Los más recientes (pantalla actual) ganan sobre los globales.
      const todos = [...registro.current.values()].reverse().flat();
      for (const a of todos) {
        const c = parsearCombo(a.combo);
        if (!coincide(e, c)) continue;
        const requiereFuera = !conModificador && !a.enCampo;
        if (escribiendo && requiereFuera) continue;
        e.preventDefault();
        a.accion();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const valor = useMemo(
    () => ({ registrar, lista, ayudaAbierta, abrirAyuda, paletaAbierta, abrirPaleta }),
    [registrar, lista, ayudaAbierta, paletaAbierta]
  );

  return (
    <AtajosContext.Provider value={valor}>
      {children}
      {paletaAbierta && <PaletaComandos />}
      {ayudaAbierta && <AyudaAtajos />}
    </AtajosContext.Provider>
  );
}
