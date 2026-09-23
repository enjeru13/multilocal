import { FaPen, FaTrashAlt, FaExclamationTriangle } from "react-icons/fa";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import type { Servicio } from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import Button from "../ui/Button";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";
import { estadoStock } from "../../utils/stockHelpers";

type Props = {
  servicios: Servicio[];
  onEditar: (servicio: Servicio) => void;
  onEliminar: (id: number) => void;
  monedaPrincipal: Moneda;
};

const th = "px-6 py-3 text-left";

export default function TablaServicios({ servicios, onEditar, onEliminar, monedaPrincipal }: Props) {
  const et = useEtiquetas();
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const inventario = !!config?.moduloInventario;
  const veCosto = inventario && hasRole(["ADMIN", "EMPLOYEE"]);
  const columnas = 3 + (inventario ? (veCosto ? 3 : 1) : 1) + 1;

  return (
    <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all">
      <table className="min-w-full text-sm transition-colors">
        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700 transition-colors">
          <tr>
            <th className={th}>{et.servicio}</th>
            <th className={th}>Categoría</th>
            <th className={th}>Precio</th>
            {inventario ? (
              <>
                {veCosto && (
                  <>
                    <th className={th}>Costo</th>
                    <th className={th}>Margen</th>
                  </>
                )}
                <th className={th}>Stock</th>
              </>
            ) : (
              <th className={th}>Descripción</th>
            )}
            <th className="px-6 py-3 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {servicios.length === 0 && (
            <tr>
              <td colSpan={columnas} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic">
                No hay {et.serviciosMin} registrados.
              </td>
            </tr>
          )}
          {servicios.map((s) => {
            const stock = estadoStock(s);
            const margen =
              s.costoBase !== null && s.costoBase !== undefined && s.precioBase > 0
                ? ((s.precioBase - s.costoBase) / s.precioBase) * 100
                : null;
            return (
              <tr
                key={s.id}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150 text-gray-700 dark:text-gray-300"
              >
                <td className="px-6 py-4">
                  <div className="text-gray-800 dark:text-gray-100 font-semibold">{s.nombreServicio}</div>
                  {inventario && (s.sku || s.codigoBarras) && (
                    <div className="text-xs text-gray-400 font-normal tabular-nums">
                      {[s.sku, s.codigoBarras].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-400">{s.categoria?.nombre || "Sin Categoría"}</td>
                <td className="px-6 py-4 text-indigo-700 dark:text-indigo-400 font-extrabold tabular-nums">
                  {formatearMoneda(s.precioBase, monedaPrincipal)}
                  {config?.impuestoActivo && s.exentoImpuesto && (
                    <span className="ml-2 text-[10px] font-semibold uppercase text-gray-400">exento</span>
                  )}
                </td>

                {inventario ? (
                  <>
                    {veCosto && (
                      <>
                        <td className="px-6 py-4 tabular-nums text-gray-600 dark:text-gray-400">
                          {s.costoBase !== null && s.costoBase !== undefined ? formatearMoneda(s.costoBase, monedaPrincipal) : "—"}
                        </td>
                        <td
                          className={`px-6 py-4 tabular-nums font-semibold ${
                            margen === null
                              ? "text-gray-400"
                              : margen >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {margen === null ? "—" : `${margen.toFixed(1)}%`}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4">
                      {stock === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 tabular-nums font-semibold ${
                            stock === "ok"
                              ? "text-gray-700 dark:text-gray-300"
                              : stock === "bajo"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {stock !== "ok" && <FaExclamationTriangle size={11} />}
                          {s.stockActual}
                          {stock === "sin" && <span className="text-xs font-normal">agotado</span>}
                          {stock === "bajo" && <span className="text-xs font-normal">bajo</span>}
                        </span>
                      )}
                    </td>
                  </>
                ) : (
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400 max-w-[250px] truncate" title={s.descripcion || undefined}>
                    {s.descripcion || <span className="text-gray-400 dark:text-gray-600 italic">Sin descripción</span>}
                  </td>
                )}

                <td className="px-6 py-4 text-center">
                  <div className="inline-flex gap-2">
                    {hasRole(["ADMIN"]) && (
                      <Button onClick={() => onEditar(s)} title={`Editar ${et.servicioMin}`} variant="iconInfo" size="icon">
                        <FaPen size={12} />
                      </Button>
                    )}
                    {hasRole(["ADMIN"]) && (
                      <Button onClick={() => onEliminar(s.id)} title={`Eliminar ${et.servicioMin}`} variant="iconDanger" size="icon">
                        <FaTrashAlt size={12} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
