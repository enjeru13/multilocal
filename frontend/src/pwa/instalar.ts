import { useSyncExternalStore } from "react";

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Instalar la app en el teléfono. El navegador avisa una sola vez (a veces antes de que
 * cargue la interfaz), así que el aviso se captura aquí, a nivel de módulo, desde el arranque.
 */
let evento: EventoInstalacion | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    evento = e as EventoInstalacion;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    evento = null;
    avisar();
  });
}

const instalada = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const enElectron = () => typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent);

const esIOS = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function useInstalarApp() {
  const hayEvento = useSyncExternalStore(
    (cb) => {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    () => evento !== null,
    () => false
  );

  const ya = instalada();
  const ios = esIOS();
  // En Android/Chrome se instala con un toque; en iPhone hay que pasar por «Compartir».
  const disponible = !ya && !enElectron() && (hayEvento || ios);

  const instalar = async () => {
    if (!evento) return "manual" as const;
    await evento.prompt();
    const r = await evento.userChoice;
    evento = null;
    avisar();
    return r.outcome;
  };

  return { disponible, instalar, esIOS: ios, hayEvento, instalada: ya };
}
