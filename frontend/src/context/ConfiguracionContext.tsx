import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { configuracionService } from "../services/configuracionService";
import { useAuth } from "../hooks/useAuth";
import { RUBRO_PRESETS } from "../constants/rubroPresets";
import type { Configuracion, Terminologia } from "@lavanderia/shared/types/types";

interface ConfiguracionContextType {
  config: Configuracion | null;
  loading: boolean;
  refetch: () => Promise<void>;
  t: (clave: keyof Terminologia) => string;
}

const ConfiguracionContext = createContext<ConfiguracionContextType>({
  config: null,
  loading: true,
  refetch: async () => {},
  t: (clave) => RUBRO_PRESETS.GENERICO.terminologia[clave],
});

export const ConfiguracionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await configuracionService.get();
      setConfig(res.data);
    } catch (error) {
      console.error("Error al cargar configuración:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, refetch]);

  const t = useCallback(
    (clave: keyof Terminologia): string => {
      const rubro = config?.rubro ?? "GENERICO";
      const preset = RUBRO_PRESETS[rubro] ?? RUBRO_PRESETS.GENERICO;
      return config?.terminologia?.[clave] || preset.terminologia[clave];
    },
    [config]
  );

  return (
    <ConfiguracionContext.Provider value={{ config, loading, refetch, t }}>
      {children}
    </ConfiguracionContext.Provider>
  );
};

export function useConfiguracion() {
  return useContext(ConfiguracionContext);
}
