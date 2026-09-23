import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { CompraSchema } from "../schemas/compra.schema";
import { esErrorPrisma } from "../lib/prismaErrors";
import { Role } from "@prisma/client";
import { PagoCompraSchema } from "../schemas/gasto.schema";
import { resolverMoneda } from "../lib/dinero";
import { cargarTasas } from "../lib/ordenFinance";
import { parseFechaLocal } from "../lib/reportes";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Saldo pendiente con el proveedor (0 en compras canceladas).
const conSaldo = <T extends { total: number; montoPagado: number; estado: string }>(c: T) => ({
  ...c,
  saldo: c.estado === "CANCELADA" ? 0 : Math.max(0, r2(c.total - c.montoPagado)),
});

interface AuthRequest extends Request {
  user?: { id: number; email: string; name?: string; role: Role };
}

const compraInclude = {
  proveedor: true,
  detalles: { include: { servicio: true } },
  pagos: { orderBy: { fecha: "desc" as const } },
};

export async function getAllCompras(req: Request, res: Response) {
  try {
    const compras = await prisma.compra.findMany({
      include: compraInclude,
      orderBy: { fecha: "desc" },
    });
    return res.json(compras.map(conSaldo));
  } catch (error) {
    console.error("Error al obtener compras:", error);
    return res.status(500).json({ message: "Error al obtener compras" });
  }
}

export async function getCompraById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const compra = await prisma.compra.findUnique({
      where: { id: Number(id) },
      include: compraInclude,
    });
    if (!compra) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }
    return res.json(conSaldo(compra));
  } catch (error) {
    console.error("Error al obtener compra:", error);
    return res.status(500).json({ message: "Error al obtener compra" });
  }
}

// Aplica la recepción de una compra: sube stock, guarda costo, registra
// el movimiento de inventario. Se usa tanto al crear una compra ya
// RECIBIDA como al recibir una PENDIENTE despues.
async function aplicarRecepcion(tx: any, compraId: number, userId?: number) {
  const compra = await tx.compra.findUnique({
    where: { id: compraId },
    include: { detalles: true },
  });
  if (!compra) throw new Error("Compra no encontrada");

  for (const detalle of compra.detalles) {
    const servicio = await tx.servicio.update({
      where: { id: detalle.servicioId },
      data: {
        stockActual: { increment: detalle.cantidad },
        costoBase: detalle.costoUnit,
      },
    });

    await tx.inventarioMovimiento.create({
      data: {
        servicioId: detalle.servicioId,
        tipo: "ENTRADA",
        cantidad: detalle.cantidad,
        motivo: "COMPRA",
        compraId: compra.id,
        stockResultante: servicio.stockActual,
        userId: userId ?? null,
        nota: `Compra #${compra.id}`,
      },
    });
  }
}

export async function createCompra(req: AuthRequest, res: Response) {
  const result = CompraSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }

  const { proveedorId, observaciones, detalles, estado, pagoInicial, fechaVencimiento, metodoPago, desdeCaja } = result.data;
  const estadoFinal = estado ?? "RECIBIDA";

  try {
    const total = r2(detalles.reduce((sum, d) => sum + d.cantidad * d.costoUnit, 0));
    const abono = r2(pagoInicial ?? (estadoFinal === "RECIBIDA" ? total : 0));
    if (abono > total + 0.005) {
      return res.status(400).json({ message: "El pago inicial no puede ser mayor al total de la compra." });
    }
    const { principal } = await cargarTasas();
    const metodo = metodoPago ?? "EFECTIVO";
    let cajaSesionId: number | null = null;
    if (abono > 0 && desdeCaja) {
      const caja = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
      if (!caja) return res.status(409).json({ message: "No hay una caja abierta para sacar este dinero." });
      cajaSesionId = caja.id;
    }

    const compra = await prisma.$transaction(async (tx) => {
      const nuevaCompra = await tx.compra.create({
        data: {
          proveedorId,
          observaciones: observaciones || null,
          estado: estadoFinal,
          total,
          montoPagado: abono,
          // La fecha viene como AAAA-MM-DD: vence al terminar ese día en hora local.
          fechaVencimiento: fechaVencimiento ? parseFechaLocal(fechaVencimiento, true) ?? new Date(fechaVencimiento) : null,
          detalles: {
            create: detalles.map((d) => ({
              servicioId: d.servicioId,
              cantidad: d.cantidad,
              costoUnit: d.costoUnit,
              subtotal: parseFloat((d.cantidad * d.costoUnit).toFixed(2)),
            })),
          },
        },
      });

      if (estadoFinal === "RECIBIDA") {
        await aplicarRecepcion(tx, nuevaCompra.id, req.user?.id);
      }

      if (abono > 0) {
        let cajaMovimientoId: number | null = null;
        if (cajaSesionId) {
          const mov = await tx.cajaMovimiento.create({
            data: {
              cajaSesionId,
              tipo: "EGRESO",
              monto: abono,
              moneda: principal,
              concepto: `Compra #${nuevaCompra.id}`,
              userId: req.user?.id ?? null,
            },
          });
          cajaMovimientoId = mov.id;
        }
        await tx.pagoCompra.create({
          data: {
            compraId: nuevaCompra.id,
            monto: abono,
            moneda: principal,
            montoMoneda: abono,
            tasa: 1,
            metodoPago: metodo,
            nota: "Pago al registrar la compra",
            userId: req.user?.id ?? null,
            cajaMovimientoId,
          },
        });
      }

      return tx.compra.findUnique({ where: { id: nuevaCompra.id }, include: compraInclude });
    });

    return res.status(201).json(conSaldo(compra!));
  } catch (error: any) {
    if (esErrorPrisma(error, "P2003")) {
      return res.status(400).json({ message: "Proveedor o producto inválido." });
    }
    console.error("Error al crear compra:", error);
    return res.status(500).json({ message: "Error al crear compra" });
  }
}

export async function recibirCompra(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const compra = await prisma.compra.findUnique({ where: { id: Number(id) } });
    if (!compra) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }
    if (compra.estado === "RECIBIDA") {
      return res.status(409).json({ message: "Esta compra ya fue recibida." });
    }
    if (compra.estado === "CANCELADA") {
      return res.status(409).json({ message: "No se puede recibir una compra cancelada." });
    }

    await prisma.$transaction(async (tx) => {
      await aplicarRecepcion(tx, compra.id, req.user?.id);
      await tx.compra.update({ where: { id: compra.id }, data: { estado: "RECIBIDA" } });
    });

    const actualizada = await prisma.compra.findUnique({
      where: { id: compra.id },
      include: compraInclude,
    });
    return res.json(actualizada && conSaldo(actualizada));
  } catch (error) {
    console.error("Error al recibir compra:", error);
    return res.status(500).json({ message: "Error al recibir compra" });
  }
}

export async function cancelarCompra(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const compra = await prisma.compra.findUnique({ where: { id: Number(id) } });
    if (!compra) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }
    if (compra.estado === "RECIBIDA") {
      return res
        .status(409)
        .json({ message: "No se puede cancelar una compra ya recibida (afectaría el stock)." });
    }
    if (compra.montoPagado > 0.005) {
      return res.status(409).json({
        message: "Esta compra ya tiene pagos al proveedor: no se puede cancelar sin devolver ese dinero primero.",
      });
    }
    const actualizada = await prisma.compra.update({
      where: { id: compra.id },
      data: { estado: "CANCELADA" },
    });
    return res.json(actualizada);
  } catch (error) {
    console.error("Error al cancelar compra:", error);
    return res.status(500).json({ message: "Error al cancelar compra" });
  }
}

// GET /api/compras/por-pagar — lo que se le debe a proveedores.
export async function listarPorPagar(req: Request, res: Response) {
  try {
    const compras = await prisma.compra.findMany({
      where: { estado: { not: "CANCELADA" } },
      include: { proveedor: true, pagos: { orderBy: { fecha: "desc" } } },
      orderBy: [{ fechaVencimiento: "asc" }, { fecha: "asc" }],
    });
    const ahora = new Date();
    const pendientes = compras
      .map((c) => ({ ...conSaldo(c), vencida: !!c.fechaVencimiento && c.fechaVencimiento < ahora }))
      .filter((c) => c.saldo > 0.005);

    const porProveedor = new Map<number, { proveedorId: number; nombre: string; saldo: number; vencido: number; compras: number }>();
    for (const c of pendientes) {
      const fila = porProveedor.get(c.proveedorId) ?? { proveedorId: c.proveedorId, nombre: c.proveedor.nombre, saldo: 0, vencido: 0, compras: 0 };
      fila.saldo += c.saldo;
      fila.compras += 1;
      if (c.vencida) fila.vencido += c.saldo;
      porProveedor.set(c.proveedorId, fila);
    }

    const { principal } = await cargarTasas();
    return res.json({
      moneda: principal,
      total: r2(pendientes.reduce((s, c) => s + c.saldo, 0)),
      vencido: r2(pendientes.filter((c) => c.vencida).reduce((s, c) => s + c.saldo, 0)),
      proveedores: [...porProveedor.values()]
        .map((p) => ({ ...p, saldo: r2(p.saldo), vencido: r2(p.vencido) }))
        .sort((a, b) => b.saldo - a.saldo),
      compras: pendientes,
    });
  } catch (error) {
    console.error("Error al listar cuentas por pagar:", error);
    return res.status(500).json({ message: "Error al obtener las cuentas por pagar" });
  }
}

// POST /api/compras/:id/pagos — abono a una compra.
export async function pagarCompra(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const result = PagoCompraSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }
  const d = result.data;

  try {
    const compra = await prisma.compra.findUnique({ where: { id } });
    if (!compra) return res.status(404).json({ message: "Compra no encontrada" });
    if (compra.estado === "CANCELADA") return res.status(409).json({ message: "La compra está cancelada." });

    const saldo = r2(compra.total - compra.montoPagado);
    if (saldo <= 0.005) return res.status(409).json({ message: "Esta compra ya está pagada por completo." });

    const config = await prisma.configuracion.findFirst();
    const conv = resolverMoneda(config, d.moneda, d.monto);
    if ("error" in conv) return res.status(400).json({ message: conv.error });
    if (conv.montoPrincipal > saldo + 0.005) {
      return res.status(400).json({ message: `El pago supera lo que se debe (saldo: ${saldo}).` });
    }
    // Un pago que salda la deuda con diferencia de centavos por conversión cierra exacto.
    const abono = Math.min(conv.montoPrincipal, saldo);

    const sacarDeCaja = d.desdeCaja ?? (d.metodoPago === "EFECTIVO" && !!config?.moduloCaja);
    let cajaSesionId: number | null = null;
    if (sacarDeCaja) {
      const caja = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
      if (!caja) {
        return res.status(409).json({ message: "No hay una caja abierta para sacar este dinero. Ábrela o marca el pago como hecho fuera de caja." });
      }
      cajaSesionId = caja.id;
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      let cajaMovimientoId: number | null = null;
      if (cajaSesionId) {
        const mov = await tx.cajaMovimiento.create({
          data: { cajaSesionId, tipo: "EGRESO", monto: d.monto, moneda: d.moneda, concepto: `Pago compra #${id}`, userId: req.user?.id ?? null },
        });
        cajaMovimientoId = mov.id;
      }
      await tx.pagoCompra.create({
        data: {
          compraId: id,
          monto: abono,
          moneda: conv.moneda,
          montoMoneda: d.monto,
          tasa: conv.tasa,
          metodoPago: d.metodoPago,
          nota: d.nota || null,
          userId: req.user?.id ?? null,
          cajaMovimientoId,
        },
      });
      await tx.compra.update({ where: { id }, data: { montoPagado: { increment: abono } } });
      return tx.compra.findUnique({ where: { id }, include: compraInclude });
    });

    return res.status(201).json(conSaldo(actualizada!));
  } catch (error) {
    console.error("Error al pagar compra:", error);
    return res.status(500).json({ message: "Error al registrar el pago" });
  }
}
