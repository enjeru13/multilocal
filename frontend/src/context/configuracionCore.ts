import { createContext, useContext } from "react";
import { RUBRO_PRESETS } from "../constants/rubroPresets";
import type { Configuracion, Terminologia } from "@lavanderia/shared/types/types";

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
