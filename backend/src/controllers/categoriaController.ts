import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { CategoriaSchema } from "../schemas/categoria.schema";

const prisma = new PrismaClient();

// Obtener todas las categorías
export async function getAllCategorias(req: Request, res: Response) {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: "asc" },
    });
    return res.status(200).json(categorias);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al obtener categorías." });
  }
}

// Obtener una categoría por ID
export async function getCategoriaById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const categoria = await prisma.categoria.findUnique({
      where: { id },
    });
    if (!categoria) {
      return res.status(404).json({ message: "Categoría no encontrada." });
    }
    return res.status(200).json(categoria);
  } catch (error) {
    console.error("Error al obtener categoría por ID:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al obtener categoría." });
  }
}

// Crear una nueva categoría
export async function createCategoria(req: Request, res: Response) {
  const result = CategoriaSchema.safeParse(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Datos inválidos", detalles: result.error.format() });
  }

  const { nombre } = result.data;

  try {
    const categoria = await prisma.categoria.create({
      data: { nombre },
    });
    return res.status(201).json(categoria);
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target?.includes("nombre")) {
      return res
        .status(409)
        .json({ message: "Ya existe una categoría con ese nombre." });
    }
    console.error("Error al crear categoría:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al crear categoría." });
  }
}

// Actualizar una categoría
export async function updateCategoria(req: Request, res: Response) {
  const { id } = req.params;
  const result = CategoriaSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Datos inválidos", detalles: result.error.format() });
  }

  const { nombre } = result.data;

  if (!nombre) {
    return res.status(400).json({
      message: "El nombre de la categoría es requerido para actualizar.",
    });
  }

  try {
    const categoria = await prisma.categoria.update({
      where: { id },
      data: { nombre },
    });
    return res.status(200).json(categoria);
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target?.includes("nombre")) {
      return res
        .status(409)
        .json({ message: "Ya existe una categoría con ese nombre." });
    }
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: "Categoría no encontrada para actualizar." });
    }
    console.error("Error al actualizar categoría:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al actualizar categoría." });
  }
}

// Eliminar una categoría
export async function deleteCategoria(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await prisma.categoria.delete({
      where: { id },
    });
    return res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: "Categoría no encontrada para eliminar." });
    }
    if (error.code === "P2003") {
      return res.status(400).json({
        message:
          "No se puede eliminar la categoría porque tiene servicios asociados. Reasigna los servicios primero.",
      });
    }
    console.error("Error al eliminar categoría:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al eliminar categoría." });
  }
}
