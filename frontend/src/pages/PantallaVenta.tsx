import { useConfiguracion } from "../context/configuracionCore";
import { experienciaDe } from "../experiencia/experiencias";
import VentaCaja from "../venta/VentaCaja";
import VentaFactura from "../venta/VentaFactura";
import VentaMostrador from "../venta/VentaMostrador";
import { FormSkeleton } from "../components/Skeleton";

/** Cada negocio vende a su manera: caja rápida, facturación o mostrador genérico. */
export default function PantallaVenta() {
  const { config, loading } = useConfiguracion();
  if (loading || !config) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }
  const modo = experienciaDe(config.rubro).modoVenta;
  if (modo === "CAJA") return <VentaCaja />;
  if (modo === "FACTURA") return <VentaFactura />;
  // Genérico o lavandería con venta directa activada.
  return <VentaMostrador />;
}
