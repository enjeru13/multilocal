import type { Presupuesto } from "@lavanderia/shared/types/types";
import { ESTADOS_PRESUPUESTO } from "../../utils/presupuestoHelpers";

/** Pastilla con el estado de un presupuesto (los pendientes pasados de fecha figuran como vencidos). */
export default function EtiquetaEstado({ p }: { p: Pick<Presupuesto, "estadoVisible"> }) {
  const e = ESTADOS_PRESUPUESTO[p.estadoVisible];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${e.clases}`}>{e.label}</span>;
}
