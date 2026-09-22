import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { DetalleOrdenSchema } from "../schemas/detalleOrden.schema";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export async function getAllDetalle(req: Request, res: Response) {
  try {
    const detalles = await prisma.detalleOrden.findMany();
    return res.json(detalles);
  } catch (error) {
    console.error("Error al obtener todos los detalles:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener todos los detalles" });
  }
}

export async function getDetallesByOrdenId(req: Request, res: Response) {
  const { ordenId } = req.query;

  if (!ordenId) {
    return res.status(400).json({
      message: "Se requiere un 'ordenId' como parámetro de consulta.",
    });
  }

  const parsedOrdenId = Number(ordenId);
  if (isNaN(parsedOrdenId)) {
    return res
      .status(400)
      .json({ message: "El 'ordenId' debe ser un número válido." });
  }

  try {
    const detalles = await prisma.detalleOrden.findMany({
      where: { ordenId: parsedOrdenId },
      include: {
        servicio: true,
      },
    });
    return res.json(detalles);
  } catch (error) {
    console.error(`Error al obtener detalles para la orden ${ordenId}:`, error);
    return res
      .status(500)
      .json({ message: `Error al obtener detalles para la orden ${ordenId}` });
  }
}

export async function getDetalleById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const detalle = await prisma.detalleOrden.findUnique({
      where: { id: Number(id) },
    });

    if (!detalle) {
      return res.status(404).json({ message: "Detalle no encontrado" });
    }

    return res.json(detalle);
  } catch (error) {
    console.error("Error al obtener detalle por ID:", error);
    return res.status(500).json({ message: "Error al obtener detalle por ID" });
  }
}

export async function createDetalle(req: Request, res: Response) {
  const result = DetalleOrdenSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: result.error.format(),
    });
  }

  try {
    const detalle = await prisma.detalleOrden.create({ data: result.data });
    return res.status(201).json(detalle);
  } catch (error) {
    console.error("Error al crear detalle:", error);
    return res.status(500).json({ message: "Error al crear detalle" });
  }
}

export async function updateDetalle(req: Request, res: Response) {
  const { id } = req.params;
  const result = DetalleOrdenSchema.partial().safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: result.error.format(),
    });
  }

  try {
    const detalle = await prisma.detalleOrden.update({
      where: { id: Number(id) },
      data: result.data,
    });

    return res.json(detalle);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Detalle de orden no encontrado para actualizar." });
      }
    }
    console.error("Error al actualizar detalle:", error);
    return res.status(500).json({ message: "Error al actualizar detalle" });
  }
}

export async function deleteDetalle(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const existente = await prisma.detalleOrden.findUnique({
      where: { id: Number(id) },
    });

    if (!existente) {
      return res
        .status(404)
        .json({ message: "Detalle no encontrado para eliminar." });
    }

    await prisma.detalleOrden.delete({ where: { id: Number(id) } });
    return res.status(204).send();
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Detalle de orden no encontrado para eliminar." });
      }
    }
    console.error("Error al eliminar detalle:", error);
    return res.status(500).json({ message: "Error al eliminar detalle" });
  }
}
