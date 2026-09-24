import { useSyncExternalStore } from "react";

/** true cuando el dispositivo perdió la conexión: el servidor no se alcanza y nada se guardaría. */
export function useSinConexion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => !navigator.onLine,
    () => false
  );
}
