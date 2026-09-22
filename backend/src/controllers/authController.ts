import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Formato de email inválido."),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
});

const loginSchema = z.object({
  email: z.string().email("Formato de email inválido."),
  password: z.string().min(1, "La contraseña no puede estar vacía."),
});
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "CRITICAL ERROR: JWT_SECRET is not defined in environment variables."
  );
}
/**
 * @route
 * @desc
 * @access
 */
export const register = async (req: Request, res: Response) => {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validación fallida",
        detalles: result.error.format(),
      });
    }

    const { email, password, name, role } = result.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "El email ya está registrado." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      { id: newUser.id, role: newUser.role },
      JWT_SECRET!,
      {
        expiresIn: "8h",
      }
    );

    return res.status(201).json({
      message: "Usuario registrado exitosamente.",
      user: newUser,
      token,
    });
  } catch (error) {
    console.error("Error en el registro de usuario:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al registrar usuario." });
  }
};
/**
 * @route
 * @desc
 * @access
 */
export const login = async (req: Request, res: Response) => {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validación fallida",
        detalles: result.error.format(),
      });
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET!, {
      expiresIn: "8h",
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return res.status(200).json({
      message: "Inicio de sesión exitoso.",
      user: userResponse,
      token,
    });
  } catch (error) {
    console.error("Error en el inicio de sesión:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al iniciar sesión." });
  }
};

const validatePasswordSchema = z.object({
  password: z.string().min(1, "La contraseña no puede estar vacía."),
});
/**
 * @route
 * @desc
 * @access
 */
export const validateAdminPassword = async (req: Request, res: Response) => {
  try {
    const result = validatePasswordSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validación fallida",
        detalles: result.error.format(),
      });
    }

    const { password } = result.data;
    const adminPasswordHash = process.env.ADMIN_PASSWORD;

    if (!adminPasswordHash) {
      console.error(
        "ADMIN_PASSWORD no está configurado en las variables de entorno del servidor."
      );
      return res
        .status(500)
        .json({ error: "Error de configuración del servidor." });
    }
    const isMatch = await bcrypt.compare(password, adminPasswordHash);

    if (isMatch) {
      return res
        .status(200)
        .json({ message: "Contraseña válida.", isValid: true });
    } else {
      return res
        .status(401)
        .json({ error: "Contraseña inválida.", isValid: false });
    }
  } catch (error) {
    console.error("Error al validar contraseña de administrador:", error);
    return res
      .status(500)
      .json({ error: "Error interno del servidor al validar la contraseña." });
  }
};
