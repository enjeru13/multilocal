import { Link } from "react-router-dom";
import { FaCoins, FaExclamationTriangle } from "react-icons/fa";
import type { DashboardData } from "@lavanderia/shared/types/types";
import { convertirDesdePrincipal, formatearMoneda, tasaCruzada, NOMBRE_MONEDA, type Moneda } from "../../utils/monedaHelpers";
import { useMonedas } from "../../context/useMonedas";
import { useAuth } from "../../hooks/useAuth";

/**
 * Las monedas del negocio y las tasas que se están usando hoy, con lo vendido y cobrado
 * expresado en cada una. Se ajusta solo: con una única moneda muestra un aviso breve.
 */
export default function PanelMonedas({ data }: { data: DashboardData | null }) {
  const negocio = useMonedas();
  const { hasRole } = useAuth();
  const { principal, activas, tasas } = negocio;

  // Unidad de referencia de las tasas: el dólar si se usa; si no, la moneda principal.
  const referencia: Moneda = activas.includes("USD") ? "USD" : principal;
  const pares = activas
    .filter((m) => m !== referencia)
    .map((m) => ({ moneda: m, tasa: tasaCruzada(m, referencia, tasas) }));

  const esAdmin = hasRole(["ADMIN"]);
  const sinTasa = pares.filter((p) => p.tasa === null);

  // Lo vendido/cobrado hoy es dinero: el servidor solo lo manda si eres ADMIN.
  const hoy =
    data && data.ventasHoy !== undefined && data.cobradoHoy !== undefined
      ? activas.map((m) => ({
          moneda: m,
          ventas: convertirDesdePrincipal(data.ventasHoy as number, m, tasas, principal),
          cobrado: convertirDesdePrincipal(data.cobradoHoy as number, m, tasas, principal),
          ok: negocio.disponible(m),
        }))
      : [];

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <FaCoins className="text-amber-500" /> Monedas y tasas
        </h2>
        {esAdmin && (
          <Link to="/configuracion" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            {activas.length > 1 ? "Actualizar tasas" : "Configurar monedas"}
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tasas en uso</p>
          {pares.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Trabajas solo en <strong>{NOMBRE_MONEDA[principal].toLowerCase()}</strong>: no hay conversiones.
            </p>
          ) : (
            <ul className="space-y-2">
              {pares.map((p) => (
                <li key={p.moneda} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-950/40 border border-gray-100 dark:border-gray-800 px-3.5 py-2.5">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    1 {referencia} <span className="text-gray-400">→</span> {p.moneda}
                  </span>
                  {p.tasa === null ? (
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1.5">
                      <FaExclamationTriangle size={11} /> Sin tasa
                    </span>
                  ) : (
                    <strong className="text-base tabular-nums text-gray-900 dark:text-gray-100">{formatearMoneda(p.tasa, p.moneda)}</strong>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Moneda principal: <strong className="text-gray-700 dark:text-gray-300">{principal}</strong>
            {activas.length > 1 && <> · Activas: {activas.join(", ")}</>}
          </p>
          {sinTasa.length > 0 && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Falta definir la tasa de {sinTasa.map((p) => p.moneda).join(" y ")}: hasta entonces no se puede cobrar en {sinTasa.length > 1 ? "esas monedas" : "esa moneda"}.
            </p>
          )}
        </div>

        {data && hoy.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Hoy, en cada moneda</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="text-left font-semibold pb-1">Moneda</th>
                  <th className="text-right font-semibold pb-1">Facturado</th>
                  <th className="text-right font-semibold pb-1">Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {hoy.map((h) => (
                  <tr key={h.moneda} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 text-gray-600 dark:text-gray-300">
                      {h.moneda}
                      {h.moneda === principal && <span className="ml-1.5 text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">principal</span>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{h.ok ? formatearMoneda(h.ventas, h.moneda) : "—"}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{h.ok ? formatearMoneda(h.cobrado, h.moneda) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hoy.length > 1 && <p className="mt-1.5 text-[11px] text-gray-400">Equivalencias con las tasas actuales; lo cobrado se registra en la moneda en que entregó cada cliente.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
