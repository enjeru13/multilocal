import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ClienteSchema, ClienteUpdateSchema } from "../schemas/cliente.schema";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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

export async function createCliente(req: Request, res: Response) {
  const result = ClienteSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validación fallida",
      detalles: result.error.format(),
    });
  }

  try {
    const cliente = await prisma.cliente.create({
      data: result.data,
    });

    return res.status(201).json(cliente);
  } catch (error) {
    console.error("Error al crear cliente:", error);
    return res.status(500).json({ message: "Error al crear cliente" });
  }
}

export async function updateCliente(req: Request, res: Response) {
  const { id } = req.params;
  const partialClienteSchema = ClienteUpdateSchema;
  const result = partialClienteSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validación fallida",
      detalles: result.error.format(),
    });
  }

  try {
    const cliente = await prisma.cliente.update({
      where: { id: Number(id) },
      data: result.data,
    });

    return res.json(cliente);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Cliente no encontrado para actualizar." });
      }
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
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Cliente no encontrado para eliminar." });
      }
    }
    console.error("Error al eliminar cliente:", error);
    return res.status(500).json({ message: "Error al eliminar cliente" });
  }
}
