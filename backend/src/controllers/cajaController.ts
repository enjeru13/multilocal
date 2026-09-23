import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { Role } from "@prisma/client";
import { calcularTotalAbonado } from "@lavanderia/shared/dist/utils/pagoFinance";
import { convertirAmonedaPrincipal } from "@lavanderia/shared/dist/utils/monedaHelpers";
import type { Moneda, TasasConversion } from "@lavanderia/shared/dist/types/types";

interface AuthRequest extends Request {
  user?: { id: number; email: string; name?: string; role: Role };
}

const monto = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v))
  .refine((n) => !isNaN(n) && n >= 0, { message: "Monto inválido" });

const AbrirSchema = z.object({ montoInicial: monto });
const MovimientoSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  monto: monto.refine((n) => n > 0, { message: "El monto debe ser mayor a 0" }),
  moneda: z.enum(["USD", "VES", "COP"]).default("USD"),
  concepto: z.string().min(1, "El concepto es requerido"),
});
const CerrarSchema = z.object({
  montoFinalContado: monto,
  observacionCierre: z.string().nullable().optional(),
});

async function cargarTasas() {
  const config = await prisma.configuracion.findFirst();
  const principal = (config?.monedaPrincipal || "USD") as Moneda;
  const tasas: TasasConversion = { VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null };
  return { principal, tasas };
}

// Efectivo esperado en caja, en moneda principal:
// inicial + pagos en efectivo (netos de vueltos) + ingresos - egresos.
async function calcularResumen(sesionId: number) {
  const { principal, tasas } = await cargarTasas();

  const sesion = await prisma.cajaSesion.findUnique({
    where: { id: sesionId },
    include: { movimientos: true },
  });
  if (!sesion) return null;

  const pagos = await prisma.pago.findMany({
    where: { cajaSesionId: sesionId },
    include: { vueltos: true },
  });
  const normalizar = (p: (typeof pagos)[number]) => ({ ...p, tasa: p.tasa ? Number(p.tasa) : null });

  const efectivo = calcularTotalAbonado(
    pagos.filter((p) => p.metodoPago === "EFECTIVO").map(normalizar),
    tasas,
    principal
  );
  const otrosMetodos = calcularTotalAbonado(
    pagos.filter((p) => p.metodoPago !== "EFECTIVO").map(normalizar),
    tasas,
    principal
  );

  let ingresos = 0;
  let egresos = 0;
  for (const m of sesion.movimientos) {
    const enPrincipal = convertirAmonedaPrincipal(m.monto, m.moneda as Moneda, tasas, principal);
    if (m.tipo === "INGRESO") ingresos += enPrincipal;
    else egresos += enPrincipal;
  }

  const r2 = (n: number) => parseFloat(n.toFixed(2));
  return {
    sesion,
    cantidadPagos: pagos.length,
    montoInicial: sesion.montoInicial,
    efectivoPagos: r2(efectivo),
    otrosMetodos: r2(otrosMetodos),
    ingresos: r2(ingresos),
    egresos: r2(egresos),
    efectivoEsperado: r2(sesion.montoInicial + efectivo + ingresos - egresos),
  };
}

export async function getCajaActual(req: Request, res: Response) {
  try {
    const abierta = await prisma.cajaSesion.findFirst({
      where: { estado: "ABIERTA" },
      include: { usuarioApertura: { select: { id: true, name: true, email: true } } },
    });
    if (!abierta) return res.json({ abierta: false });
    const resumen = await calcularResumen(abierta.id);
    return res.json({ abierta: true, ...resumen });
  } catch (error) {
    console.error("Error al obtener caja actual:", error);
    return res.status(500).json({ message: "Error al obtener la caja actual" });
  }
}

export async function abrirCaja(req: AuthRequest, res: Response) {
  const result = AbrirSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }
  try {
    const yaAbierta = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
    if (yaAbierta) {
      return res.status(409).json({ message: "Ya hay una caja abierta. Ciérrala antes de abrir otra." });
    }
    const sesion = await prisma.cajaSesion.create({
      data: { usuarioAperturaId: req.user!.id, montoInicial: result.data.montoInicial },
    });
    return res.status(201).json(sesion);
  } catch (error) {
    console.error("Error al abrir caja:", error);
    return res.status(500).json({ message: "Error al abrir la caja" });
  }
}

export async function registrarMovimiento(req: AuthRequest, res: Response) {
  const result = MovimientoSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }
  try {
    const abierta = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
    if (!abierta) {
      return res.status(409).json({ message: "No hay una caja abierta." });
    }
    const movimiento = await prisma.cajaMovimiento.create({
      data: { ...result.data, cajaSesionId: abierta.id, userId: req.user!.id },
    });
    return res.status(201).json(movimiento);
  } catch (error) {
    console.error("Error al registrar movimiento de caja:", error);
    return res.status(500).json({ message: "Error al registrar el movimiento" });
  }
}

export async function cerrarCaja(req: AuthRequest, res: Response) {
  const result = CerrarSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: result.error.format() });
  }
  try {
    const abierta = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
    if (!abierta) {
      return res.status(409).json({ message: "No hay una caja abierta." });
    }
    const resumen = await calcularResumen(abierta.id);
    const esperado = resumen!.efectivoEsperado;
    const contado = result.data.montoFinalContado;

    const cerrada = await prisma.cajaSesion.update({
      where: { id: abierta.id },
      data: {
        estado: "CERRADA",
        fechaCierre: new Date(),
        montoFinalContado: contado,
        montoFinalSistema: esperado,
        diferencia: parseFloat((contado - esperado).toFixed(2)),
        observacionCierre: result.data.observacionCierre ?? null,
      },
    });
    return res.json(cerrada);
  } catch (error) {
    console.error("Error al cerrar caja:", error);
    return res.status(500).json({ message: "Error al cerrar la caja" });
  }
}

export async function getHistorialCajas(req: Request, res: Response) {
  try {
    const sesiones = await prisma.cajaSesion.findMany({
      where: { estado: "CERRADA" },
      orderBy: { fechaApertura: "desc" },
      take: 50,
      include: { usuarioApertura: { select: { id: true, name: true, email: true } } },
    });
    return res.json(sesiones);
  } catch (error) {
    console.error("Error al obtener historial de cajas:", error);
    return res.status(500).json({ message: "Error al obtener el historial" });
  }
}
