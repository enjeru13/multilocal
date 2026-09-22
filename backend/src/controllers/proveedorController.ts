import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ProveedorSchema, ProveedorUpdateSchema } from "../schemas/proveedor.schema";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export async function getAllProveedores(req: Request, res: Response) {
  try {
    const proveedores = await prisma.proveedor.findMany({
      orderBy: { nombre: "asc" },
    });
    return res.json(proveedores);
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    return res.status(500).json({ message: "Error al obtener proveedores" });
  }
}

export async function getProveedorById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const proveedor = await prisma.proveedor.findUnique({
      where: { id: Number(id) },
      include: { compras: { orderBy: { fecha: "desc" } } },
    });
    if (!proveedor) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }
    return res.json(proveedor);
  } catch (error) {
    console.error("Error al obtener proveedor:", error);
    return res.status(500).json({ message: "Error al obtener proveedor" });
  }
}

export async function createProveedor(req: Request, res: Response) {
  const result = ProveedorSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }
  try {
    const proveedor = await prisma.proveedor.create({
      data: {
        nombre: result.data.nombre,
        identificacion: result.data.identificacion || null,
        telefono: result.data.telefono || null,
        direccion: result.data.direccion || null,
        email: result.data.email || null,
      },
    });
    return res.status(201).json(proveedor);
  } catch (error: any) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Ya existe un proveedor con esa identificación." });
    }
    console.error("Error al crear proveedor:", error);
    return res.status(500).json({ message: "Error al crear proveedor" });
  }
}

export async function updateProveedor(req: Request, res: Response) {
  const { id } = req.params;
  const result = ProveedorUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }
  try {
    const proveedor = await prisma.proveedor.update({
      where: { id: Number(id) },
      data: result.data,
    });
    return res.json(proveedor);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ message: "Proveedor no encontrado para actualizar." });
    }
    console.error("Error al actualizar proveedor:", error);
    return res.status(500).json({ message: "Error al actualizar proveedor" });
  }
}

export async function deleteProveedor(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const existente = await prisma.proveedor.findUnique({ where: { id: Number(id) } });
    if (!existente) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }
    await prisma.proveedor.delete({ where: { id: Number(id) } });
    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar proveedor:", error);
    return res.status(500).json({ message: "Error al eliminar proveedor" });
  }
}
