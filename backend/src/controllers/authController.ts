import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { limpiarFallos, registrarFallo, segundosDeBloqueo } from "../lib/limiteIntentos";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Formato de email inválido."),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "EMPLOYEE", "CAJERO"]).default("EMPLOYEE"),
});

const changePasswordSchema = z.object({
  passwordActual: z.string().min(1, "Indica tu contraseña actual."),
  passwordNueva: z
    .string()
    .min(6, "La contraseña nueva debe tener al menos 6 caracteres."),
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
 * Indica si el sistema aun no tiene ningun usuario creado, para que el
 * frontend muestre el wizard de primer uso en vez del login normal.
 */
export const getSetupStatus = async (req: Request, res: Response) => {
  try {
    const totalUsuarios = await prisma.user.count();
    return res.status(200).json({ needsSetup: totalUsuarios === 0, requiereCodigo: totalUsuarios === 0 && !!process.env.MOSTRADOR_SETUP_CODE });
  } catch (error) {
    console.error("Error al verificar estado de configuración inicial:", error);
    return res
      .status(500)
      .json({ message: "Error al verificar estado de configuración inicial." });
  }
};

// Datos públicos mínimos para pintar la pantalla de acceso antes de iniciar sesión.
export const getBranding = async (req: Request, res: Response) => {
  try {
    const config = await prisma.configuracion.findFirst({ select: { nombreNegocio: true, rubro: true } });
    return res.status(200).json({ nombreNegocio: config?.nombreNegocio ?? null, rubro: config?.rubro ?? null });
  } catch (error) {
    console.error("Error al leer la marca del negocio:", error);
    return res.status(500).json({ message: "Error al leer la marca del negocio." });
  }
};

/**
 * @route
 * @desc
 * @access
 */
export const register = async (req: Request, res: Response) => {
  try {
    // Registro público solo para el primer uso (setup). Después, los
    // usuarios los crea un ADMIN desde /api/usuarios.
    const totalUsuarios = await prisma.user.count();
    if (totalUsuarios > 0) {
      return res.status(403).json({
        message: "El registro público está cerrado. Pide a un administrador que cree tu usuario.",
      });
    }
    // En un servidor en internet, quien llegue primero no debe poder quedarse con la cuenta de administrador.
    const codigoRequerido = process.env.MOSTRADOR_SETUP_CODE;
    if (codigoRequerido && String(req.body?.codigoInstalacion ?? "").trim() !== codigoRequerido) {
      return res.status(403).json({ message: "El código de instalación no es correcto." });
    }

    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validación fallida",
        detalles: result.error.format(),
      });
    }

    const { email, password, name } = result.data;
    // El primer usuario siempre es ADMIN.
    const role = "ADMIN" as const;

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
    const origen = req.ip ?? "desconocido";

    const espera = segundosDeBloqueo(origen, email);
    if (espera !== null) {
      res.setHeader("Retry-After", String(espera));
      return res.status(429).json({
        message: `Demasiados intentos fallidos. Espera ${Math.ceil(espera / 60)} minuto(s) e inténtalo de nuevo.`,
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      registrarFallo(origen, email);
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      registrarFallo(origen, email);
      return res.status(401).json({ message: "Credenciales inválidas." });
    }
    limpiarFallos(origen, email);
    if (!user.activo) {
      return res
        .status(403)
        .json({ message: "Tu usuario está desactivado. Habla con el administrador." });
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

export const changePassword = async (req: Request, res: Response) => {
  try {
    const result = changePasswordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: result.error.issues[0]?.message ?? "Datos inválidos",
      });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });

    const ok = await bcrypt.compare(result.data.passwordActual, user.password);
    if (!ok) {
      return res.status(400).json({ message: "La contraseña actual no es correcta." });
    }
    const hash = await bcrypt.hash(result.data.passwordNueva, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
    return res.json({ message: "Contraseña actualizada." });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    return res.status(500).json({ message: "Error al cambiar la contraseña." });
  }
};
