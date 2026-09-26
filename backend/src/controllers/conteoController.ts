import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";

interface AuthRequest extends Request {
  user?: { id: number; email: string; name?: string; role: Role };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** Solo con el módulo de inventario activo. */
export async function requerirInventario(_req: Request, res: Response, next: NextFunction) {
  const config = await prisma.configuracion.findFirst({ select: { moduloInventario: true } });
  if (!config?.moduloInventario) {
    return res.status(403).json({ message: "El inventario está desactivado en Configuración." });
  }
  return next();
}

const numero = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".").replace(/\s/g, "")) : v));

const crearSchema = z.object({
  nombre: z.string().trim().max(80).optional(),
  categoriaId: z.string().nullable().optional(),
});

const itemSchema = z.object({
  servicioId: z.number().int().positive(),
  cantidad: numero.refine((n) => Number.isFinite(n) && n >= 0, { message: "La cantidad contada no puede ser negativa." }),
  // "sumar" es para el escáner: cada lectura cuenta una unidad más. "fijar" reemplaza lo contado.
  modo: z.enum(["fijar", "sumar"]).default("fijar"),
});

const incluirDetalle = {
  servicio: { select: { id: true, nombreServicio: true, sku: true, codigoBarras: true, stockActual: true, costoBase: true, permiteDecimales: true, unidadMedida: true } },
} as const;

function resumir(detalles: { contado: number; esperado: number | null; diferencia: number | null; costoUnit: number | null; servicio: { stockActual: number; costoBase: number | null } }[], aplicado: boolean) {
  let sobrantes = 0;
  let faltantes = 0;
  let conDiferencia = 0;
  let valorSobrante = 0;
  let valorFaltante = 0;
  for (const d of detalles) {
    const dif = aplicado ? d.diferencia ?? 0 : d.contado - d.servicio.stockActual;
    if (Math.abs(dif) < 1e-9) continue;
    conDiferencia += 1;
    const costo = (aplicado ? d.costoUnit : d.servicio.costoBase) ?? 0;
    if (dif > 0) {
      sobrantes += dif;
      valorSobrante += dif * costo;
    } else {
      faltantes += -dif;
      valorFaltante += -dif * costo;
    }
  }
  return { contados: detalles.length, conDiferencia, sobrantes: r3(sobrantes), faltantes: r3(faltantes), valorSobrante: r2(valorSobrante), valorFaltante: r2(valorFaltante) };
}

// GET /api/conteos
export async function listarConteos(_req: Request, res: Response) {
  try {
    const conteos = await prisma.conteoInventario.findMany({ orderBy: { id: "desc" }, take: 100, include: { _count: { select: { detalles: true } } } });
    return res.json(conteos);
  } catch (error) {
    console.error("Error al listar conteos:", error);
    return res.status(500).json({ message: "No se pudieron cargar los conteos." });
  }
}

// POST /api/conteos
export async function crearConteo(req: AuthRequest, res: Response) {
  const r = crearSchema.safeParse(req.body ?? {});
  if (!r.success) return res.status(400).json({ message: r.error.issues[0]?.message ?? "Datos inválidos." });
  try {
    const abierto = await prisma.conteoInventario.findFirst({ where: { estado: "ABIERTO" } });
    if (abierto) {
      return res.status(409).json({ message: `Ya hay un conteo abierto (#${abierto.id}). Termínalo o cancélalo antes de empezar otro.`, conteoId: abierto.id });
    }
    if (r.data.categoriaId && !(await prisma.categoria.findUnique({ where: { id: r.data.categoriaId } }))) {
      return res.status(400).json({ message: "La categoría indicada no existe." });
    }
    const conteo = await prisma.conteoInventario.create({
      data: { nombre: r.data.nombre || null, categoriaId: r.data.categoriaId ?? null, userId: req.user?.id ?? null, userName: req.user?.name || req.user?.email || null },
    });
    return res.status(201).json(conteo);
  } catch (error) {
    console.error("Error al crear el conteo:", error);
    return res.status(500).json({ message: "No se pudo crear el conteo." });
  }
}

// GET /api/conteos/:id
export async function obtenerConteo(req: Request, res: Response) {
  try {
    const conteo = await prisma.conteoInventario.findUnique({
      where: { id: Number(req.params.id) },
      include: { detalles: { include: incluirDetalle, orderBy: { id: "desc" } } },
    });
    if (!conteo) return res.status(404).json({ message: "Conteo no encontrado." });
    const categoria = conteo.categoriaId ? await prisma.categoria.findUnique({ where: { id: conteo.categoriaId }, select: { nombre: true } }) : null;
    return res.json({ ...conteo, categoriaNombre: categoria?.nombre ?? null, resumen: resumir(conteo.detalles, conteo.estado === "APLICADO") });
  } catch (error) {
    console.error("Error al obtener el conteo:", error);
    return res.status(500).json({ message: "No se pudo cargar el conteo." });
  }
}

async function conteoAbierto(id: number, res: Response) {
  const conteo = await prisma.conteoInventario.findUnique({ where: { id } });
  if (!conteo) {
    res.status(404).json({ message: "Conteo no encontrado." });
    return null;
  }
  if (conteo.estado !== "ABIERTO") {
    res.status(409).json({ message: conteo.estado === "APLICADO" ? "Este conteo ya se aplicó." : "Este conteo está cancelado." });
    return null;
  }
  return conteo;
}

// PUT /api/conteos/:id/items  { servicioId, cantidad, modo }
export async function contarItem(req: Request, res: Response) {
  const r = itemSchema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ message: r.error.issues[0]?.message ?? "Datos inválidos." });
  try {
    const conteo = await conteoAbierto(Number(req.params.id), res);
    if (!conteo) return;
    const item = await prisma.servicio.findUnique({ where: { id: r.data.servicioId } });
    if (!item) return res.status(404).json({ message: "Producto no encontrado." });
    if (!item.controlaStock) return res.status(400).json({ message: `«${item.nombreServicio}» no controla existencias.` });
    if (conteo.categoriaId && item.categoriaId !== conteo.categoriaId) {
      return res.status(400).json({ message: `«${item.nombreServicio}» no es de la categoría de este conteo.` });
    }
    const cantidad = item.permiteDecimales ? r3(r.data.cantidad) : Math.round(r.data.cantidad);
    if (r.data.modo === "sumar") {
      const existente = await prisma.conteoDetalle.findUnique({ where: { conteoId_servicioId: { conteoId: conteo.id, servicioId: item.id } } });
      const total = r3((existente?.contado ?? 0) + (cantidad || 1));
      await prisma.conteoDetalle.upsert({
        where: { conteoId_servicioId: { conteoId: conteo.id, servicioId: item.id } },
        update: { contado: total },
        create: { conteoId: conteo.id, servicioId: item.id, contado: total },
      });
    } else {
      await prisma.conteoDetalle.upsert({
        where: { conteoId_servicioId: { conteoId: conteo.id, servicioId: item.id } },
        update: { contado: cantidad },
        create: { conteoId: conteo.id, servicioId: item.id, contado: cantidad },
      });
    }
    const detalle = await prisma.conteoDetalle.findUniqueOrThrow({
      where: { conteoId_servicioId: { conteoId: conteo.id, servicioId: item.id } },
      include: incluirDetalle,
    });
    return res.json(detalle);
  } catch (error) {
    console.error("Error al contar:", error);
    return res.status(500).json({ message: "No se pudo guardar lo contado." });
  }
}

// DELETE /api/conteos/:id/items/:servicioId
export async function quitarItem(req: Request, res: Response) {
  try {
    const conteo = await conteoAbierto(Number(req.params.id), res);
    if (!conteo) return;
    await prisma.conteoDetalle.deleteMany({ where: { conteoId: conteo.id, servicioId: Number(req.params.servicioId) } });
    return res.json({ message: "Quitado del conteo." });
  } catch (error) {
    console.error("Error al quitar del conteo:", error);
    return res.status(500).json({ message: "No se pudo quitar del conteo." });
  }
}

// POST /api/conteos/:id/aplicar — ajusta las existencias a lo contado y deja un movimiento por diferencia.
export async function aplicarConteo(req: AuthRequest, res: Response) {
  try {
    const conteo = await conteoAbierto(Number(req.params.id), res);
    if (!conteo) return;
    const detalles = await prisma.conteoDetalle.findMany({ where: { conteoId: conteo.id }, include: { servicio: true } });
    if (detalles.length === 0) return res.status(400).json({ message: "Todavía no has contado nada." });

    await prisma.$transaction(
      async (tx) => {
        for (const d of detalles) {
          // Se compara con lo que hay AHORA, no con lo que había al empezar: así las ventas hechas durante el conteo no se pisan dos veces.
          const actual = await tx.servicio.findUniqueOrThrow({ where: { id: d.servicioId } });
          const diferencia = r3(d.contado - actual.stockActual);
          await tx.conteoDetalle.update({ where: { id: d.id }, data: { esperado: actual.stockActual, diferencia, costoUnit: actual.costoBase } });
          if (Math.abs(diferencia) < 1e-9) continue;
          await tx.servicio.update({ where: { id: actual.id }, data: { stockActual: d.contado } });
          await tx.inventarioMovimiento.create({
            data: {
              servicioId: actual.id,
              tipo: diferencia > 0 ? "ENTRADA" : "SALIDA",
              cantidad: Math.abs(diferencia),
              motivo: "AJUSTE_MANUAL",
              stockResultante: d.contado,
              userId: req.user?.id ?? null,
              nota: `Toma de inventario #${conteo.id}`,
            },
          });
        }
        await tx.conteoInventario.update({ where: { id: conteo.id }, data: { estado: "APLICADO", aplicadoEn: new Date() } });
      },
      { timeout: 60_000 }
    );

    const final = await prisma.conteoInventario.findUniqueOrThrow({ where: { id: conteo.id }, include: { detalles: { include: incluirDetalle } } });
    return res.json({ ...final, resumen: resumir(final.detalles, true) });
  } catch (error) {
    console.error("Error al aplicar el conteo:", error);
    return res.status(500).json({ message: "No se pudo aplicar el conteo. No se cambió ninguna existencia." });
  }
}

// POST /api/conteos/:id/cancelar
export async function cancelarConteo(req: Request, res: Response) {
  try {
    const conteo = await conteoAbierto(Number(req.params.id), res);
    if (!conteo) return;
    await prisma.conteoInventario.update({ where: { id: conteo.id }, data: { estado: "CANCELADO" } });
    return res.json({ message: "Conteo cancelado. No se cambió ninguna existencia." });
  } catch (error) {
    console.error("Error al cancelar el conteo:", error);
    return res.status(500).json({ message: "No se pudo cancelar el conteo." });
  }
}
