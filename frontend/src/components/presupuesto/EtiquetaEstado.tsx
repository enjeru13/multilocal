import type { Presupuesto } from "@lavanderia/shared/types/types";
import { diasParaVencer, ESTADOS_PRESUPUESTO, textoVencimiento } from "../../utils/presupuestoHelpers";

/** Pastilla con el estado de un presupuesto (los pendientes pasados de fecha figuran como vencidos). */
export default function EtiquetaEstado({ p, conAviso = false }: { p: Pick<Presupuesto, "estado" | "estadoVisible" | "validoHasta">; conAviso?: boolean }) {
  const e = ESTADOS_PRESUPUESTO[p.estadoVisible];
  const dias = conAviso ? diasParaVencer(p) : null;
  const pastilla = <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${e.clases}`}>{e.label}</span>;
  if (dias === null || dias > 3) return pastilla;
  return (
    <span className="inline-flex items-center gap-1.5">
      {pastilla}
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{textoVencimiento(dias)}</span>
    </span>
  );
}
