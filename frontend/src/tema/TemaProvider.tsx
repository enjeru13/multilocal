import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CLAVE_TEMA, TemaContext, leerPreferencia, sistemaEsOscuro, type PreferenciaTema } from "./temaCore";

/** Tema claro/oscuro para toda la app (también login, asistente y ventanas): un solo lugar aplica la clase. */
export function TemaProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(leerPreferencia);
  const [sistemaOscuro, setSistemaOscuro] = useState(sistemaEsOscuro);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = (e: MediaQueryListEvent) => setSistemaOscuro(e.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  const oscuro = preferencia === "dark" || (preferencia === "system" && sistemaOscuro);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", oscuro);
  }, [oscuro]);

  const elegir = useCallback((p: PreferenciaTema) => {
    setPreferencia(p);
    try {
      if (p === "system") localStorage.removeItem(CLAVE_TEMA);
      else localStorage.setItem(CLAVE_TEMA, p);
    } catch {
      /* sin almacenamiento: vale solo para esta sesión */
    }
  }, []);

  const alternar = useCallback(() => {
    elegir(preferencia === "system" ? "light" : preferencia === "light" ? "dark" : "system");
  }, [preferencia, elegir]);

  const valor = useMemo(() => ({ preferencia, oscuro, elegir, alternar }), [preferencia, oscuro, elegir, alternar]);
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}
