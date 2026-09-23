import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

const AjusteSchema = z.object({
  servicioId: z.number().int().positive(),
  tipo: z.enum(["ENTRADA", "SALIDA"]),
  cantidad: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
    .refine((n) => !isNaN(n) && n > 0, { message: "La cantidad debe ser mayor a 0" }),
  nota: z.string().min(1, "Indica el motivo del ajuste"),
});

export async function ajustarStock(req: Request, res: Response) {
  const result = AjusteSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const { servicioId, tipo, cantidad, nota } = result.data;
  try {
    const movimiento = await prisma.$transaction(async (tx) => {
      const servicio = await tx.servicio.findUnique({ where: { id: servicioId } });
      if (!servicio) throw Object.assign(new Error("Producto no encontrado"), { status: 404 });
      if (!servicio.controlaStock) {
        throw Object.assign(new Error("Este ítem no controla stock."), { status: 400 });
      }
      if (tipo === "SALIDA" && servicio.stockActual < cantidad) {
        throw Object.assign(
          new Error(`No puedes sacar ${cantidad}: el stock actual es ${servicio.stockActual}.`),
          { status: 400 }
        );
      }
      const actualizado = await tx.servicio.update({
        where: { id: servicioId },
        data: { stockActual: tipo === "ENTRADA" ? { increment: cantidad } : { decrement: cantidad } },
      });
      return tx.inventarioMovimiento.create({
        data: {
          servicioId,
          tipo,
          cantidad,
          motivo: "AJUSTE_MANUAL",
          stockResultante: actualizado.stockActual,
          userId: req.user!.id,
          nota,
        },
      });
    });
    return res.status(201).json(movimiento);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ message: error.message });
    console.error("Error al ajustar stock:", error);
    return res.status(500).json({ message: "Error al ajustar el stock" });
  }
}

export async function listarMovimientos(req: Request, res: Response) {
  try {
    const servicioId = req.query.servicioId ? Number(req.query.servicioId) : undefined;
    const limite = Math.min(Number(req.query.limit) || 100, 500);
    const movimientos = await prisma.inventarioMovimiento.findMany({
      where: servicioId ? { servicioId } : {},
      orderBy: { fecha: "desc" },
      take: limite,
      include: { servicio: { select: { id: true, nombreServicio: true } } },
    });
    const ids = [...new Set(movimientos.map((m) => m.userId).filter((x): x is number => !!x))];
    const usuarios = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    const nombre = new Map(usuarios.map((u) => [u.id, u.name || u.email]));
    return res.json(
      movimientos.map((m) => ({ ...m, usuario: m.userId ? nombre.get(m.userId) ?? null : null }))
    );
  } catch (error) {
    console.error("Error al listar movimientos:", error);
    return res.status(500).json({ message: "Error al listar movimientos" });
  }
}
