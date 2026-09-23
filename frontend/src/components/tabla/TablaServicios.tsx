import { FaPen, FaTrashAlt } from "react-icons/fa";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import type { Servicio } from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import Button from "../ui/Button";
import { useEtiquetas } from "../../context/configuracionCore";

type Props = {
  servicios: Servicio[];
  onEditar: (servicio: Servicio) => void;
  onEliminar: (id: number) => void;
  monedaPrincipal: Moneda;
};

export default function TablaServicios({
  servicios,
  onEditar,
  onEliminar,
  monedaPrincipal,
}: Props) {
  const et = useEtiquetas();
  const { hasRole } = useAuth();

  if (servicios.length === 0) {
    return (
      <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all">
        <table className="min-w-full text-sm transition-colors">
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700 transition-colors">
            <tr>
              <th className="px-6 py-3 text-left">{et.servicio}</th>
              <th className="px-6 py-3 text-left">Categoría</th>
              <th className="px-6 py-3 text-left">Precio</th>
              <th className="px-6 py-3 text-left">Descripción</th>
              <th className="px-6 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={5}
                className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic bg-white dark:bg-gray-900 transition-colors"
              >
                No hay {et.serviciosMin} registrados.
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
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700 transition-colors">
            <tr>
              <th className="px-6 py-3 text-left">{et.servicio}</th>
              <th className="px-6 py-3 text-left">Categoría</th>
              <th className="px-6 py-3 text-left">Precio</th>
              <th className="px-6 py-3 text-left">Descripción</th>
              <th className="px-6 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr
                key={s.id}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150 text-gray-700 dark:text-gray-300 font-semibold"
              >
                <td className="px-6 py-4 text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                  {s.nombreServicio}
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-400">
                  {s.categoria?.nombre || "Sin Categoría"}
                </td>
                <td className="px-6 py-4 text-indigo-700 dark:text-indigo-400 font-extrabold">
                  {formatearMoneda(s.precioBase, monedaPrincipal)}
                </td>
                <td
                  className="px-6 py-4 text-gray-600 dark:text-gray-400 max-w-[250px] truncate font-semibold transition-colors"
                  title={s.descripcion || undefined}
                >
                  {s.descripcion || (
                    <span className="text-gray-400 dark:text-gray-600 italic font-semibold">
                      Sin descripción
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="inline-flex gap-2">
                    {hasRole(["ADMIN"]) && (
                      <Button
                        onClick={() => onEditar(s)}
                        title={`Editar ${et.servicioMin}`}
                        variant="iconInfo"
                        size="icon"
                      >
                        <FaPen size={12} />
                      </Button>
                    )}
                    {hasRole(["ADMIN"]) && (
                      <Button
                        onClick={() => onEliminar(s.id)}
                        title={`Eliminar ${et.servicioMin}`}
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
