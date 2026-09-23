import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { GastoSchema } from "../schemas/gasto.schema";
import { resolverMoneda } from "../lib/dinero";
import { parseFechaLocal } from "../lib/reportes";
import { Role } from "@prisma/client";

interface AuthRequest extends Request {
  user?: { id: number; email: string; name?: string; role: Role };
}

const CATEGORIAS_SUGERIDAS = [
  "Alquiler",
  "Servicios (luz, agua, internet)",
  "Sueldos",
  "Transporte",
  "Mantenimiento",
  "Impuestos y tasas",
  "Insumos",
  "Otros",
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function listarGastos(req: Request, res: Response) {
  const hoy = new Date();
  const desde = parseFechaLocal(String(req.query.desde ?? ""), false) ?? new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta =
    parseFechaLocal(String(req.query.hasta ?? ""), true) ??
    new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);
  if (hasta < desde) return res.status(400).json({ message: "La fecha final no puede ser anterior a la inicial." });

  try {
    const gastos = await prisma.gasto.findMany({
      where: { fecha: { gte: desde, lte: hasta } },
      orderBy: { fecha: "desc" },
    });
    const porCategoria = new Map<string, number>();
    for (const g of gastos) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.monto);

    const config = await prisma.configuracion.findFirst();
    return res.json({
      moneda: config?.monedaPrincipal ?? "USD",
      total: r2(gastos.reduce((s, g) => s + g.monto, 0)),
      porCategoria: [...porCategoria.entries()]
        .map(([categoria, monto]) => ({ categoria, monto: r2(monto) }))
        .sort((a, b) => b.monto - a.monto),
      categoriasSugeridas: CATEGORIAS_SUGERIDAS,
      gastos,
    });
  } catch (error) {
    console.error("Error al listar gastos:", error);
    return res.status(500).json({ message: "Error al obtener los gastos" });
  }
}

export async function crearGasto(req: AuthRequest, res: Response) {
  const result = GastoSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }
  const d = result.data;

  try {
    const config = await prisma.configuracion.findFirst();
    const conv = resolverMoneda(config, d.moneda, d.monto);
    if ("error" in conv) return res.status(400).json({ message: conv.error });

    const desdeCaja = d.desdeCaja ?? (d.metodoPago === "EFECTIVO" && !!config?.moduloCaja);
    let cajaSesionId: number | null = null;
    if (desdeCaja) {
      const caja = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
      if (!caja) {
        return res.status(409).json({
          message: "No hay una caja abierta para sacar este dinero. Ábrela o marca el gasto como pagado fuera de caja.",
        });
      }
      cajaSesionId = caja.id;
    }

    const gasto = await prisma.$transaction(async (tx) => {
      let cajaMovimientoId: number | null = null;
      if (cajaSesionId) {
        const mov = await tx.cajaMovimiento.create({
          data: {
            cajaSesionId,
            tipo: "EGRESO",
            monto: d.monto,
            moneda: d.moneda,
            concepto: `Gasto: ${d.concepto}`,
            userId: req.user?.id ?? null,
          },
        });
        cajaMovimientoId = mov.id;
      }
      return tx.gasto.create({
        data: {
          concepto: d.concepto,
          categoria: d.categoria,
          monto: conv.montoPrincipal,
          moneda: conv.moneda,
          montoMoneda: d.monto,
          tasa: conv.tasa,
          metodoPago: d.metodoPago,
          proveedorId: d.proveedorId ?? null,
          nota: d.nota || null,
          userId: req.user?.id ?? null,
          cajaMovimientoId,
          ...(d.fecha && { fecha: d.fecha }),
        },
      });
    });

    return res.status(201).json(gasto);
  } catch (error) {
    console.error("Error al registrar gasto:", error);
    return res.status(500).json({ message: "Error al registrar el gasto" });
  }
}

export async function eliminarGasto(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const gasto = await prisma.gasto.findUnique({ where: { id } });
    if (!gasto) return res.status(404).json({ message: "Gasto no encontrado." });

    if (gasto.cajaMovimientoId) {
      const mov = await prisma.cajaMovimiento.findUnique({
        where: { id: gasto.cajaMovimientoId },
        include: { cajaSesion: true },
      });
      if (mov && mov.cajaSesion.estado !== "ABIERTA") {
        return res.status(409).json({
          message: "Este gasto salió de una caja ya cerrada: no se puede borrar sin descuadrar el cierre.",
        });
      }
      await prisma.$transaction([
        prisma.gasto.delete({ where: { id } }),
        prisma.cajaMovimiento.deleteMany({ where: { id: gasto.cajaMovimientoId } }),
      ]);
    } else {
      await prisma.gasto.delete({ where: { id } });
    }
    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar gasto:", error);
    return res.status(500).json({ message: "Error al eliminar el gasto" });
  }
}
