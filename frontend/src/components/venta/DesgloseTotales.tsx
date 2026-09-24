import type { Moneda } from "@lavanderia/shared/types/types";
import type { TotalesCalculados } from "@lavanderia/shared/utils/totales";
import { formatearMoneda } from "../../utils/monedaHelpers";
import { Link } from "react-router-dom";
import { useConfiguracion } from "../../context/configuracionCore";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  totales: Pick<TotalesCalculados, "subtotal" | "descuento" | "impuesto" | "total"> & { base?: number };
  moneda: Moneda;
  /** Tamaño del total: "lg" para el mostrador, "md" en paneles. */
  tamano?: "md" | "lg";
}

/**
 * Subtotal, descuento, impuesto y total. Con "precios incluyen impuesto" el
 * impuesto ya va dentro del precio: se muestra la base y el impuesto que
 * componen el total, sin sumarlos otra vez. Si no, el impuesto se suma encima.
 */
export default function DesgloseTotales({ totales, moneda, tamano = "md" }: Props) {
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const nombre = config?.impuestoNombre || "IVA";
  const incluido = config?.preciosIncluyenImpuesto ?? true;
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const conImpuesto = totales.impuesto > 0;
  const base = totales.base ?? Math.round((totales.total - totales.impuesto) * 100) / 100;
  const mostrarDetalle = totales.descuento > 0 || conImpuesto;
  const etiquetaImpuesto = `${nombre}${config?.impuestoTasa ? ` ${config.impuestoTasa}%` : ""}`;

  const fila = (etiqueta: React.ReactNode, valor: string, opciones: { clase?: string; sangria?: boolean } = {}) => (
    <div className={`flex justify-between items-center text-sm ${opciones.sangria ? "pl-3" : ""} ${opciones.clase ?? ""}`}>
      <span className="text-gray-500 dark:text-gray-400">{etiqueta}</span>
      <span className="tabular-nums text-gray-700 dark:text-gray-300">{valor}</span>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {mostrarDetalle && fila("Subtotal", fmt(totales.subtotal))}
      {totales.descuento > 0 && fila("Descuento", `− ${fmt(totales.descuento)}`, { clase: "[&>span]:text-emerald-600 dark:[&>span]:text-emerald-400" })}
      {conImpuesto && !incluido && fila(etiquetaImpuesto, `+ ${fmt(totales.impuesto)}`)}

      <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 dark:border-gray-800">
        <span className="text-gray-700 dark:text-gray-300 font-semibold">Total</span>
        <span className={`font-extrabold text-gray-900 dark:text-gray-100 tabular-nums ${tamano === "lg" ? "text-3xl" : "text-2xl"}`}>{fmt(totales.total)}</span>
      </div>

      {conImpuesto && incluido && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-950/40 border border-gray-100 dark:border-gray-800 px-3 py-2 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">El total incluye {nombre}</p>
          {fila("Base sin impuesto", fmt(base))}
          {fila(etiquetaImpuesto, fmt(totales.impuesto))}
          {hasRole(["ADMIN"]) && (
            <Link to="/configuracion" className="block text-[11px] text-blue-600 dark:text-blue-400 hover:underline pt-0.5">
              ¿Tus precios no incluyen {nombre}? Cámbialo en Configuración
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
