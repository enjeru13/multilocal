import type { DescuentoOrden } from "@lavanderia/shared/types/types";
import { useMonedas } from "../../context/useMonedas";
import type { TotalesCalculados } from "@lavanderia/shared/utils/totales";
import {
  formatearMoneda,
  convertirDesdePrincipal,
  NOMBRE_MONEDA,
  type Moneda,
  type TasasConversion,
} from "../../utils/monedaHelpers";
import { FaDollarSign, FaRegTimesCircle, FaPlusCircle } from "react-icons/fa";
import Button from "../ui/Button";
import { useEtiquetas } from "../../context/configuracionCore";
import DescuentoControl from "../venta/DescuentoControl";
import DesgloseTotales from "../venta/DesgloseTotales";

interface Props {
  totales: TotalesCalculados;
  descuento: DescuentoOrden | null;
  onDescuento: (d: DescuentoOrden | null) => void;
  onRegistrar: () => void;
  onCancelar: () => void;
  monedaPrincipal: Moneda;
  tasas: TasasConversion;
  isFormValid: boolean;
  isSaving: boolean;
}

export default function ConfirmarOrdenPanel({
  totales,
  descuento,
  onDescuento,
  onRegistrar,
  onCancelar,
  monedaPrincipal,
  tasas,
  isFormValid,
  isSaving,
}: Props) {
  const et = useEtiquetas();
  const totalCalculado = totales.total;

  const negocio = useMonedas();
  const proyecciones = negocio.otrasUsables.map((m) => ({ moneda: m, monto: convertirDesdePrincipal(totalCalculado, m, tasas, monedaPrincipal) }));

  return (
    <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
      <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-800 transition-colors">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-center gap-2 mb-2">
          <FaDollarSign size={32} className="text-green-600 dark:text-green-500" />
          Total
        </h2>
        <p className="text-base text-gray-600 dark:text-gray-400 mb-2">
          Monto final a cobrar.
        </p>
        <p className="text-3xl sm:text-4xl font-extrabold text-green-700 dark:text-green-500 tracking-tight">
          {formatearMoneda(totalCalculado, monedaPrincipal)}
        </p>
      </div>

      <div className="max-w-md mx-auto w-full space-y-3">
        <DescuentoControl value={descuento} onChange={onDescuento} disabled={isSaving} />
        <DesgloseTotales totales={totales} moneda={monedaPrincipal} />
      </div>

      {proyecciones.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-950 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 text-left transition-colors">
          <p className="font-bold text-gray-800 dark:text-gray-100 text-lg">
            Total proyectado en {proyecciones.length === 1 ? "otra moneda" : "otras monedas"}:
          </p>
          <div className={`grid grid-cols-1 gap-4 ${proyecciones.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {proyecciones.map((p) => (
              <div key={p.moneda} className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                <span className="text-sm text-gray-700 dark:text-gray-400 block mb-1">
                  {NOMBRE_MONEDA[p.moneda]} ({p.moneda}):
                </span>
                <span className="block text-green-700 dark:text-green-500 font-bold text-xl">
                  {formatearMoneda(p.monto, p.moneda)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-500 italic mt-2">
            Estas proyecciones se basan en las tasas de conversión actuales.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:flex sm:justify-end gap-3 sm:gap-4 pt-6 border-t border-gray-200 dark:border-gray-800 mt-6 transition-colors">
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
          Crear {et.orden}
        </Button>
      </div>
    </section>
  );
}
