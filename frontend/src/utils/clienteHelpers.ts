import type { Cliente } from "@lavanderia/shared/types/types";

type ClienteMinimo = Pick<Cliente, "nombre"> & Partial<Pick<Cliente, "apellido">>;

/** Nombre completo para mostrar; las ventas de mostrador no tienen cliente. */
export function nombreCliente(
  cliente: ClienteMinimo | null | undefined,
  sinCliente = "Sin cliente"
): string {
  if (!cliente) return sinCliente;
  return `${cliente.nombre} ${cliente.apellido ?? ""}`.trim() || sinCliente;
}
