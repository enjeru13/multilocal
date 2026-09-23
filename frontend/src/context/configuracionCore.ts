import { createContext, useContext, useMemo } from "react";
import { RUBRO_PRESETS } from "../constants/rubroPresets";
import type {
  Configuracion,
  Terminologia,
} from "@lavanderia/shared/types/types";

export interface ConfiguracionContextType {
  config: Configuracion | null;
  loading: boolean;
  refetch: () => Promise<void>;
  t: (clave: keyof Terminologia) => string;
}

export const ConfiguracionContext = createContext<ConfiguracionContextType>({
  config: null,
  loading: true,
  refetch: async () => {},
  t: (clave) => RUBRO_PRESETS.GENERICO.terminologia[clave],
});

export function useConfiguracion() {
  return useContext(ConfiguracionContext);
}

/** Etiquetas del negocio listas para usar en la UI (singular/plural y en minúscula). */
export function useEtiquetas() {
  const { t } = useConfiguracion();
  return useMemo(
    () => ({
      orden: t("ordenUno"),
      ordenes: t("orden"),
      servicio: t("servicioUno"),
      servicios: t("servicio"),
      cliente: t("clienteUno"),
      clientes: t("cliente"),
      ordenMin: t("ordenUno").toLowerCase(),
      ordenesMin: t("orden").toLowerCase(),
      servicioMin: t("servicioUno").toLowerCase(),
      serviciosMin: t("servicio").toLowerCase(),
      clienteMin: t("clienteUno").toLowerCase(),
      clientesMin: t("cliente").toLowerCase(),
    }),
    [t],
  );
}
