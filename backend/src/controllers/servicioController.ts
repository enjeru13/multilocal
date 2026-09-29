// backend/src/controllers/servicioController.ts
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { ServicioSchema } from "../schemas/servicio.schema";
import prisma from "../lib/prisma";
import { z } from "zod";
import { aplicarImportacion, simularImportacion } from "../lib/importarProductos";
import { imagenesDir, borrarImagenServicio } from "../lib/archivos";

// El costo es información del negocio: el cajero no lo ve.
const ocultarCosto = <T extends { costoBase: number | null }>(s: T, role?: string): T =>
  role === "CAJERO" ? { ...s, costoBase: null } : s;

// Obtener todos los servicios
export async function getAllServicios(req: Request, res: Response) {
  try {
    const servicios = await prisma.servicio.findMany({
      include: {
        categoria: true,
      },
      orderBy: { nombreServicio: "asc" },
    });
    return res.json(servicios.map((s) => ocultarCosto(s, req.user?.role)));
  } catch (error) {
    console.error("Error al obtener servicios:", error);
    return res.status(500).json({ message: "Error al obtener servicios" });
  }
}

// Obtener un servicio por ID
export async function getServicioById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const servicio = await prisma.servicio.findUnique({
      where: { id: Number(id) },
      include: {
        categoria: true,
      },
    });

    if (!servicio) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    return res.json(ocultarCosto(servicio, req.user?.role));
  } catch (error) {
    console.error("Error al obtener servicio:", error);
    return res.status(500).json({ message: "Error al obtener servicio" });
  }
}

// Crear un nuevo servicio
export async function createServicio(req: Request, res: Response) {
  const result = ServicioSchema.safeParse(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Datos inválidos", detalles: result.error.format() });
  }

  const {
    nombreServicio,
    descripcion,
    precioBase,
    permiteDecimales,
    categoriaId,
    tipo,
    unidadMedida,
    controlaStock,
    sku,
    codigoBarras,
    costoBase,
    stockActual,
    stockMinimo,
    exentoImpuesto,
  } = result.data;

  try {
    const servicio = await prisma.servicio.create({
      data: {
        nombreServicio,
        descripcion,
        precioBase,
        permiteDecimales: permiteDecimales || false,
        categoriaId,
        tipo: tipo ?? "SERVICIO",
        unidadMedida: unidadMedida ?? "unidad",
        controlaStock: controlaStock ?? false,
        sku: sku || null,
        codigoBarras: codigoBarras || null,
        costoBase: costoBase ?? null,
        stockActual: stockActual ?? 0,
        stockMinimo: stockMinimo ?? null,
        exentoImpuesto: exentoImpuesto ?? false,
      },
      include: {
        categoria: true,
      },
    });
    return res.status(201).json(servicio);
  } catch (error: any) {
    if (
      error.code === "P2025" &&
      error.meta?.cause?.includes("foreign key constraint")
    ) {
      return res
        .status(400)
        .json({ message: "La categoría especificada no existe." });
    }
    console.error("Error al crear servicio:", error);
    return res.status(500).json({ message: "Error al crear servicio" });
  }
}

// Actualizar un servicio
export async function updateServicio(req: Request, res: Response) {
  const { id } = req.params;
  const result = ServicioSchema.safeParse(req.body);

  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Datos inválidos", detalles: result.error.format() });
  }

  const {
    nombreServicio,
    descripcion,
    precioBase,
    permiteDecimales,
    categoriaId,
    tipo,
    unidadMedida,
    controlaStock,
    sku,
    codigoBarras,
    costoBase,
    stockActual,
    stockMinimo,
    exentoImpuesto,
  } = result.data;

  try {
    const servicio = await prisma.servicio.update({
      where: { id: Number(id) },
      data: {
        nombreServicio,
        descripcion,
        precioBase,
        permiteDecimales: permiteDecimales || false,
        categoriaId,
        ...(tipo !== undefined && { tipo }),
        ...(unidadMedida !== undefined && { unidadMedida }),
        ...(controlaStock !== undefined && { controlaStock }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(codigoBarras !== undefined && { codigoBarras: codigoBarras || null }),
        ...(costoBase !== undefined && { costoBase }),
        ...(stockActual !== undefined && { stockActual }),
        ...(stockMinimo !== undefined && { stockMinimo }),
        ...(exentoImpuesto !== undefined && { exentoImpuesto }),
      },
      include: {
        categoria: true,
      },
    });

    return res.json(servicio);
  } catch (error: any) {
    if (error.code === "P2025") {
      if (error.meta?.cause?.includes("foreign key constraint")) {
        return res
          .status(400)
          .json({ message: "La categoría especificada no existe." });
      }
      return res
        .status(404)
        .json({ message: "Servicio no encontrado para actualizar." });
    }
    console.error("Error al actualizar servicio:", error);
    return res.status(500).json({ message: "Error al actualizar servicio" });
  }
}

// Eliminar un servicio
export async function deleteServicio(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const existente = await prisma.servicio.findUnique({
      where: { id: Number(id) },
    });

    if (!existente) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    await prisma.servicio.delete({ where: { id: Number(id) } });
    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar servicio:", error);
    return res.status(500).json({ message: "Error al eliminar servicio" });
  }
}

const AjustePreciosSchema = z.object({
  porcentaje: z.number().min(-90, "El descenso máximo es 90 %").max(500, "El aumento máximo es 500 %"),
  categoriaId: z.string().uuid().nullable().optional(),
  ids: z.array(z.number().int().positive()).optional(),
  redondeo: z.enum(["CENTAVOS", "ENTERO", "MEDIO"]).default("CENTAVOS"),
  simular: z.boolean().default(false),
});

function redondearPrecio(n: number, modo: "CENTAVOS" | "ENTERO" | "MEDIO") {
  if (modo === "ENTERO") return Math.round(n);
  if (modo === "MEDIO") return Math.round(n * 2) / 2;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Sube o baja los precios en un porcentaje (a todo el catálogo, a una
// categoría o a una selección). Con simular=true solo muestra qué cambiaría.
export async function ajustarPrecios(req: Request, res: Response) {
  const result = AjustePreciosSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }
  const { porcentaje, categoriaId, ids, redondeo, simular } = result.data;

  try {
    const servicios = await prisma.servicio.findMany({
      where: {
        ...(categoriaId ? { categoriaId } : {}),
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      select: { id: true, nombreServicio: true, precioBase: true },
    });

    const cambios = servicios
      .map((s) => ({
        id: s.id,
        nombre: s.nombreServicio,
        antes: s.precioBase,
        despues: Math.max(0, redondearPrecio(s.precioBase * (1 + porcentaje / 100), redondeo)),
      }))
      .filter((c) => c.despues !== c.antes);

    if (!simular && cambios.length > 0) {
      await prisma.$transaction(
        cambios.map((c) => prisma.servicio.update({ where: { id: c.id }, data: { precioBase: c.despues } }))
      );
    }

    return res.json({ aplicado: !simular, cantidad: cambios.length, ejemplos: cambios.slice(0, 8) });
  } catch (error) {
    console.error("Error al ajustar precios:", error);
    return res.status(500).json({ message: "Error al ajustar los precios" });
  }
}

// --- Importación masiva desde una hoja de cálculo ---

const celdaSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();
const ImportarSchema = z.object({
  moneda: z.enum(["USD", "VES", "COP"]).optional(),
  simular: z.boolean().default(true),
  filas: z
    .array(
      z.object({
        fila: z.number().int().positive(),
        nombre: celdaSchema,
        sku: celdaSchema,
        codigoBarras: celdaSchema,
        precio: celdaSchema,
        costo: celdaSchema,
        stock: celdaSchema,
        stockMinimo: celdaSchema,
        categoria: celdaSchema,
        unidad: celdaSchema,
        exento: celdaSchema,
        descripcion: celdaSchema,
      })
    )
    .min(1, "El archivo no tiene filas para importar."),
});

// POST /api/servicios/importar — con simular=true solo muestra qué pasaría; con false lo aplica.
export async function importarServicios(req: Request, res: Response) {
  const r = ImportarSchema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ message: r.error.issues[0]?.message ?? "Datos inválidos.", detalles: r.error.format() });
  try {
    const config = await prisma.configuracion.findFirst();
    const principal = normalizarMonedaServidor(config?.monedaPrincipal);
    const opciones = {
      moneda: r.data.moneda ?? principal,
      principal,
      tasas: { USD: 1, VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null },
      moduloInventario: !!config?.moduloInventario,
    };
    const resultado = r.data.simular
      ? await simularImportacion(r.data.filas, opciones)
      : await aplicarImportacion(r.data.filas, opciones, req.user?.id ?? null);
    if ("sinTasa" in resultado) {
      return res.status(400).json({ message: `Falta la tasa de ${opciones.moneda} en Configuración para convertir los precios a ${principal}.` });
    }
    return res.json(resultado);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status) return res.status(status).json({ message: (error as Error).message });
    console.error("Error al importar productos:", error);
    return res.status(500).json({ message: "No se pudo importar el archivo. No se guardó nada." });
  }
}

const normalizarMonedaServidor = (m: string | null | undefined): "USD" | "VES" | "COP" => (m === "VES" || m === "COP" ? m : "USD");

// --- Foto del producto ---

const EXTENSION_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// POST /api/servicios/:id/imagen (multipart, campo "imagen")
export async function subirImagenServicio(req: Request, res: Response) {
  const id = Number(req.params.id);
  const archivo = req.file;
  if (!archivo) return res.status(400).json({ message: "No se recibió ninguna imagen." });

  const ext = EXTENSION_POR_MIME[archivo.mimetype];
  if (!ext) return res.status(400).json({ message: "Formato no soportado. Usa una foto JPG, PNG o WEBP." });

  try {
    const existente = await prisma.servicio.findUnique({ where: { id } });
    if (!existente) return res.status(404).json({ message: "Servicio no encontrado" });

    borrarImagenServicio(id); // por si ya tenía una foto con otra extensión
    const nombre = `servicio-${id}.${ext}`;
    fs.writeFileSync(path.join(imagenesDir(), nombre), archivo.buffer);

    const actualizado = await prisma.servicio.update({
      where: { id },
      data: { imagen: nombre },
      include: { categoria: true },
    });
    return res.json(ocultarCosto(actualizado, req.user?.role));
  } catch (error) {
    console.error("Error al subir la imagen del servicio:", error);
    return res.status(500).json({ message: "No se pudo guardar la imagen." });
  }
}

// DELETE /api/servicios/:id/imagen
export async function eliminarImagenServicio(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const existente = await prisma.servicio.findUnique({ where: { id } });
    if (!existente) return res.status(404).json({ message: "Servicio no encontrado" });

    borrarImagenServicio(id);
    const actualizado = await prisma.servicio.update({
      where: { id },
      data: { imagen: null },
      include: { categoria: true },
    });
    return res.json(ocultarCosto(actualizado, req.user?.role));
  } catch (error) {
    console.error("Error al eliminar la imagen del servicio:", error);
    return res.status(500).json({ message: "No se pudo eliminar la imagen." });
  }
}
