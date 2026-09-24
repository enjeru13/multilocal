import { calcularTotalAbonado } from "@lavanderia/shared/dist/utils/pagoFinance";
import { valorVigente } from "@lavanderia/shared/dist/utils/totales";
import { diasDeAntiguedad, resumirAntiguedad } from "@lavanderia/shared/dist/utils/antiguedad";
import type { CuentaPorCobrarCliente, CuentasPorCobrar, Moneda, TasasConversion } from "@lavanderia/shared/dist/types/types";

// Agregaciones puras para reportes. Todo importe sale en moneda principal:
// las ventas ya están guardadas así y los pagos se convierten con la tasa
// congelada de cada uno (netos de vueltos), igual que en el resto del sistema.

export interface DetalleReporte {
  servicioId: number;
  cantidad: number;
  subtotal: number;
  costoUnit: number | null;
  descuento: number;
  impuesto: number;
  base: number;
  cantidadDevuelta: number;
  servicio: { nombreServicio: string };
}

export interface OrdenReporte {
  id: number;
  fechaIngreso: Date;
  estado: string;
  total: number;
  descuento: number;
  impuesto: number;
  clienteId: number | null;
  cliente: { nombre: string; apellido: string | null } | null;
  detalles: DetalleReporte[];
}

export interface PagoReporte {
  monto: number;
  moneda: string;
  metodoPago: string;
  tasa: number | null;
  fechaPago: Date;
  vueltos: { monto: number; moneda: string }[];
  orden: { estado: string };
}

export type Agrupacion = "dia" | "mes";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

/** Fechas en hora local de la máquina: el negocio cierra su día donde está. */
export const claveDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const claveMes = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function parseFechaLocal(valor: string, finDeDia: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = finDeDia ? new Date(y, mo - 1, d, 23, 59, 59, 999) : new Date(y, mo - 1, d, 0, 0, 0, 0);
  // rechaza 2026-02-31 y similares
  if (fecha.getMonth() !== mo - 1 || fecha.getDate() !== d) return null;
  return fecha;
}

/** Lista las claves de cada día/mes del rango, para que la serie no tenga huecos. */
export function clavesDelRango(desde: Date, hasta: Date, agrupar: Agrupacion): string[] {
  const claves: string[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), agrupar === "mes" ? 1 : desde.getDate());
  while (cursor <= hasta) {
    claves.push(agrupar === "mes" ? claveMes(cursor) : claveDia(cursor));
    if (agrupar === "mes") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return claves;
}

/** Días calendario entre dos fechas, ambos incluidos (a prueba de cambios de hora). */
export function diasInclusivos(desde: Date, hasta: Date): number {
  const a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b - a) / 86_400_000) + 1;
}

export function elegirAgrupacion(desde: Date, hasta: Date): Agrupacion {
  return diasInclusivos(desde, hasta) > 92 ? "mes" : "dia";
}

/** Un pago en moneda principal, neto de vueltos. Los pagos de órdenes anuladas no cuentan. */
export function pagoEnPrincipal(p: PagoReporte, tasas: TasasConversion, principal: Moneda): number {
  if (p.orden.estado === "CANCELADO") return 0;
  return calcularTotalAbonado(
    [{ monto: p.monto, moneda: p.moneda as Moneda, tasa: p.tasa, vueltos: p.vueltos }],
    tasas,
    principal
  );
}

export function resumirVentas(ordenes: OrdenReporte[]) {
  const vigentes = ordenes.filter((o) => o.estado !== "CANCELADO");
  const total = vigentes.reduce((s, o) => s + o.total, 0);
  return {
    cantidad: vigentes.length,
    canceladas: ordenes.length - vigentes.length,
    total: r2(total),
    ticketPromedio: vigentes.length ? r2(total / vigentes.length) : 0,
    descuentos: r2(vigentes.reduce((s, o) => s + o.descuento, 0)),
    impuestos: r2(vigentes.reduce((s, o) => s + o.impuesto, 0)),
  };
}

export function resumirCobros(pagos: PagoReporte[], tasas: TasasConversion, principal: Moneda) {
  const vigentes = pagos.filter((p) => p.orden.estado !== "CANCELADO");
  let total = 0;
  const porMetodo = new Map<string, number>();
  const porMoneda = new Map<string, { recibido: number; vueltos: number }>();

  for (const p of vigentes) {
    const enPrincipal = pagoEnPrincipal(p, tasas, principal);
    total += enPrincipal;
    porMetodo.set(p.metodoPago, (porMetodo.get(p.metodoPago) ?? 0) + enPrincipal);

    const fila = porMoneda.get(p.moneda) ?? { recibido: 0, vueltos: 0 };
    fila.recibido += p.monto;
    porMoneda.set(p.moneda, fila);
    for (const v of p.vueltos) {
      const filaV = porMoneda.get(v.moneda) ?? { recibido: 0, vueltos: 0 };
      filaV.vueltos += v.monto;
      porMoneda.set(v.moneda, filaV);
    }
  }

  return {
    total: r2(total),
    cantidad: vigentes.length,
    porMetodo: [...porMetodo.entries()]
      .map(([metodo, monto]) => ({ metodo, monto: r2(monto) }))
      .sort((a, b) => b.monto - a.monto),
    porMoneda: [...porMoneda.entries()].map(([moneda, v]) => ({
      moneda,
      recibido: r2(v.recibido),
      vueltos: r2(v.vueltos),
      neto: r2(v.recibido - v.vueltos),
    })),
  };
}

/** Ganancia solo sobre líneas con costo conocido; las demás se reportan aparte. */
export function resumirGanancia(ordenes: OrdenReporte[]) {
  let ventaConCosto = 0;
  let costo = 0;
  let ventaSinCosto = 0;
  let lineasSinCosto = 0;
  for (const o of ordenes) {
    if (o.estado === "CANCELADO") continue;
    for (const d of o.detalles) {
      // Ingreso sin impuesto y neto de devoluciones; el costo, de las unidades que se quedaron.
      const vigente = valorVigente(d);
      if (d.costoUnit === null || d.costoUnit === undefined) {
        ventaSinCosto += vigente.base;
        lineasSinCosto += 1;
      } else {
        ventaConCosto += vigente.base;
        costo += d.costoUnit * (d.cantidad - d.cantidadDevuelta);
      }
    }
  }
  const ganancia = ventaConCosto - costo;
  return {
    ventaConCosto: r2(ventaConCosto),
    costo: r2(costo),
    ganancia: r2(ganancia),
    margen: ventaConCosto > 0 ? r2((ganancia / ventaConCosto) * 100) : null,
    ventaSinCosto: r2(ventaSinCosto),
    lineasSinCosto,
  };
}

export function serieTemporal(
  ordenes: OrdenReporte[],
  pagos: PagoReporte[],
  desde: Date,
  hasta: Date,
  agrupar: Agrupacion,
  tasas: TasasConversion,
  principal: Moneda
) {
  const clave = agrupar === "mes" ? claveMes : claveDia;
  const filas = new Map(clavesDelRango(desde, hasta, agrupar).map((k) => [k, { fecha: k, ventas: 0, cantidad: 0, cobrado: 0 }]));
  for (const o of ordenes) {
    if (o.estado === "CANCELADO") continue;
    const fila = filas.get(clave(o.fechaIngreso));
    if (fila) {
      fila.ventas += o.total;
      fila.cantidad += 1;
    }
  }
  for (const p of pagos) {
    const fila = filas.get(clave(p.fechaPago));
    if (fila) fila.cobrado += pagoEnPrincipal(p, tasas, principal);
  }
  return [...filas.values()].map((f) => ({ ...f, ventas: r2(f.ventas), cobrado: r2(f.cobrado) }));
}

export function topItems(ordenes: OrdenReporte[], limite = 50) {
  const mapa = new Map<number, { servicioId: number; nombre: string; cantidad: number; total: number; ganancia: number | null }>();
  for (const o of ordenes) {
    if (o.estado === "CANCELADO") continue;
    for (const d of o.detalles) {
      const fila = mapa.get(d.servicioId) ?? {
        servicioId: d.servicioId,
        nombre: d.servicio.nombreServicio,
        cantidad: 0,
        total: 0,
        ganancia: null,
      };
      const vigente = valorVigente(d);
      const unidades = d.cantidad - d.cantidadDevuelta;
      fila.cantidad += unidades;
      fila.total += vigente.total;
      if (d.costoUnit !== null && d.costoUnit !== undefined) {
        fila.ganancia = (fila.ganancia ?? 0) + vigente.base - d.costoUnit * unidades;
      }
      mapa.set(d.servicioId, fila);
    }
  }
  return [...mapa.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limite)
    .map((f) => ({ ...f, cantidad: r2(f.cantidad), total: r2(f.total), ganancia: f.ganancia === null ? null : r2(f.ganancia) }));
}

export function topClientes(ordenes: OrdenReporte[], limite = 10) {
  const mapa = new Map<number, { clienteId: number; nombre: string; ventas: number; total: number }>();
  let sinCliente = { ventas: 0, total: 0 };
  for (const o of ordenes) {
    if (o.estado === "CANCELADO") continue;
    if (o.clienteId === null || !o.cliente) {
      sinCliente = { ventas: sinCliente.ventas + 1, total: sinCliente.total + o.total };
      continue;
    }
    const fila = mapa.get(o.clienteId) ?? {
      clienteId: o.clienteId,
      nombre: `${o.cliente.nombre} ${o.cliente.apellido ?? ""}`.trim(),
      ventas: 0,
      total: 0,
    };
    fila.ventas += 1;
    fila.total += o.total;
    mapa.set(o.clienteId, fila);
  }
  return {
    top: [...mapa.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, limite)
      .map((f) => ({ ...f, total: r2(f.total) })),
    sinCliente: { ventas: sinCliente.ventas, total: r2(sinCliente.total) },
  };
}

export interface OrdenPorCobrar {
  id: number;
  fechaIngreso: Date;
  total: number;
  abonado: number;
  faltante: number;
  clienteId: number | null;
  cliente: { nombre: string; apellido: string | null; telefono: string | null } | null;
}

/**
 * Deudas de clientes agrupadas por cliente, la más grande primero, con la antigüedad de
 * cada una y el resumen por tramos. Las ventas sin cliente van juntas en un solo renglón.
 */
export function agruparPorCobrar(
  ordenes: OrdenPorCobrar[],
  moneda: Moneda,
  hoy: Date = new Date()
): CuentasPorCobrar {
  const grupos = new Map<string, CuentaPorCobrarCliente>();
  const items: { dias: number; monto: number }[] = [];

  for (const o of ordenes) {
    const dias = diasDeAntiguedad(o.fechaIngreso, hoy);
    const clave = o.clienteId === null ? "sin" : String(o.clienteId);
    const g =
      grupos.get(clave) ??
      ({
        clienteId: o.clienteId,
        nombre: o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido ?? ""}`.trim() : "Sin cliente",
        telefono: o.cliente?.telefono ?? null,
        monto: 0,
        masAntigua: 0,
        ordenes: [],
      } satisfies CuentaPorCobrarCliente);
    g.monto += o.faltante;
    g.masAntigua = Math.max(g.masAntigua, dias);
    g.ordenes.push({ id: o.id, fecha: o.fechaIngreso.toISOString(), total: o.total, abonado: o.abonado, faltante: o.faltante, dias });
    grupos.set(clave, g);
    items.push({ dias, monto: o.faltante });
  }

  const clientes = [...grupos.values()]
    .map((g) => ({ ...g, monto: r2(g.monto), ordenes: g.ordenes.sort((a, b) => b.dias - a.dias) }))
    .sort((a, b) => b.monto - a.monto);

  return {
    moneda,
    corte: hoy.toISOString(),
    cantidad: ordenes.length,
    monto: r2(ordenes.reduce((s, o) => s + o.faltante, 0)),
    antiguedad: resumirAntiguedad(items),
    clientes,
  };
}
