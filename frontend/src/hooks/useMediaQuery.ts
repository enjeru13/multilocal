import { useSyncExternalStore } from "react";

/** Se actualiza sola al cambiar el tamaño o girar el teléfono. */
export function useMediaQuery(consulta: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(consulta);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(consulta).matches,
    () => false
  );
}

/** Teléfono: menos de 768 px (menú inferior, tarjetas en vez de tablas). */
export const useEsMovil = () => useMediaQuery("(max-width: 767px)");
/** Pantalla que no alcanza para el menú lateral desplegado. */
export const useEsCompacto = () => useMediaQuery("(max-width: 1023px)");
