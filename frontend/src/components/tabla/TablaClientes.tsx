import { FaSearch, FaPen, FaTrashAlt } from "react-icons/fa";
import type { Cliente } from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import Button from "../ui/Button";
import { useEtiquetas } from "../../context/configuracionCore";

type Props = {
  clientes: Cliente[];
  onVerInfo: (cliente: Cliente) => void;
  onEditar: (cliente: Cliente) => void;
  onEliminar: (id: number) => void;
};

export default function TablaClientes({
  clientes,
  onVerInfo,
  onEditar,
  onEliminar,
}: Props) {
  const et = useEtiquetas();
  const { hasRole } = useAuth();

  if (clientes.length === 0) {
    return (
      <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all">
        <table className="min-w-full text-sm transition-colors">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-6 py-3 text-left">Nombre / Razón Social</th>
              <th className="px-6 py-3 text-left">Teléfono</th>
              <th className="px-6 py-3 text-left">Dirección</th>
              <th className="px-6 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={4}
                className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic bg-white dark:bg-gray-900 transition-colors"
              >
                No hay {et.clientesMin} registrados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 transition-all">
        <table className="min-w-full bg-white dark:bg-gray-900 text-sm transition-colors">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-6 py-3 text-left">Nombre / Razón Social</th>
              <th className="px-6 py-3 text-left">Teléfono</th>
              <th className="px-6 py-3 text-left">Dirección</th>
              <th className="px-6 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr
                key={c.id}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-150 text-gray-700 dark:text-gray-300"
              >
                <td className="px-6 py-4 text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                  {c.tipo === "EMPRESA" ? (
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                      {c.nombre}
                    </span>
                  ) : (
                    `${c.nombre} ${c.apellido}`
                  )}
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-semibold transition-colors">
                  {c.telefono ?? (
                    <span className="text-gray-400 dark:text-gray-600 italic">N/A</span>
                  )}
                </td>
                <td
                  className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-[200px] truncate font-semibold transition-colors"
                  title={c.direccion ?? undefined}
                >
                  {c.direccion ?? (
                    <span className="text-gray-400 dark:text-gray-600 italic font-semibold">
                      Sin dirección
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="inline-flex gap-2">
                    <Button
                      onClick={() => onEditar(c)}
                      title={`Editar ${et.clienteMin}`}
                      variant="iconInfo"
                      size="icon"
                    >
                      <FaPen size={12} />
                    </Button>
                    <Button
                      onClick={() => onVerInfo(c)}
                      title={`Ver información de ${et.clienteMin}`}
                      variant="iconNeutral"
                      size="icon"
                    >
                      <FaSearch size={12} />
                    </Button>
                    {hasRole(["ADMIN"]) && (
                      <Button
                        onClick={() => onEliminar(c.id)}
                        title={`Eliminar ${et.clienteMin}`}
                        variant="iconDanger"
                        size="icon"
                      >
                        <FaTrashAlt size={12} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
