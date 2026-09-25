import { Request, Response, NextFunction } from "express";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import dayjs from "dayjs";
import prisma from "../lib/prisma";
import { calcularTotales, r2 } from "@lavanderia/shared/dist/utils/totales";
import { opcionesTotales } from "../lib/ordenFinance";
import { createOrden, descuentoExcedeTope } from "./ordenController";
import { descuentoSchema } from "../schemas/orden.schema";

interface AuthRequest extends Request {
  user?: { id: number; email: string; name?: string; role: Role };
}

const numero = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".").replace(/\s/g, "")) : v));

const lineaSchema = z.object({
  // Con servicioId la línea sale del catálogo; sin él es una línea libre y necesita descripción.
  servicioId: z.number().int().positive().nullable().optional(),
  descripcion: z.string().trim().max(200).optional(),
  cantidad: numero.refine((n) => !isNaN(n) && n > 0, { message: "La cantidad debe ser mayor a 0" }),
  precio: numero.refine((n) => !isNaN(n) && n >= 0, { message: "El precio no puede ser negativo" }),
  exento: z.boolean().optional(),
});

const presupuestoSchema = z
  .object({
    clienteId: z.number().int().positive().nullable().optional(),
    contactoNombre: z.string().trim().max(120).nullable().optional(),
    contactoTelefono: z.string().trim().max(40).nullable().optional(),
    validoHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de validez inválida").optional(),
    observaciones: z.string().max(2000).nullable().optional(),
    condiciones: z.string().max(2000).nullable().optional(),
    descuento: descuentoSchema,
    lineas: z.array(lineaSchema).min(1, "Agrega al menos una línea al presupuesto."),
  })
  .refine((d) => d.clienteId || (d.contactoNombre && d.contactoNombre.length > 0), {
    message: "Indica el cliente o al menos un nombre de contacto.",
    path: ["contactoNombre"],
  });

const ESTADOS_MANUALES = ["BORRADOR", "ENVIADO", "ACEPTADO", "RECHAZADO"] as const;

const incluir = {
  cliente: { select: { id: true, nombre: true, apellido: true, telefono: true, identificacion: true, direccion: true, email: true } },
  detalles: { orderBy: { id: "asc" as const } },
} satisfies Prisma.PresupuestoInclude;

/** El estado que ve el usuario: pasada la fecha de validez, lo no resuelto figura como vencido. */
function estadoVisible(p: { estado: string; validoHasta: Date }) {
  const pendiente = p.estado === "BORRADOR" || p.estado === "ENVIADO";
  return pendiente && dayjs(p.validoHasta).endOf("day").isBefore(dayjs()) ? "VENCIDO" : p.estado;
}

function presentar<T extends { estado: string; validoHasta: Date }>(p: T) {
  return { ...p, estadoVisible: estadoVisible(p) };
}

/** Bloquea las rutas cuando el negocio no tiene el módulo activo. */
export async function requerirModulo(_req: Request, res: Response, next: NextFunction) {
  const config = await prisma.configuracion.findFirst({ select: { moduloPresupuestos: true } });
  if (!config?.moduloPresupuestos) {
    return res.status(403).json({ message: "El módulo de presupuestos está desactivado en Configuración." });
  }
  return next();
}

/** Arma las líneas guardables (con totales) a partir de lo que llega del cliente. */
async function prepararLineas(lineas: z.infer<typeof lineaSchema>[]) {
  const ids = [...new Set(lineas.map((l) => l.servicioId).filter((x): x is number => !!x))];
  const servicios = await prisma.servicio.findMany({ where: { id: { in: ids } } });
  const porId = new Map(servicios.map((s) => [s.id, s]));

  const base: { servicioId: number | null; descripcion: string; cantidad: number; precioUnit: number; exento: boolean; subtotal: number }[] = [];
  for (const l of lineas) {
    let descripcion = l.descripcion ?? "";
    let exento = !!l.exento;
    if (l.servicioId) {
      const s = porId.get(l.servicioId);
      if (!s) throw new Error(`El producto o servicio con ID ${l.servicioId} no existe.`);
      descripcion = descripcion || s.nombreServicio;
      exento = s.exentoImpuesto;
    } else if (!descripcion) {
      throw new Error("Cada línea libre necesita una descripción.");
    }
    const precioUnit = r2(l.precio);
    base.push({ servicioId: l.servicioId ?? null, descripcion, cantidad: l.cantidad, precioUnit, exento, subtotal: r2(precioUnit * l.cantidad) });
  }
  return base;
}

async function calcular(lineas: Awaited<ReturnType<typeof prepararLineas>>, descuento: z.infer<typeof descuentoSchema>) {
  const config = await prisma.configuracion.findFirst();
  const totales = calcularTotales(lineas.map((l) => ({ subtotal: l.subtotal, exento: l.exento })), opcionesTotales(config, descuento));
  return { config, totales };
}

// GET /api/presupuestos?estado=&q=
export async function listarPresupuestos(req: Request, res: Response) {
  try {
    const estado = String(req.query.estado ?? "").toUpperCase();
    const q = String(req.query.q ?? "").trim();
    const clienteId = Number(req.query.clienteId);
    const where: Prisma.PresupuestoWhereInput = {};
    if (Number.isInteger(clienteId) && clienteId > 0) where.clienteId = clienteId;
    if (["BORRADOR", "ENVIADO", "ACEPTADO", "RECHAZADO", "CONVERTIDO"].includes(estado)) where.estado = estado as never;
    if (estado === "VENCIDO") {
      where.estado = { in: ["BORRADOR", "ENVIADO"] };
      where.validoHasta = { lt: dayjs().startOf("day").toDate() };
    }
    if (q) {
      const n = Number(q.replace("#", ""));
      where.OR = [
        ...(Number.isInteger(n) && n > 0 ? [{ id: n }] : []),
        { contactoNombre: { contains: q } },
        { cliente: { nombre: { contains: q } } },
        { cliente: { apellido: { contains: q } } },
      ];
    }
    const lista = await prisma.presupuesto.findMany({
      where,
      orderBy: { id: "desc" },
      take: 500,
      include: { cliente: { select: { id: true, nombre: true, apellido: true } }, _count: { select: { detalles: true } } },
    });
    return res.json(lista.map(presentar));
  } catch (error) {
    console.error("Error al listar presupuestos:", error);
    return res.status(500).json({ message: "No se pudieron cargar los presupuestos." });
  }
}

// GET /api/presupuestos/:id
export async function obtenerPresupuesto(req: Request, res: Response) {
  try {
    const p = await prisma.presupuesto.findUnique({ where: { id: Number(req.params.id) }, include: incluir });
    if (!p) return res.status(404).json({ message: "Presupuesto no encontrado." });
    return res.json(presentar(p));
  } catch (error) {
    console.error("Error al obtener presupuesto:", error);
    return res.status(500).json({ message: "No se pudo cargar el presupuesto." });
  }
}

async function datosDesde(req: AuthRequest, d: z.infer<typeof presupuestoSchema>) {
  const lineas = await prepararLineas(d.lineas);
  const { config, totales } = await calcular(lineas, d.descuento);
  const tope = descuentoExcedeTope(req.user?.role, config, totales);
  if (tope !== null) throw Object.assign(new Error(`Tu descuento máximo es ${tope}%. Pide autorización a un administrador.`), { status: 403 });

  if (d.clienteId && !(await prisma.cliente.findUnique({ where: { id: d.clienteId } }))) {
    throw new Error("El cliente indicado no existe.");
  }
  const dias = config?.presupuestoValidezDias ?? 15;
  const validoHasta = d.validoHasta ? dayjs(d.validoHasta).endOf("day").toDate() : dayjs().add(dias, "day").endOf("day").toDate();
  return {
    lineas,
    totales,
    data: {
      clienteId: d.clienteId ?? null,
      contactoNombre: d.clienteId ? null : d.contactoNombre ?? null,
      contactoTelefono: d.clienteId ? null : d.contactoTelefono ?? null,
      validoHasta,
      observaciones: d.observaciones?.trim() || null,
      condiciones: (d.condiciones ?? config?.presupuestoCondiciones)?.trim() || null,
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      descuentoTipo: totales.descuento > 0 ? d.descuento?.tipo ?? null : null,
      descuentoValor: totales.descuento > 0 ? d.descuento?.valor ?? null : null,
      impuesto: totales.impuesto,
      impuestoTasa: config?.impuestoActivo ? config.impuestoTasa : null,
      total: totales.total,
    },
  };
}

const detallesData = (lineas: Awaited<ReturnType<typeof prepararLineas>>, totales: Awaited<ReturnType<typeof calcular>>["totales"]) =>
  lineas.map((l, i) => ({
    servicioId: l.servicioId,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precioUnit: l.precioUnit,
    exento: l.exento,
    subtotal: totales.lineas[i].subtotal,
    descuento: totales.lineas[i].descuento,
    impuesto: totales.lineas[i].impuesto,
    base: totales.lineas[i].base,
  }));

function responderError(res: Response, error: unknown, generico: string) {
  const status = (error as { status?: number }).status;
  if (error instanceof Error && (status || /existe|descripción|línea/i.test(error.message))) {
    return res.status(status ?? 400).json({ message: error.message });
  }
  console.error(generico, error);
  return res.status(500).json({ message: generico });
}

// POST /api/presupuestos
export async function crearPresupuesto(req: AuthRequest, res: Response) {
  const r = presupuestoSchema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ message: r.error.issues[0]?.message ?? "Datos inválidos.", detalles: r.error.format() });
  try {
    const { lineas, totales, data } = await datosDesde(req, r.data);
    const creado = await prisma.presupuesto.create({
      data: {
        ...data,
        userId: req.user?.id ?? null,
        userName: req.user?.name || req.user?.email || null,
        detalles: { create: detallesData(lineas, totales) },
      },
      include: incluir,
    });
    return res.status(201).json(presentar(creado));
  } catch (error) {
    return responderError(res, error, "No se pudo crear el presupuesto.");
  }
}

// PUT /api/presupuestos/:id
export async function actualizarPresupuesto(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const r = presupuestoSchema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ message: r.error.issues[0]?.message ?? "Datos inválidos.", detalles: r.error.format() });
  try {
    const actual = await prisma.presupuesto.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ message: "Presupuesto no encontrado." });
    if (actual.estado === "CONVERTIDO") return res.status(409).json({ message: "Este presupuesto ya se convirtió en venta y no se puede modificar." });

    const { lineas, totales, data } = await datosDesde(req, r.data);
    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.presupuestoDetalle.deleteMany({ where: { presupuestoId: id } });
      return tx.presupuesto.update({
        where: { id },
        data: { ...data, detalles: { create: detallesData(lineas, totales) } },
        include: incluir,
      });
    });
    return res.json(presentar(actualizado));
  } catch (error) {
    return responderError(res, error, "No se pudo guardar el presupuesto.");
  }
}

// PATCH /api/presupuestos/:id/estado
export async function cambiarEstado(req: Request, res: Response) {
  const id = Number(req.params.id);
  const estado = String(req.body?.estado ?? "");
  if (!(ESTADOS_MANUALES as readonly string[]).includes(estado)) {
    return res.status(400).json({ message: "Estado no válido." });
  }
  try {
    const actual = await prisma.presupuesto.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ message: "Presupuesto no encontrado." });
    if (actual.estado === "CONVERTIDO") return res.status(409).json({ message: "Este presupuesto ya se convirtió en venta." });
    const p = await prisma.presupuesto.update({ where: { id }, data: { estado: estado as never }, include: incluir });
    return res.json(presentar(p));
  } catch (error) {
    console.error("Error al cambiar el estado:", error);
    return res.status(500).json({ message: "No se pudo cambiar el estado." });
  }
}

// DELETE /api/presupuestos/:id
export async function eliminarPresupuesto(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const actual = await prisma.presupuesto.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ message: "Presupuesto no encontrado." });
    if (actual.estado === "CONVERTIDO") return res.status(409).json({ message: "No se puede eliminar: ya se convirtió en venta." });
    await prisma.presupuesto.delete({ where: { id } });
    return res.json({ message: "Presupuesto eliminado." });
  } catch (error) {
    console.error("Error al eliminar el presupuesto:", error);
    return res.status(500).json({ message: "No se pudo eliminar el presupuesto." });
  }
}

const CATEGORIA_LIBRES = "Servicios varios";

/** Las líneas libres pasan a ser servicios del catálogo (mismo nombre = mismo servicio) para poder venderlas. */
async function servicioParaLineaLibre(l: { descripcion: string; precioUnit: number; exento: boolean }) {
  const nombre = l.descripcion.trim().slice(0, 120);
  const existente = await prisma.servicio.findFirst({ where: { nombreServicio: nombre } });
  if (existente) return existente.id;
  const categoria = await prisma.categoria.upsert({ where: { nombre: CATEGORIA_LIBRES }, update: {}, create: { nombre: CATEGORIA_LIBRES } });
  const creado = await prisma.servicio.create({
    data: { nombreServicio: nombre, precioBase: l.precioUnit, categoriaId: categoria.id, tipo: "SERVICIO", exentoImpuesto: l.exento, permiteDecimales: true },
  });
  return creado.id;
}

// POST /api/presupuestos/:id/convertir  { clienteId? }
export async function convertirEnVenta(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  try {
    const p = await prisma.presupuesto.findUnique({ where: { id }, include: { detalles: true } });
    if (!p) return res.status(404).json({ message: "Presupuesto no encontrado." });
    if (p.estado === "CONVERTIDO") return res.status(409).json({ message: "Este presupuesto ya se convirtió en venta." });
    if (p.estado === "RECHAZADO") return res.status(409).json({ message: "Un presupuesto rechazado no se puede convertir. Vuelve a marcarlo como aceptado o enviado." });

    const clienteId: number | null = req.body?.clienteId ?? p.clienteId;
    const servicios: { servicioId: number; cantidad: number; precio: number }[] = [];
    for (const d of p.detalles) {
      const servicioId = d.servicioId ?? (await servicioParaLineaLibre(d));
      servicios.push({ servicioId, cantidad: d.cantidad, precio: d.precioUnit });
    }

    // Se reutiliza la creación normal de ventas: mismas reglas de stock, caja, impuestos y descuento tope.
    let estado = 200;
    let cuerpo: { id?: number; message?: string } = {};
    const resCapturado = {
      status(c: number) {
        estado = c;
        return this;
      },
      json(b: typeof cuerpo) {
        cuerpo = b;
        return this;
      },
    } as unknown as Response;
    const nota = `Desde el presupuesto N.º ${p.id}${p.observaciones ? `. ${p.observaciones}` : ""}`;
    await createOrden(
      Object.assign(Object.create(req), {
        body: {
          clienteId,
          estado: "PENDIENTE",
          observaciones: nota,
          servicios,
          descuento: p.descuento > 0 && p.descuentoTipo ? { tipo: p.descuentoTipo, valor: p.descuentoValor } : null,
        },
      }) as AuthRequest,
      resCapturado
    );
    if (estado >= 400 || !cuerpo.id) {
      return res.status(estado >= 400 ? estado : 500).json({ message: cuerpo.message ?? "No se pudo crear la venta desde el presupuesto." });
    }

    const actualizado = await prisma.presupuesto.update({
      where: { id },
      data: { estado: "CONVERTIDO", ordenId: cuerpo.id, ...(clienteId && !p.clienteId ? { clienteId } : {}) },
      include: incluir,
    });
    return res.json({ presupuesto: presentar(actualizado), ordenId: cuerpo.id });
  } catch (error) {
    return responderError(res, error, "No se pudo convertir el presupuesto en venta.");
  }
}
