import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { Role } from "@prisma/client";
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name?: string;
        role: Role;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "CRITICAL ERROR: JWT_SECRET is not defined in environment variables for authMiddleware."
  );
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token;

  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer")
  ) {
    return res.status(401).json({
      message: "No autorizado, no se encontró token o formato incorrecto.",
    });
  }

  token = req.headers.authorization.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as {
      id: number;
      role: Role;
      iat: number;
      exp: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return res.status(401).json({
        message: "No autorizado, token fallido o usuario no encontrado.",
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
    };
    next();
    return;
  } catch (error) {
    console.error("Error al verificar token o buscar usuario:", error);
    return res.status(401).json({
      message: "No autorizado, token inválido o error en la base de datos.",
    });
  }
};

/**
 * @param roles
 */
export const authorizeRoles = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(403)
        .json({ message: "Acceso denegado, usuario no autenticado." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Acceso denegado, rol ${req.user.role} no autorizado para esta acción.`,
      });
    }
    next();
    return;
  };
};
