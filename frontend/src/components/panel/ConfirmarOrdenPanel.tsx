import { useMemo } from "react"; // IMPORTANTE: Agregar useMemo
import type {
  Servicio,
  ServicioSeleccionado,
} from "@lavanderia/shared/types/types";
import {
  formatearMoneda,
  convertirDesdePrincipal,
  type Moneda,
  type TasasConversion,
} from "../../utils/monedaHelpers";
import { FaDollarSign, FaRegTimesCircle, FaPlusCircle } from "react-icons/fa";
import Button from "../ui/Button";

interface Props {
  serviciosSeleccionados: ServicioSeleccionado[];
  serviciosCatalogo: Servicio[];
  onRegistrar: () => void;
  onCancelar: () => void;
  monedaPrincipal: Moneda;
  tasas: TasasConversion;
  isFormValid: boolean;
  isSaving: boolean;
  // Eliminamos subtotal y descuentoTotal porque se calculan aquí
}

export default function ConfirmarOrdenPanel({
  serviciosSeleccionados,
  serviciosCatalogo,
  onRegistrar,
  onCancelar,
  monedaPrincipal,
  tasas,
  isFormValid,
  isSaving,
}: Props) {
  // --- 1. CALCULAMOS EL TOTAL AQUÍ ---
  const totalCalculado = useMemo(() => {
    return serviciosSeleccionados.reduce((acc, item) => {
      const servicio = serviciosCatalogo.find((s) => s.id === item.servicioId);

      // Usamos el precio personalizado (item.precio) o el base (servicio.precioBase)
      const precioReal = item.precio ?? servicio?.precioBase ?? 0;

      const subtotalItem = precioReal * item.cantidad;
      const descuento = item.descuento || 0; // Por si implementas descuentos luego

      return acc + Math.max(0, subtotalItem - descuento);
    }, 0);
  }, [serviciosSeleccionados, serviciosCatalogo]);
  // -----------------------------------

  // Usamos 'totalCalculado' en lugar de 'total'
  const totalVES = convertirDesdePrincipal(
    totalCalculado,
    "VES",
    tasas,
    monedaPrincipal
  );
  const totalCOP = convertirDesdePrincipal(
    totalCalculado,
    "COP",
    tasas,
    monedaPrincipal
  );

  return (
    <section className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
      <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-800 transition-colors">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center gap-2 mb-2">
          <FaDollarSign size={32} className="text-green-600 dark:text-green-500" />
          Total de la orden
        </h2>
        <p className="text-base text-gray-600 dark:text-gray-400 mb-2">
          Monto final a cobrar por los servicios.
        </p>
        <p className="text-4xl font-extrabold text-green-700 dark:text-green-500 tracking-tight">
          {formatearMoneda(totalCalculado, monedaPrincipal)}
        </p>
      </div>

      <div className="bg-gray-100 dark:bg-gray-950 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 text-left transition-colors">
        <p className="font-bold text-gray-800 dark:text-gray-100 text-lg">
          Total proyectado en otras monedas:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <span className="text-sm text-gray-700 dark:text-gray-400 block mb-1">
              Bolívares (VES):
            </span>
            <span className="block text-green-700 dark:text-green-500 font-bold text-xl">
              {formatearMoneda(totalVES, "VES")}
            </span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <span className="text-sm text-gray-700 dark:text-gray-400 block mb-1">
              Pesos (COP):
            </span>
            <span className="block text-green-700 dark:text-green-500 font-bold text-xl">
              {formatearMoneda(totalCOP, "COP")}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-500 italic mt-2">
          Estas proyecciones se basan en las tasas de conversión actuales.
        </p>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-800 mt-6 transition-colors">
        <Button
          onClick={onCancelar}
          variant="secondary"
          size="lg"
          leftIcon={<FaRegTimesCircle size={18} />}
        >
          Cancelar
        </Button>

        <Button
          onClick={onRegistrar}
          disabled={!isFormValid || isSaving}
          isLoading={isSaving}
          variant="primary"
          size="lg"
          leftIcon={<FaPlusCircle size={18} />}
        >
          Crear Orden
        </Button>
      </div>
    </section>
  );
}
