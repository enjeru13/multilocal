// backend/src/controllers/servicioController.ts
import { Request, Response } from "express";
import { ServicioSchema } from "../schemas/servicio.schema";
import prisma from "../lib/prisma";

// Obtener todos los servicios
export async function getAllServicios(req: Request, res: Response) {
  try {
    const servicios = await prisma.servicio.findMany({
      include: {
        categoria: true,
      },
      orderBy: { nombreServicio: "asc" },
    });
    return res.json(servicios);
  } catch (error) {
    console.error("Error al obtener servicios:", error);
    return res.status(500).json({ message: "Error al obtener servicios" });
  }
}

// Obtener un servicio por ID
export async function getServicioById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const servicio = await prisma.servicio.findUnique({
      where: { id: Number(id) },
      include: {
        categoria: true,
      },
    });

    if (!servicio) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    return res.json(servicio);
  } catch (error) {
    console.error("Error al obtener servicio:", error);
    return res.status(500).json({ message: "Error al obtener servicio" });
  }
}

// Crear un nuevo servicio
export async function createServicio(req: Request, res: Response) {
  const result = ServicioSchema.safeParse(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Datos inválidos", detalles: result.error.format() });
  }

  const {
    nombreServicio,
    descripcion,
    precioBase,
    permiteDecimales,
    categoriaId,
  } = result.data;

  try {
    const servicio = await prisma.servicio.create({
      data: {
        nombreServicio,
        descripcion,
        precioBase,
        permiteDecimales: permiteDecimales || false,
        categoriaId,
      },
      include: {
        categoria: true,
      },
    });
    return res.status(201).json(servicio);
  } catch (error: any) {
    if (
      error.code === "P2025" &&
      error.meta?.cause?.includes("foreign key constraint")
    ) {
      return res
        .status(400)
        .json({ message: "La categoría especificada no existe." });
    }
    console.error("Error al crear servicio:", error);
    return res.status(500).json({ message: "Error al crear servicio" });
  }
}

// Actualizar un servicio
export async function updateServicio(req: Request, res: Response) {
  const { id } = req.params;
  const result = ServicioSchema.safeParse(req.body);

  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Datos inválidos", detalles: result.error.format() });
  }

  const {
    nombreServicio,
    descripcion,
    precioBase,
    permiteDecimales,
    categoriaId,
  } = result.data;

  try {
    const servicio = await prisma.servicio.update({
      where: { id: Number(id) },
      data: {
        nombreServicio,
        descripcion,
        precioBase,
        permiteDecimales: permiteDecimales || false,
        categoriaId,
      },
      include: {
        categoria: true,
      },
    });

    return res.json(servicio);
  } catch (error: any) {
    if (error.code === "P2025") {
      if (error.meta?.cause?.includes("foreign key constraint")) {
        return res
          .status(400)
          .json({ message: "La categoría especificada no existe." });
      }
      return res
        .status(404)
        .json({ message: "Servicio no encontrado para actualizar." });
    }
    console.error("Error al actualizar servicio:", error);
    return res.status(500).json({ message: "Error al actualizar servicio" });
  }
}

// Eliminar un servicio
export async function deleteServicio(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const existente = await prisma.servicio.findUnique({
      where: { id: Number(id) },
    });

    if (!existente) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    await prisma.servicio.delete({ where: { id: Number(id) } });
    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar servicio:", error);
    return res.status(500).json({ message: "Error al eliminar servicio" });
  }
}
