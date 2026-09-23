import { Link } from "react-router-dom";
import { FaExclamationTriangle } from "react-icons/fa";
import type { DashboardData } from "@lavanderia/shared/types/types";
import GraficoBarras from "../charts/GraficoBarras";
import { useAuth } from "../../hooks/useAuth";
import { formatearMoneda } from "../../utils/monedaHelpers";

const tarjeta =
  "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5";

/** Tendencia de la semana y avisos. El servidor no la envía al cajero. */
export default function DashboardTendencia({ data }: { data: DashboardData | null }) {
  const { hasRole } = useAuth();
  if (!data?.ultimos7) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className={`${tarjeta} lg:col-span-2`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Últimos 7 días</h2>
          {hasRole(["ADMIN"]) && (
            <Link to="/reportes" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Ver reportes
            </Link>
          )}
        </div>
        <GraficoBarras datos={data.ultimos7} moneda={data.moneda} agrupar="dia" alto={190} />
      </section>

      <section className={tarjeta}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Atención</h2>
        {data.porPagar && data.porPagar.monto > 0 && (
          <Link
            to="/por-pagar"
            className="flex justify-between gap-3 text-sm mb-3 pb-3 border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <span>Por pagar a proveedores</span>
            <strong className="tabular-nums">{formatearMoneda(data.porPagar.monto, data.moneda)}</strong>
          </Link>
        )}
        {data.stockBajo && data.stockBajo.cantidad > 0 ? (
          <div className="text-sm">
            <p className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium mb-2">
              <FaExclamationTriangle /> Stock bajo ({data.stockBajo.cantidad})
            </p>
            <ul className="space-y-1.5 text-gray-600 dark:text-gray-400">
              {data.stockBajo.items.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span className="truncate">{s.nombreServicio}</span>
                  <span className="tabular-nums shrink-0">
                    {s.stockActual} / mín. {s.stockMinimo}
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/inventario" className="inline-block mt-3 text-blue-600 dark:text-blue-400 hover:underline">
              Ir al inventario
            </Link>
          </div>
        ) : (
          !(data.porPagar && data.porPagar.monto > 0) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Todo en orden por ahora.</p>
          )
        )}
      </section>
    </div>
  );
}
