import type { Servicio } from "@lavanderia/shared/types/types";

/** null = no controla stock; "sin" = agotado; "bajo" = en o bajo el mínimo. */
export function estadoStock(s: Pick<Servicio, "controlaStock" | "stockActual" | "stockMinimo">): "sin" | "bajo" | "ok" | null {
  if (!s.controlaStock) return null;
  if (s.stockActual <= 0) return "sin";
  if (s.stockMinimo !== null && s.stockActual <= s.stockMinimo) return "bajo";
  return "ok";
}
