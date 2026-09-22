import { Orden } from "@lavanderia/shared/types/types";
import {
  TasasConversion,
  formatearMoneda,
  convertirDesdePrincipal,
} from "./monedaHelpers";

/**
 * Función auxiliar inteligente para detectar país automáticamente
 * Prioridad: Colombia (57) y Venezuela (58)
 */
const limpiarYFormatearTelefono = (telefono: string): string | null => {
  // 1. Quitar todo lo que no sea número
  const tel = telefono.replace(/\D/g, "");

  // Si quedó vacío
  if (!tel || tel.length < 10) return null;

  // CASO 1: Ya tiene el código 57 (Colombia) o 58 (Venezuela) al inicio
  if (tel.startsWith("57") && tel.length === 12) return tel;
  if (tel.startsWith("58") && tel.length >= 12) return tel;

  // CASO 2: Celular Colombia (Empiezan por 3 y tienen 10 dígitos, ej: 3001234567)
  // Se le agrega el 57
  if (tel.length === 10 && tel.startsWith("3")) {
    return `57${tel}`;
  }

  // CASO 3: Celular Venezuela con 0 (Ej: 04141234567 - 11 dígitos)
  // Se quita el 0 y se agrega 58
  if (tel.length === 11 && tel.startsWith("04")) {
    return `58${tel.substring(1)}`;
  }

  // CASO 4: Celular Venezuela sin 0 (Ej: 4141234567 - 10 dígitos)
  // Se agrega el 58
  if (tel.length === 10 && tel.startsWith("4")) {
    return `58${tel}`;
  }

  // CASO 5: Fallback (por defecto)
  // Si no cumple ninguna anterior, asumimos que es un número local de tu país principal.
  // CAMBIA "57" por tu país principal si es necesario.
  if (tel.length === 10) {
    return `57${tel}`;
  }

  // Si el número es muy largo, asumimos que ya es internacional y lo devolvemos tal cual
  return tel;
};

/**
 * @param orden
 * @param nombreNegocio
 * @param tasas
 * @returns
 */
export const generarEnlaceWhatsApp = (
  orden: Orden,
  nombreNegocio: string,
  tasas?: TasasConversion
): string | null => {
  const cliente = orden.cliente;
  if (!cliente || !cliente.telefono) return null;

  // --- APLICAMOS LA LÓGICA AUTOMÁTICA AQUÍ ---
  const telefonoParaLink = limpiarYFormatearTelefono(cliente.telefono);

  if (!telefonoParaLink) return null;
  // --------------------------------------------

  const nombreCliente = `${cliente.nombre} ${cliente.apellido}`.trim();

  let cuentaPendiente =
    orden.faltante > 0 ? formatearMoneda(orden.faltante, "USD") : "Pagada";

  if (orden.faltante > 0 && tasas) {
    const montosExtra: string[] = [];

    if (tasas.VES && tasas.VES > 0) {
      const montosVES = convertirDesdePrincipal(orden.faltante, "VES", tasas);
      montosExtra.push(formatearMoneda(montosVES, "VES"));
    }

    if (tasas.COP && tasas.COP > 0) {
      const montosCOP = convertirDesdePrincipal(orden.faltante, "COP", tasas);
      montosExtra.push(formatearMoneda(montosCOP, "COP"));
    }

    if (montosExtra.length > 0) {
      cuentaPendiente += ` (${montosExtra.join(" / ")})`;
    }
  }

  const mensaje = `Hola ${nombreCliente} 👋

Te escribimos de la ${nombreNegocio} para informarte que tu orden #${orden.id} ya está lista para retirar ✅.

Cuenta pendiente: ${cuentaPendiente}

¡Te esperamos!
Gracias por tu preferencia.`;

  // Usamos api.whatsapp.com que es más compatible para inyectar mensajes
  return `https://api.whatsapp.com/send?phone=${telefonoParaLink}&text=${encodeURIComponent(
    mensaje
  )}`;
};
