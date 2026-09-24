import { useMemo } from "react";
import type { Moneda } from "@lavanderia/shared/types/types";
import { monedasActivas, tasaCruzada, type TasasConversion } from "@lavanderia/shared/utils/monedaHelpers";
import { useConfiguracion } from "./configuracionCore";

/**
 * Las monedas con las que trabaja el negocio y sus tasas, para que cada pantalla se ajuste
 * sola: solo se ofrecen las monedas activas y solo se convierte a las que tienen tasa.
 */
export function useMonedas() {
  const { config } = useConfiguracion();

  return useMemo(() => {
    const principal = (config?.monedaPrincipal ?? "USD") as Moneda;
    const activas = monedasActivas(config?.monedasActivas, principal);
    // Todas contra el dólar (unidades de cada moneda por 1 USD).
    const tasas: TasasConversion = { USD: 1, VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null };

    /** ¿Se puede convertir entre esta moneda y la principal? */
    const conTasa = (m: Moneda) => tasaCruzada(m, principal, tasas) !== null;
    /** Activa y con tasa: se puede cobrar, pagar y mostrar en ella. */
    const disponible = (m: Moneda) => activas.includes(m) && conTasa(m);

    /**
     * Qué tasa (contra el dólar) hay que definir para poder usar `m`: la de `m` o la de la
     * principal, según cuál falte. null si no falta ninguna.
     */
    const tasaFaltante = (m: Moneda): "VES" | "COP" | null => {
      if (conTasa(m)) return null;
      for (const c of [m, principal] as Moneda[]) {
        if (c !== "USD" && !tasas[c as "VES" | "COP"]) return c as "VES" | "COP";
      }
      return null;
    };

    const otras = activas.filter((m) => m !== principal);

    return {
      principal,
      activas,
      otras,
      /** Monedas activas con tasa, la principal primero. */
      usables: activas.filter(disponible),
      /** Otras monedas (no la principal) a las que se puede convertir. */
      otrasUsables: otras.filter(disponible),
      tasas,
      disponible,
      conTasa,
      tasaFaltante,
      varias: activas.length > 1,
    };
  }, [config]);
}

export type MonedasNegocio = ReturnType<typeof useMonedas>;
