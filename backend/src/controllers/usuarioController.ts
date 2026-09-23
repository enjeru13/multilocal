import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";

const roles = z.enum(["ADMIN", "EMPLOYEE", "CAJERO"]);

const CrearSchema = z.object({
  email: z.string().email("Correo inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  name: z.string().min(1, "El nombre es requerido."),
  role: roles,
});

const ActualizarSchema = z.object({
  name: z.string().min(1).optional(),
  role: roles.optional(),
  activo: z.boolean().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").optional(),
});

const publico = {
  id: true,
  email: true,
  name: true,
  role: true,
  activo: true,
  createdAt: true,
} as const;

async function adminsActivos(excluirId?: number) {
  return prisma.user.count({
    where: { role: "ADMIN", activo: true, ...(excluirId ? { id: { not: excluirId } } : {}) },
  });
}

export async function listarUsuarios(req: Request, res: Response) {
  try {
    const usuarios = await prisma.user.findMany({
      select: publico,
      orderBy: { createdAt: "asc" },
    });
    return res.json(usuarios);
  } catch (error) {
    console.error("Error al listar usuarios:", error);
    return res.status(500).json({ message: "Error al listar usuarios" });
  }
}

export async function crearUsuario(req: Request, res: Response) {
  const result = CrearSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.issues[0]?.message ?? "Datos inválidos" });
  }
  try {
    const { email, password, name, role } = result.data;
    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) {
      return res.status(409).json({ message: "Ese correo ya está registrado." });
    }
    const usuario = await prisma.user.create({
      data: { email, name, role, password: await bcrypt.hash(password, 10) },
      select: publico,
    });
    return res.status(201).json(usuario);
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return res.status(500).json({ message: "Error al crear usuario" });
  }
}

export async function actualizarUsuario(req: Request, res: Response) {
  const id = Number(req.params.id);
  const result = ActualizarSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.issues[0]?.message ?? "Datos inválidos" });
  }
  try {
    const actual = await prisma.user.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ message: "Usuario no encontrado" });

    const { password, ...resto } = result.data;

    const deja_de_ser_admin_activo =
      actual.role === "ADMIN" &&
      actual.activo &&
      ((resto.role !== undefined && resto.role !== "ADMIN") || resto.activo === false);

    if (deja_de_ser_admin_activo && (await adminsActivos(id)) === 0) {
      return res.status(409).json({
        message: "No puedes quitar ni desactivar al único administrador activo.",
      });
    }
    if (id === req.user!.id && resto.activo === false) {
      return res.status(409).json({ message: "No puedes desactivar tu propio usuario." });
    }

    const usuario = await prisma.user.update({
      where: { id },
      data: {
        ...resto,
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      },
      select: publico,
    });
    return res.json(usuario);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    return res.status(500).json({ message: "Error al actualizar usuario" });
  }
}
