import dayjs from "dayjs";
import type { Configuracion, Orden, ReciboData } from "@lavanderia/shared/types/types";
import { normalizarMoneda } from "./monedaHelpers";

const METODO_TEXTO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", PAGO_MOVIL: "Pago móvil" };

/**
 * Datos del recibo de una orden. `abonado` es lo pagado en moneda principal (ya neto de
 * vueltos) y `observaciones` puede sobrescribirse si se están editando.
 */
export function reciboDeOrden(
  orden: Orden,
  config: Configuracion | null,
  opciones: { atendio?: string | null; abonado: number; observaciones?: string | null }
): ReciboData {
  const piezas = orden.detalles?.reduce((s, d) => s + (d.servicio?.permiteDecimales ? 1 : d.cantidad), 0) ?? 0;
  const observaciones = (opciones.observaciones ?? orden.observaciones ?? "").trim();

  return {
    clienteInfo: {
      nombre: orden.cliente?.nombre ?? "Sin cliente",
      apellido: orden.cliente?.apellido ?? "",
      identificacion: orden.cliente?.identificacion ?? "",
      fechaIngreso: dayjs(orden.fechaIngreso).isValid() ? dayjs(orden.fechaIngreso).toDate() : new Date(),
      fechaEntrega: orden.fechaEntrega && dayjs(orden.fechaEntrega).isValid() ? dayjs(orden.fechaEntrega).toDate() : null,
      telefono: orden.cliente?.telefono ?? "",
      telefono_secundario: orden.cliente?.telefono_secundario ?? "",
      email: orden.cliente?.email ?? null,
    },
    items:
      orden.detalles?.map((d) => ({
        descripcion: d.servicio?.nombreServicio ?? "Descripción no disponible",
        cantidad: d.cantidad,
        precioUnitario: d.precioUnit,
        permiteDecimales: d.servicio?.permiteDecimales ?? false,
      })) ?? [],
    abono: opciones.abonado,
    atendio: opciones.atendio ?? null,
    total: orden.total,
    numeroOrden: orden.id,
    observaciones: observaciones === "" ? null : observaciones,
    lavanderiaInfo: {
      nombre: config?.nombreNegocio ?? "Mi negocio",
      rif: config?.rif ?? null,
      direccion: config?.direccion ?? null,
      telefonoPrincipal: config?.telefonoPrincipal ?? null,
      telefonoSecundario: config?.telefonoSecundario ?? null,
    },
    mensajePieRecibo: config?.mensajePieRecibo === "" ? null : config?.mensajePieRecibo ?? null,
    monedaPrincipal: normalizarMoneda(config?.monedaPrincipal ?? "USD"),
    totalCantidadPiezas: piezas,
    pagos: (orden.pagos ?? [])
      .filter((p) => p.monto > 0)
      .map((p) => ({
        metodo: METODO_TEXTO[p.metodoPago] ?? p.metodoPago,
        moneda: p.moneda,
        monto: p.monto,
        vueltos: (p.vueltos ?? []).map((v) => ({ monto: v.monto, moneda: v.moneda })),
      })),
    desglose:
      orden.descuento > 0 || orden.impuesto > 0 || orden.devuelto > 0
        ? {
            subtotal: orden.subtotal,
            descuento: orden.descuento,
            impuesto: orden.impuesto,
            impuestoNombre: config?.impuestoNombre || "IVA",
            impuestoTasa: orden.impuestoTasa,
            impuestoIncluido: config?.preciosIncluyenImpuesto ?? true,
            devuelto: orden.devuelto,
          }
        : undefined,
  };
}
