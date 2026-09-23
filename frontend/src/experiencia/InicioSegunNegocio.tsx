import { Navigate } from "react-router-dom";
import { useConfiguracion } from "../context/configuracionCore";
import PantallaPrincipal from "../pages/PantallaPrincipal";
import { FormSkeleton } from "../components/Skeleton";

/**
 * La primera pantalla depende del negocio: donde se vende al momento (minimarket,
 * repuestos) se abre directo la caja; donde hay entrega (lavandería) se abre la recepción.
 */
export default function InicioSegunNegocio() {
  const { config, loading } = useConfiguracion();

  if (loading || !config) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }
  if (config.moduloFechaEntrega === false) return <Navigate to="/venta" replace />;
  return <PantallaPrincipal />;
}
