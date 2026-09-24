import { Request, Response } from "express";
import prisma from "../lib/prisma";
import type { Moneda, TasasConversion } from "@lavanderia/shared/dist/types/types";
import {
  agruparPorCobrar,
  diasInclusivos,
  elegirAgrupacion,
  parseFechaLocal,
  resumirCobros,
  resumirGanancia,
  resumirVentas,
  serieTemporal,
  topClientes,
  topItems,
  type OrdenReporte,
  type PagoReporte,
} from "../lib/reportes";

const MAX_DIAS = 366 * 5;

async function cargarContexto() {
  const config = await prisma.configuracion.findFirst();
  const principal = (config?.monedaPrincipal || "USD") as Moneda;
  const tasas: TasasConversion = { VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null };
  return { principal, tasas };
}

async function cargarRango(desde: Date, hasta: Date) {
  const [ordenes, pagos] = await Promise.all([
    prisma.orden.findMany({
      where: { fechaIngreso: { gte: desde, lte: hasta } },
      select: {
        id: true,
        fechaIngreso: true,
        estado: true,
        total: true,
        descuento: true,
        impuesto: true,
        clienteId: true,
        cliente: { select: { nombre: true, apellido: true } },
        detalles: {
          select: {
            servicioId: true,
            cantidad: true,
            subtotal: true,
            costoUnit: true,
            descuento: true,
            impuesto: true,
            base: true,
            cantidadDevuelta: true,
            servicio: { select: { nombreServicio: true } },
          },
        },
      },
    }),
    prisma.pago.findMany({
      where: { fechaPago: { gte: desde, lte: hasta } },
      select: {
        monto: true,
        moneda: true,
        metodoPago: true,
        tasa: true,
        fechaPago: true,
        vueltos: { select: { monto: true, moneda: true } },
        orden: { select: { estado: true } },
      },
    }),
  ]);
  return { ordenes: ordenes as OrdenReporte[], pagos: pagos as PagoReporte[] };
}

async function stockBajo(limite = 20) {
  const items = await prisma.servicio.findMany({
    where: { controlaStock: true, stockMinimo: { not: null } },
    select: { id: true, nombreServicio: true, stockActual: true, stockMinimo: true },
  });
  const bajos = items
    .filter((i) => i.stockMinimo !== null && i.stockActual <= i.stockMinimo)
    .sort((a, b) => a.stockActual - a.stockMinimo! - (b.stockActual - b.stockMinimo!));
  return { cantidad: bajos.length, items: bajos.slice(0, limite) };
}

async function porPagarGlobal() {
  const compras = await prisma.compra.findMany({
    where: { estado: { not: "CANCELADA" } },
    select: { total: true, montoPagado: true },
  });
  const pendientes = compras.map((c) => c.total - c.montoPagado).filter((s) => s > 0.005);
  return { cantidad: pendientes.length, monto: Math.round(pendientes.reduce((s, n) => s + n, 0) * 100) / 100 };
}

async function gastosDelRango(desde: Date, hasta: Date) {
  const gastos = await prisma.gasto.findMany({
    where: { fecha: { gte: desde, lte: hasta } },
    select: { categoria: true, monto: true },
  });
  const porCategoria = new Map<string, number>();
  for (const g of gastos) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.monto);
  return {
    cantidad: gastos.length,
    total: Math.round(gastos.reduce((s, g) => s + g.monto, 0) * 100) / 100,
    porCategoria: [...porCategoria.entries()]
      .map(([categoria, monto]) => ({ categoria, monto: Math.round(monto * 100) / 100 }))
      .sort((a, b) => b.monto - a.monto),
  };
}

async function porCobrarGlobal() {
  const agg = await prisma.orden.aggregate({
    where: { estado: { not: "CANCELADO" }, faltante: { gt: 0.005 } },
    _sum: { faltante: true },
    _count: true,
  });
  return { cantidad: agg._count, monto: Math.round((agg._sum.faltante ?? 0) * 100) / 100 };
}

const variacion = (actual: number, previo: number) =>
  previo > 0 ? Math.round(((actual - previo) / previo) * 10000) / 100 : null;

// GET /api/reportes/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
export async function getResumen(req: Request, res: Response) {
  const hoy = new Date();
  const desdeStr = String(req.query.desde ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`);
  const hastaStr = String(
    req.query.hasta ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
  );
  const desde = parseFechaLocal(desdeStr, false);
  const hasta = parseFechaLocal(hastaStr, true);
  if (!desde || !hasta) return res.status(400).json({ message: "Fechas inválidas. Usa el formato AAAA-MM-DD." });
  if (hasta < desde) return res.status(400).json({ message: "La fecha final no puede ser anterior a la inicial." });
  const dias = diasInclusivos(desde, hasta);
  if (dias > MAX_DIAS) return res.status(400).json({ message: "El rango máximo es de 5 años." });

  try {
    const { principal, tasas } = await cargarContexto();
    const agrupar = elegirAgrupacion(desde, hasta);

    // Periodo anterior de igual duración, para comparar.
    const hastaPrev = new Date(desde.getTime() - 1);
    const desdePrev = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() - dias);

    const [actual, previo, sinCobrar, bajos, porEstado, devs, gastos, sinPagar] = await Promise.all([
      cargarRango(desde, hasta),
      cargarRango(desdePrev, hastaPrev),
      porCobrarGlobal(),
      stockBajo(),
      prisma.orden.groupBy({
        by: ["estado"],
        where: { fechaIngreso: { gte: desde, lte: hasta } },
        _count: true,
      }),
      prisma.devolucion.aggregate({
        where: { fecha: { gte: desde, lte: hasta } },
        _sum: { total: true },
        _count: true,
      }),
      gastosDelRango(desde, hasta),
      porPagarGlobal(),
    ]);

    const ventas = resumirVentas(actual.ordenes);
    const cobros = resumirCobros(actual.pagos, tasas, principal);
    const ventasPrev = resumirVentas(previo.ordenes);
    const cobrosPrev = resumirCobros(previo.pagos, tasas, principal);

    return res.json({
      rango: { desde: desdeStr, hasta: hastaStr, dias, agrupar },
      moneda: principal,
      ventas,
      cobros,
      ganancia: resumirGanancia(actual.ordenes),
      comparacion: {
        ventasPrevias: ventasPrev.total,
        cobradoPrevio: cobrosPrev.total,
        variacionVentas: variacion(ventas.total, ventasPrev.total),
        variacionCobrado: variacion(cobros.total, cobrosPrev.total),
      },
      gastos: { ...gastos, gananciaNeta: Math.round((resumirGanancia(actual.ordenes).ganancia - gastos.total) * 100) / 100 },
      porPagar: sinPagar,
      devoluciones: { cantidad: devs._count, total: Math.round((devs._sum.total ?? 0) * 100) / 100 },
      porEstado: porEstado.map((e) => ({ estado: e.estado, cantidad: e._count })),
      serie: serieTemporal(actual.ordenes, actual.pagos, desde, hasta, agrupar, tasas, principal),
      topItems: topItems(actual.ordenes),
      clientes: topClientes(actual.ordenes),
      porCobrar: sinCobrar,
      stockBajo: bajos,
    });
  } catch (error) {
    console.error("Error al generar el resumen:", error);
    return res.status(500).json({ message: "Error al generar el reporte" });
  }
}

// GET /api/reportes/dashboard — tarjetas del inicio (todos los roles) más
// tendencia y alertas para quien administra.
export async function getDashboard(req: Request, res: Response) {
  try {
    const { principal, tasas } = await cargarContexto();
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
    const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);

    const [hoy, porEstado] = await Promise.all([
      cargarRango(inicioHoy, finHoy),
      prisma.orden.groupBy({ by: ["estado"], _count: true }),
    ]);
    const cuenta = (estado: string) => porEstado.find((e) => e.estado === estado)?._count ?? 0;
    const vigentes = porEstado.filter((e) => e.estado !== "CANCELADO").reduce((s, e) => s + e._count, 0);

    const base = {
      moneda: principal,
      totalOrdenes: vigentes,
      pendientes: cuenta("PENDIENTE"),
      listas: cuenta("LISTO"),
      entregadas: cuenta("ENTREGADO"),
      ventasHoy: resumirVentas(hoy.ordenes).total,
      cobradoHoy: resumirCobros(hoy.pagos, tasas, principal).total,
    };

    if (req.user?.role === "CAJERO") return res.json(base);

    const desde7 = new Date(inicioHoy);
    desde7.setDate(desde7.getDate() - 6);
    const semana = await cargarRango(desde7, finHoy);
    const [sinCobrar, bajos, sinPagar] = await Promise.all([porCobrarGlobal(), stockBajo(5), porPagarGlobal()]);

    return res.json({
      ...base,
      ultimos7: serieTemporal(semana.ordenes, semana.pagos, desde7, finHoy, "dia", tasas, principal),
      porCobrar: sinCobrar,
      porPagar: sinPagar,
      stockBajo: bajos,
    });
  } catch (error) {
    console.error("Error al generar el dashboard:", error);
    return res.status(500).json({ message: "Error al cargar el dashboard" });
  }
}

// GET /api/reportes/por-cobrar — deudas de clientes con su antigüedad.
export async function getPorCobrar(req: Request, res: Response) {
  try {
    const { principal } = await cargarContexto();
    const ordenes = await prisma.orden.findMany({
      where: { estado: { not: "CANCELADO" }, faltante: { gt: 0.005 } },
      select: {
        id: true,
        fechaIngreso: true,
        total: true,
        abonado: true,
        faltante: true,
        clienteId: true,
        cliente: { select: { nombre: true, apellido: true, telefono: true } },
      },
    });
    return res.json(agruparPorCobrar(ordenes, principal));
  } catch (error) {
    console.error("Error al generar cuentas por cobrar:", error);
    return res.status(500).json({ message: "Error al generar el reporte" });
  }
}
