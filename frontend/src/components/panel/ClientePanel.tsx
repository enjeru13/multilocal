import { FaUserPlus, FaUserCheck, FaUser } from "react-icons/fa";
import type { ClienteResumen } from "@lavanderia/shared/types/types";
import Button from "../ui/Button";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";

type Props = {
  cliente: ClienteResumen | null;
  onAbrirFormulario: () => void;
  onAbrirLista: () => void;
  onQuitar?: () => void;
};

export default function ClientePanel({
  cliente,
  onAbrirFormulario,
  onAbrirLista,
  onQuitar,
}: Props) {
  const { config } = useConfiguracion();
  const et = useEtiquetas();
  const opcional = config?.clienteObligatorio === false;
  return (
    <section className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
      <header className="pb-4 border-b border-gray-200 dark:border-gray-800 mb-6 transition-colors">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <FaUser size={28} className="text-indigo-500 dark:text-indigo-400" />
          {et.cliente}
          {opcional && (
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">(opcional)</span>
          )}
        </h2>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 transition-all">
        <div>
          {cliente ? (
            <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-800 text-green-800 dark:text-green-400 px-5 py-2.5 rounded-lg font-bold inline-flex items-center gap-3 shadow-sm transition-colors">
              <FaUserCheck className="text-green-600 dark:text-green-500 text-xl" />
              {cliente.nombre} {cliente.apellido}
              {opcional && onQuitar && (
                <button
                  type="button"
                  onClick={onQuitar}
                  className="ml-2 text-green-700 dark:text-green-400 hover:text-red-600 text-lg leading-none"
                  title="Quitar"
                >
                  &times;
                </button>
              )}
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-400 italic px-5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg inline-flex items-center gap-2 transition-colors">
              {opcional ? `Sin ${et.clienteMin} (venta de mostrador)` : `No hay ${et.clienteMin} asignado`}
            </div>
          )}
        </div>

        {/* 2. Botones actualizados usando el componente UI */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={onAbrirFormulario}
            variant="primary"
            leftIcon={<FaUserPlus />}
          // Puedes agregar size="lg" si quieres que sean grandes como en el otro panel
          >
            Registrar nuevo
          </Button>

          <Button
            onClick={onAbrirLista}
            variant="secondary"
            leftIcon={<FaUserCheck />}
          >
            Seleccionar existente
          </Button>
        </div>
      </div>
    </section>
  );
}