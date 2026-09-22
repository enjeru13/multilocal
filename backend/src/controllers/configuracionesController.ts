import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ConfiguracionSchema } from "../schemas/configuracion.schema";

export async function getConfiguracion(req: Request, res: Response) {
  try {
    let config = await prisma.configuracion.findFirst();

    if (!config) {
      config = await prisma.configuracion.create({
        data: {
          nombreNegocio: "Mi negocio",
          monedaPrincipal: "USD",
          tasaUSD: 1,
          tasaVES: null,
          tasaCOP: null,
          rif: "",
          direccion: "",
          telefonoPrincipal: "",
          telefonoSecundario: "",
          mensajePieRecibo: "",
        },
      });
    }

    return res.json(config);
  } catch (error) {
    console.error("Error al obtener configuración:", error);
    return res.status(500).json({ message: "Error al obtener configuración" });
  }
}

export async function updateConfiguracion(req: Request, res: Response) {
  const result = ConfiguracionSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: result.error.format(),
    });
  }

  const data = result.data;

  try {
    const config = await prisma.configuracion.findFirst();
    if (!config) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }

    const actualizada = await prisma.configuracion.update({
      where: { id: config.id },
      data: {
        ...data,
        tasaUSD: 1,
      },
    });

    return res.json(actualizada);
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar configuración" });
  }
}
