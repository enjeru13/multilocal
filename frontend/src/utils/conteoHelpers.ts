import type { ConteoInventario } from "@lavanderia/shared/types/types";

export const nombreConteo = (c: Pick<ConteoInventario, "id" | "nombre">) => c.nombre || `Conteo #${c.id}`;
