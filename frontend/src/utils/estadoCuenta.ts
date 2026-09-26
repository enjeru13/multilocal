import dayjs from "dayjs";
import type { CuentaPorCobrarCliente, Moneda } from "@lavanderia/shared/types/types";
import { convertirDesdePrincipal, formatearMoneda, type TasasConversion } from "./monedaHelpers";
import { limpiarYFormatearTelefono } from "./whatsappHelpers";

interface Opciones {
  negocio: string;
  moneda: Moneda;
  /** Otras monedas en las que se informa el total (solo las que tienen tasa). */
  otras: Moneda[];
  tasas: TasasConversion;
  /** Etiqueta de cada documento: "orden", "venta"… */
  documento: string;
}

/** Texto del estado de cuenta: cada documento con su saldo, el total y, si hay varias monedas, su equivalente. */
export function textoEstadoCuenta(c: CuentaPorCobrarCliente, o: Opciones): string {
  const fmt = (n: number) => formatearMoneda(n, o.moneda);
  const lineas = [...c.ordenes]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((d) => {
      const abono = d.abonado > 0.005 ? ` (total ${fmt(d.total)}, abonado ${fmt(d.abonado)})` : ` (total ${fmt(d.total)})`;
      return `• ${o.documento} #${d.id} del ${dayjs(d.fecha).format("DD/MM/YYYY")}: debe ${fmt(d.faltante)}${abono}`;
    });
  const equivalentes = o.otras
    .map((m) => convertirDesdePrincipal(c.monto, m, o.tasas, o.moneda))
    .map((v, i) => (v > 0 ? formatearMoneda(v, o.otras[i]) : null))
    .filter(Boolean);

  return [
    `Hola ${c.nombre} 👋`,
    "",
    `Te enviamos tu estado de cuenta de ${o.negocio}:`,
    "",
    ...lineas,
    "",
    `*Total pendiente: ${fmt(c.monto)}*${equivalentes.length > 0 ? ` (${equivalentes.join(" / ")})` : ""}`,
    "",
    "Cualquier duda, con gusto te ayudamos. ¡Gracias por tu preferencia!",
  ].join("\n");
}

/** Enlace de WhatsApp con el estado de cuenta, o null si no hay un teléfono válido. */
export function enlaceEstadoCuenta(c: CuentaPorCobrarCliente, telefono: string | null | undefined, o: Opciones): string | null {
  const destino = telefono ? limpiarYFormatearTelefono(telefono) : null;
  if (!destino) return null;
  return `https://api.whatsapp.com/send?phone=${destino}&text=${encodeURIComponent(textoEstadoCuenta(c, o))}`;
}
