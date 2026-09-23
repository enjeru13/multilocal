import prisma from "./prisma";
import { calcularResumenPago } from "@lavanderia/shared/dist/utils/pagoFinance";
import type { OpcionesTotales, DescuentoTipo } from "@lavanderia/shared/dist/utils/totales";
import type { Moneda, TasasConversion } from "@lavanderia/shared/dist/types/types";

// Acepta el cliente normal o el de una transacción.
type Db = Pick<typeof prisma, "orden" | "configuracion">;

export async function cargarTasas(db: Pick<typeof prisma, "configuracion"> = prisma) {
  const config = await db.configuracion.findFirst();
  const principal = (config?.monedaPrincipal || "USD") as Moneda;
  const tasas: TasasConversion = { VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null };
  return { config, principal, tasas };
}

/** Opciones de impuesto/descuento tal como las guarda el perfil del negocio. */
export function opcionesTotales(
  config: {
    impuestoActivo?: boolean | null;
    impuestoTasa?: number | null;
    preciosIncluyenImpuesto?: boolean | null;
  } | null,
  descuento?: { tipo: DescuentoTipo; valor: number } | null
): OpcionesTotales {
  return {
    impuestoActivo: !!config?.impuestoActivo,
    impuestoTasa: config?.impuestoTasa ?? 0,
    preciosIncluyenImpuesto: config?.preciosIncluyenImpuesto ?? true,
    descuentoTipo: descuento?.tipo ?? null,
    descuentoValor: descuento?.valor ?? null,
  };
}

/** Recalcula abonado, faltante y estado de pago a partir de los pagos vigentes. */
export async function recalcularEstadoOrden(ordenId: number, db: Db = prisma) {
  const orden = await db.orden.findUnique({
    where: { id: ordenId },
    include: { pagos: { include: { vueltos: true } } },
  });
  if (!orden) throw new Error(`Orden con ID ${ordenId} no encontrada para recalcular estado.`);

  const config = await db.configuracion.findFirst();
  const principal = (config?.monedaPrincipal || "USD") as Moneda;
  const tasas: TasasConversion = { VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null };

  const pagos = orden.pagos.map((p) => ({ ...p, tasa: p.tasa ? Number(p.tasa) : null }));
  const resumen = calcularResumenPago({ total: orden.total, pagos }, tasas, principal);

  await db.orden.update({
    where: { id: ordenId },
    data: { abonado: resumen.abonado, faltante: resumen.faltante, estadoPago: resumen.estadoRaw },
  });
  return resumen;
}
