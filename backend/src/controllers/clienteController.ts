import { Request, Response } from "express";
import prisma from "../lib/prisma";
import {
  ClienteSchema,
  ClienteUpdateSchema,
  ClienteSimpleSchema,
  ClienteSimpleUpdateSchema,
  normalizarClienteSimple,
} from "../schemas/cliente.schema";
import { esErrorPrisma } from "../lib/prismaErrors";

export async function getAllClientes(req: Request, res: Response) {
  try {
    const clientes = await prisma.cliente.findMany();
    return res.json(clientes);
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    return res.status(500).json({ message: "Error al obtener clientes" });
  }
}

export async function getClienteById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(id) },
    });

    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    return res.json(cliente);
  } catch (error) {
    console.error("Error al obtener cliente:", error);
    return res.status(500).json({ message: "Error al obtener cliente" });
  }
}

// Perfiles con "tipo de cliente" (lavandería) exigen la ficha completa;
// el resto usa la ficha simple.
async function usaFichaSimple() {
  const config = await prisma.configuracion.findFirst();
  return config ? config.moduloClienteTipo === false : false;
}

export async function createCliente(req: Request, res: Response) {
  const simple = await usaFichaSimple();
  const result = simple
    ? ClienteSimpleSchema.safeParse(req.body)
    : ClienteSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validación fallida",
      detalles: result.error.format(),
    });
  }

  try {
    const cliente = await prisma.cliente.create({
      data: (simple
        ? { tipo: "NATURAL", ...normalizarClienteSimple(result.data as never, true) }
        : result.data) as never,
    });

    return res.status(201).json(cliente);
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return res
        .status(409)
        .json({ message: "Ya existe un cliente con esa identificación." });
    }
    console.error("Error al crear cliente:", error);
    return res.status(500).json({ message: "Error al crear cliente" });
  }
}

export async function updateCliente(req: Request, res: Response) {
  const { id } = req.params;
  const simple = await usaFichaSimple();
  const result = simple
    ? ClienteSimpleUpdateSchema.safeParse(req.body)
    : ClienteUpdateSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validación fallida",
      detalles: result.error.format(),
    });
  }

  try {
    const cliente = await prisma.cliente.update({
      where: { id: Number(id) },
      data: (simple ? normalizarClienteSimple(result.data as never) : result.data) as never,
    });

    return res.json(cliente);
  } catch (error) {
    if (esErrorPrisma(error, "P2025")) {
      return res
        .status(404)
        .json({ message: "Cliente no encontrado para actualizar." });
    }
    if (esErrorPrisma(error, "P2002")) {
      return res
        .status(409)
        .json({ message: "Ya existe un cliente con esa identificación." });
    }
    console.error("Error al actualizar cliente:", error);
    return res.status(500).json({ message: "Error al actualizar cliente" });
  }
}

export async function deleteCliente(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const existente = await prisma.cliente.findUnique({
      where: { id: Number(id) },
    });

    if (!existente) {
      return res
        .status(404)
        .json({ message: "Cliente no encontrado para eliminar." });
    }

    await prisma.cliente.delete({ where: { id: Number(id) } });
    return res.status(204).send();
  } catch (error) {
    if (esErrorPrisma(error, "P2025")) {
      return res
        .status(404)
        .json({ message: "Cliente no encontrado para eliminar." });
    }
    console.error("Error al eliminar cliente:", error);
    return res.status(500).json({ message: "Error al eliminar cliente" });
  }
}
