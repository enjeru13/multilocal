import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { PagoSchema } from "../schemas/pago.schema";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { recalcularEstadoOrden } from "../lib/ordenFinance";
import type {
  Moneda,
  TasasConversion,
} from "@lavanderia/shared/dist/types/types";

export async function getAllPagos(req: Request, res: Response) {
  try {
    const pagosRaw = await prisma.pago.findMany({
      include: {
        orden: {
          include: {
            cliente: true,
          },
        },
        vueltos: true,
      },
      orderBy: { fechaPago: "desc" },
    });

    // Conversión correcta
    const pagos = pagosRaw.map((p) => ({
      ...p,
      tasa: p.tasa ? Number(p.tasa) : null,
    }));
    return res.json(pagos);
  } catch (error) {
    console.error("Error al obtener pagos:", error);
    return res.status(500).json({ message: "Error al obtener pagos" });
  }
}

export async function getPagoById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const pagoRaw = await prisma.pago.findUnique({
      where: { id: Number(id) },
      include: {
        orden: {
          include: {
            cliente: true,
          },
        },
        vueltos: true,
      },
    });

    if (!pagoRaw) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    // Conversión correcta
    const pago = {
      ...pagoRaw,
      tasa: pagoRaw.tasa ? Number(pagoRaw.tasa) : null,
    };

    return res.json(pago);
  } catch (error) {
    console.error("Error al obtener pago por ID:", error);
    return res.status(500).json({ message: "Error al obtener pago por ID" });
  }
}

export async function createPago(req: Request, res: Response) {
  const result = PagoSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: result.error.format(),
    });
  }

  const {
    ordenId,
    monto,
    metodoPago,
    moneda,
    nota,
    vueltos = [],
  } = result.data;

  try {
    const ordenExistente = await prisma.orden.findUnique({
      where: { id: ordenId },
    });
    if (!ordenExistente) {
      return res
        .status(404)
        .json({ message: `Orden con ID ${ordenId} no encontrada.` });
    }

    if (ordenExistente.estado === "CANCELADO") {
      return res
        .status(409)
        .json({ message: "La orden está anulada: no se pueden registrar pagos." });
    }

    const config = await prisma.configuracion.findFirst();

    let cajaSesionId: number | null = null;
    if (config?.moduloCaja) {
      const cajaAbierta = await prisma.cajaSesion.findFirst({
        where: { estado: "ABIERTA" },
      });
      if (!cajaAbierta) {
        return res.status(409).json({
          message: "No hay una caja abierta. Abre la caja antes de registrar pagos.",
        });
      }
      cajaSesionId = cajaAbierta.id;
    }

    // Tasa congelada al momento del pago. USD siempre vale 1; VES/COP salen
    // de la configuración y sin tasa válida no se puede cobrar en esa moneda
    // (antes quedaba en 0 y luego se recalculaba con la tasa del día).
    let tasaSnapshot = 1;
    if (moneda === "VES" || moneda === "COP") {
      const tasaConfig = moneda === "VES" ? config?.tasaVES : config?.tasaCOP;
      if (tasaConfig && tasaConfig > 0) {
        tasaSnapshot = tasaConfig;
      } else if (moneda !== (config?.monedaPrincipal ?? "USD")) {
        return res.status(400).json({
          message: `No hay una tasa ${moneda} configurada. Define la tasa en Configuración antes de cobrar en ${moneda}.`,
        });
      }
    }

    const nuevoPago = await prisma.pago.create({
      data: {
        ordenId,
        monto,
        moneda,
        metodoPago,
        nota: nota ?? null,
        tasa: tasaSnapshot,
        cajaSesionId,
      },
    });

    if (vueltos.length > 0) {
      const vueltosValidos = vueltos.map((v) => ({
        pagoId: nuevoPago.id,
        monto: v.monto,
        moneda: v.moneda,
      }));

      await prisma.vueltoEntregado.createMany({ data: vueltosValidos });
    }

    await recalcularEstadoOrden(ordenId);

    const pagoConOrden = await prisma.pago.findUnique({
      where: { id: nuevoPago.id },
      include: {
        orden: {
          include: {
            cliente: true,
          },
        },
        vueltos: true,
      },
    });

    // Conversión correcta
    if (pagoConOrden) {
      const respuesta = {
        ...pagoConOrden,
        tasa: pagoConOrden.tasa ? Number(pagoConOrden.tasa) : null,
      };
      return res.status(201).json(respuesta);
    }

    return res.status(201).json(pagoConOrden);
  } catch (error) {
    console.error("Error al crear pago:", error);
    return res.status(500).json({ message: "Error al crear pago" });
  }
}

export async function updatePago(req: Request, res: Response) {
  const { id } = req.params;
  const result = PagoSchema.partial().safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Datos inválidos para actualizar pago",
      detalles: result.error.format(),
    });
  }

  const { ordenId, vueltos, ...rest } = result.data;

  try {
    const pagoExistente = await prisma.pago.findUnique({
      where: { id: Number(id) },
      select: { ordenId: true },
    });

    if (!pagoExistente) {
      return res
        .status(404)
        .json({ message: "Pago no encontrado para actualizar." });
    }

    const pagoActualizado = await prisma.pago.update({
      where: { id: Number(id) },
      data: rest,
    });
    if (vueltos !== undefined) {
      await prisma.vueltoEntregado.deleteMany({
        where: { pagoId: pagoActualizado.id },
      });
      if (vueltos.length > 0) {
        await prisma.vueltoEntregado.createMany({
          data: vueltos.map((v) => ({ ...v, pagoId: pagoActualizado.id })),
        });
      }
    }

    await recalcularEstadoOrden(pagoExistente.ordenId);

    const pagoConOrden = await prisma.pago.findUnique({
      where: { id: pagoActualizado.id },
      include: {
        orden: {
          include: {
            cliente: true,
          },
        },
        vueltos: true,
      },
    });

    // 🛠️ CORRECCIÓN 2: Añadida la conversión en updatePago
    if (pagoConOrden) {
      const respuesta = {
        ...pagoConOrden,
        tasa: pagoConOrden.tasa ? Number(pagoConOrden.tasa) : null,
      };
      return res.json(respuesta);
    }

    return res.json(pagoConOrden);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Pago no encontrado para actualizar." });
      }
    }
    console.error("Error al actualizar pago:", error);
    return res.status(500).json({ message: "Error al actualizar pago" });
  }
}

export async function deletePago(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const pagoExistente = await prisma.pago.findUnique({
      where: { id: Number(id) },
      select: { ordenId: true },
    });
    if (!pagoExistente) {
      return res
        .status(404)
        .json({ message: "Pago no encontrado para eliminar." });
    }

    await prisma.vueltoEntregado.deleteMany({ where: { pagoId: Number(id) } });

    await prisma.pago.delete({ where: { id: Number(id) } });

    await recalcularEstadoOrden(pagoExistente.ordenId);

    return res.status(204).send();
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Pago no encontrado para eliminar." });
      }
    }
    console.error("Error al eliminar pago:", error);
    return res.status(500).json({ message: "Error al eliminar pago" });
  }
}
