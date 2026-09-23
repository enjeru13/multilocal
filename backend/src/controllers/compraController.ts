import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { CompraSchema } from "../schemas/compra.schema";
import { esErrorPrisma } from "../lib/prismaErrors";
import { Role } from "@prisma/client";

interface AuthRequest extends Request {
  user?: { id: number; email: string; name?: string; role: Role };
}

const compraInclude = {
  proveedor: true,
  detalles: { include: { servicio: true } },
};

export async function getAllCompras(req: Request, res: Response) {
  try {
    const compras = await prisma.compra.findMany({
      include: compraInclude,
      orderBy: { fecha: "desc" },
    });
    return res.json(compras);
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
    return res.json(compra);
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

  const { proveedorId, observaciones, detalles, estado } = result.data;
  const estadoFinal = estado ?? "RECIBIDA";

  try {
    const total = detalles.reduce((sum, d) => sum + d.cantidad * d.costoUnit, 0);

    const compra = await prisma.$transaction(async (tx) => {
      const nuevaCompra = await tx.compra.create({
        data: {
          proveedorId,
          observaciones: observaciones || null,
          estado: estadoFinal,
          total: parseFloat(total.toFixed(2)),
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

      return tx.compra.findUnique({ where: { id: nuevaCompra.id }, include: compraInclude });
    });

    return res.status(201).json(compra);
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
    return res.json(actualizada);
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
