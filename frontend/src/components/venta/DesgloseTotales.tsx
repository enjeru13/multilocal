import type { Moneda } from "@lavanderia/shared/types/types";
import type { TotalesCalculados } from "@lavanderia/shared/utils/totales";
import { formatearMoneda } from "../../utils/monedaHelpers";
import { useConfiguracion } from "../../context/configuracionCore";

interface Props {
  totales: Pick<TotalesCalculados, "subtotal" | "descuento" | "impuesto" | "total">;
  moneda: Moneda;
  /** Tamaño del total: "lg" para el mostrador, "md" en paneles. */
  tamano?: "md" | "lg";
}

/** Subtotal, descuento, impuesto y total: solo muestra lo que aplica. */
export default function DesgloseTotales({ totales, moneda, tamano = "md" }: Props) {
  const { config } = useConfiguracion();
  const nombre = config?.impuestoNombre || "IVA";
  const incluido = config?.preciosIncluyenImpuesto ?? true;
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const mostrarDetalle = totales.descuento > 0 || totales.impuesto > 0;

  const fila = (etiqueta: string, valor: string, clase = "") => (
    <div className={`flex justify-between text-sm ${clase}`}>
      <span className="text-gray-500 dark:text-gray-400">{etiqueta}</span>
      <span className="tabular-nums text-gray-700 dark:text-gray-300">{valor}</span>
    </div>
  );

  return (
    <div className="space-y-1">
      {mostrarDetalle && fila("Subtotal", fmt(totales.subtotal))}
      {totales.descuento > 0 && fila("Descuento", `− ${fmt(totales.descuento)}`, "text-emerald-600")}
      {totales.impuesto > 0 &&
        fila(
          `${nombre}${config?.impuestoTasa ? ` (${config.impuestoTasa}%)` : ""}${incluido ? " incluido" : ""}`,
          fmt(totales.impuesto)
        )}
      <div className="flex justify-between items-baseline pt-1">
        <span className="text-gray-600 dark:text-gray-400 font-semibold">Total</span>
        <span
          className={`font-extrabold text-gray-900 dark:text-gray-100 tabular-nums ${
            tamano === "lg" ? "text-3xl" : "text-2xl"
          }`}
        >
          {fmt(totales.total)}
        </span>
      </div>
    </div>
  );
}
