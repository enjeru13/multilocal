import { toast } from "react-toastify";

/**
 * Registra el service worker (solo en la web instalada/publicada; la app de escritorio
 * ya trae todo consigo). Cuando hay una versión nueva no recarga sola: podría interrumpir
 * una venta a medias, así que avisa y deja elegir el momento.
 */
export async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD || /Electron/i.test(navigator.userAgent)) return;
  const { registerSW } = await import("virtual:pwa-register");

  const actualizar = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast.info(
        <div className="flex items-center justify-between gap-3">
          <span>Hay una versión nueva.</span>
          <button type="button" onClick={() => actualizar(true)} className="font-semibold underline cursor-pointer">
            Actualizar
          </button>
        </div>,
        { toastId: "nueva-version", autoClose: false, closeOnClick: false }
      );
    },
  });
}
