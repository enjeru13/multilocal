import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ConfiguracionSchema } from "../schemas/configuracion.schema";
import { monedasActivas } from "@lavanderia/shared/dist/utils/monedaHelpers";
import type { Moneda } from "@lavanderia/shared/dist/types/types";

// terminologia se guarda como TEXT en SQLite (Prisma no soporta Json ahí de
// forma confiable); se serializa/deserializa al cruzar la frontera HTTP.
// La moneda principal no se puede cambiar cuando ya hay dinero registrado en ella.
async function hayMovimientos() {
  const [ordenes, pagos, gastos, compras] = await Promise.all([prisma.orden.count(), prisma.pago.count(), prisma.gasto.count(), prisma.compra.count()]);
  return ordenes + pagos + gastos + compras > 0;
}

function serializarConfig(config: any, principalBloqueada = false) {
  let terminologia = null;
  if (config.terminologia) {
    try {
      terminologia = JSON.parse(config.terminologia);
    } catch {
      terminologia = null;
    }
  }
  return { ...config, terminologia, principalBloqueada };
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

    return res.json(serializarConfig(config, await hayMovimientos()));
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

  const { terminologia, monedasActivas: activasPedidas, ...data } = result.data;

  try {
    const config = await prisma.configuracion.findFirst();
    if (!config) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }

    // La moneda principal es la unidad en que se guardan ventas, pagos y reportes: cambiarla
    // con movimientos registrados los dejaría en otra unidad sin convertir.
    if (data.monedaPrincipal !== config.monedaPrincipal) {
      if (await hayMovimientos()) {
        return res.status(409).json({
          message: "No se puede cambiar la moneda principal porque ya hay ventas, pagos o compras registrados en " + config.monedaPrincipal + ".",
        });
      }
    }

    const principal = data.monedaPrincipal as Moneda;
    const activas = monedasActivas(activasPedidas ? activasPedidas.join(",") : config.monedasActivas, principal);

    const actualizada = await prisma.configuracion.update({
      where: { id: config.id },
      data: {
        ...data,
        monedasActivas: activas.join(","),
        tasaUSD: 1,
        ...(terminologia !== undefined && {
          terminologia: terminologia ? JSON.stringify(terminologia) : null,
        }),
      },
    });

    return res.json(serializarConfig(actualizada, await hayMovimientos()));
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar configuración" });
  }
}
