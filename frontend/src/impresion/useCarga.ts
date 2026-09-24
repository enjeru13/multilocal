import { useEffect, useState } from "react";
import { isAxiosError } from "axios";

/**
 * Pide los datos de un reporte cada vez que se abre su ventana. Devuelve `data` solo
 * cuando la respuesta corresponde a la última petición.
 */
export function useCarga<T>(abierto: boolean, pedir: () => Promise<T>, dependencias: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    pedir()
      .then((r) => vigente && setData(r))
      .catch((err) => {
        if (!vigente) return;
        setData(null);
        setError(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo preparar el reporte." : "No se pudo preparar el reporte.");
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, ...dependencias]);

  return { data, cargando, error };
}
