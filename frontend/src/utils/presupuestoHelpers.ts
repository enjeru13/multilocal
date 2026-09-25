import dayjs from "dayjs";
import type { EstadoPresupuestoVisible, Presupuesto } from "@lavanderia/shared/types/types";
import { limpiarYFormatearTelefono } from "./whatsappHelpers";
import { formatearMoneda, type Moneda } from "./monedaHelpers";

export const ESTADOS_PRESUPUESTO: Record<EstadoPresupuestoVisible, { label: string; clases: string }> = {
  BORRADOR: { label: "Borrador", clases: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  ENVIADO: { label: "Enviado", clases: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
  ACEPTADO: { label: "Aceptado", clases: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  RECHAZADO: { label: "Rechazado", clases: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
  VENCIDO: { label: "Vencido", clases: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  CONVERTIDO: { label: "Convertido en venta", clases: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300" },
};

/**
 * Días que faltan para que venza un presupuesto pendiente (0 = vence hoy), o null si ya está
 * resuelto o vencido. Sirve para avisar de los que están por vencer.
 */
export function diasParaVencer(p: Pick<Presupuesto, "estado" | "estadoVisible" | "validoHasta">): number | null {
  if (p.estadoVisible === "VENCIDO" || (p.estado !== "BORRADOR" && p.estado !== "ENVIADO")) return null;
  return dayjs(p.validoHasta).startOf("day").diff(dayjs().startOf("day"), "day");
}

export function textoVencimiento(dias: number): string {
  return dias <= 0 ? "Vence hoy" : dias === 1 ? "Vence mañana" : `Vence en ${dias} días`;
}

/** A quién va dirigido: el cliente registrado o el contacto que se escribió. */
export function destinatarioPresupuesto(p: Pick<Presupuesto, "cliente" | "contactoNombre">): string {
  if (p.cliente) return `${p.cliente.nombre} ${p.cliente.apellido ?? ""}`.trim();
  return p.contactoNombre || "Sin nombre";
}

export function telefonoPresupuesto(p: Pick<Presupuesto, "cliente" | "contactoTelefono">): string | null {
  return p.cliente?.telefono || p.contactoTelefono || null;
}

/** Enlace de WhatsApp con el resumen del presupuesto, o null si no hay un teléfono válido. */
export function enlaceWhatsAppPresupuesto(p: Presupuesto, negocio: string, moneda: Moneda): string | null {
  const tel = telefonoPresupuesto(p);
  const destino = tel ? limpiarYFormatearTelefono(tel) : null;
  if (!destino) return null;

  const lineas = (p.detalles ?? []).map((d) => `• ${d.cantidad} × ${d.descripcion}: ${formatearMoneda(d.subtotal, moneda)}`);
  const mensaje = [
    `Hola ${destinatarioPresupuesto(p)} 👋`,
    "",
    `Te enviamos el presupuesto N.º ${p.id} de ${negocio}:`,
    "",
    ...lineas,
    "",
    `*Total: ${formatearMoneda(p.total, moneda)}*`,
    `Válido hasta el ${dayjs(p.validoHasta).format("DD/MM/YYYY")}.`,
    ...(p.observaciones ? ["", p.observaciones] : []),
    "",
    "Quedamos atentos a tu respuesta. ¡Gracias!",
  ].join("\n");

  return `https://api.whatsapp.com/send?phone=${destino}&text=${encodeURIComponent(mensaje)}`;
}
