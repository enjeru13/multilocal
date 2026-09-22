import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ConfiguracionSchema } from "../schemas/configuracion.schema";

// terminologia se guarda como TEXT en SQLite (Prisma no soporta Json ahí de
// forma confiable); se serializa/deserializa al cruzar la frontera HTTP.
function serializarConfig(config: any) {
  let terminologia = null;
  if (config.terminologia) {
    try {
      terminologia = JSON.parse(config.terminologia);
    } catch {
      terminologia = null;
    }
  }
  return { ...config, terminologia };
}

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
          rubro: "GENERICO",
        },
      });
    }

    return res.json(serializarConfig(config));
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

  const { terminologia, ...data } = result.data;

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
        ...(terminologia !== undefined && {
          terminologia: terminologia ? JSON.stringify(terminologia) : null,
        }),
      },
    });

    return res.json(serializarConfig(actualizada));
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar configuración" });
  }
}
