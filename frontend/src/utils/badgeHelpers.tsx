import type {
  EstadoOrden,
  EstadoPagoRaw,
  EstadoPagoTexto,
} from "@lavanderia/shared/types/types";

export type EstadoPagoDisplay = EstadoPagoRaw | EstadoPagoTexto;

const baseBadge = "inline-block px-3 py-1 rounded-full text-sm font-bold";

/**
 * @param
 * @returns
 */
export function badgeEstado(estado: EstadoOrden) {
  const map: Record<EstadoOrden, string> = {
    PENDIENTE: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400",
    ENTREGADO: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400",
  };

  const clase = map[estado] || "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
  return (
    <span className={`${baseBadge} ${clase}`} title={`Estado: ${estado}`}>
      {estado}
    </span>
  );
}

/**
 * @param
 * @returns
 */
export function badgePago(estadoPago: EstadoPagoDisplay) {
  const map: Record<EstadoPagoDisplay, string> = {
    INCOMPLETO: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    COMPLETO: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    "Sin pagos": "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    Parcial: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400",
    Pagado: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  };

  const clase = map[estadoPago] || "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  return (
    <span className={`${baseBadge} ${clase}`} title={`Pago: ${estadoPago}`}>
      {estadoPago}
    </span>
  );
}
