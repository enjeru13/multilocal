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
  // Total contado en moneda principal (si no se detalla por moneda).
  montoFinalContado: monto.optional(),
  // Arqueo por moneda: lo que hay físicamente de cada una.
  contadoPorMoneda: z.record(z.enum(["USD", "VES", "COP"]), monto).optional(),
  observacionCierre: z.string().nullable().optional(),
});

const MONEDAS: Moneda[] = ["USD", "VES", "COP"];

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

  // Efectivo físico por moneda: lo que entró (menos vueltos) más ingresos, menos egresos.
  // El fondo inicial se cuenta en la moneda principal.
  const cajon = new Map<Moneda, { cobrado: number; vueltos: number; ingresos: number; egresos: number }>();
  const fila = (m: Moneda) => {
    if (!cajon.has(m)) cajon.set(m, { cobrado: 0, vueltos: 0, ingresos: 0, egresos: 0 });
    return cajon.get(m)!;
  };
  fila(principal);
  for (const p of pagos.filter((x) => x.metodoPago === "EFECTIVO")) {
    fila(p.moneda as Moneda).cobrado += p.monto;
    for (const v of p.vueltos) fila(v.moneda as Moneda).vueltos += v.monto;
  }
  for (const m of sesion.movimientos) {
    if (m.tipo === "INGRESO") fila(m.moneda as Moneda).ingresos += m.monto;
    else fila(m.moneda as Moneda).egresos += m.monto;
  }
  const porMoneda = MONEDAS.filter((m) => cajon.has(m)).map((m) => {
    const f = cajon.get(m)!;
    const inicial = m === principal ? sesion.montoInicial : 0;
    return {
      moneda: m,
      inicial: r2(inicial),
      cobrado: r2(f.cobrado),
      vueltos: r2(f.vueltos),
      ingresos: r2(f.ingresos),
      egresos: r2(f.egresos),
      esperado: r2(inicial + f.cobrado - f.vueltos + f.ingresos - f.egresos),
    };
  });

  return {
    porMoneda,
    principal,
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
    const { principal, tasas } = await cargarTasas();

    // Con arqueo por moneda, el total contado sale de convertir cada moneda con la tasa vigente.
    let contado = result.data.montoFinalContado;
    let detalleCierre: string | null = null;
    const porMoneda = result.data.contadoPorMoneda;
    if (porMoneda && Object.keys(porMoneda).length > 0) {
      let total = 0;
      const detalle = resumen!.porMoneda.map((f) => {
        const contadoM = (porMoneda[f.moneda] as number | undefined) ?? 0;
        total += convertirAmonedaPrincipal(contadoM, f.moneda, tasas, principal);
        return { moneda: f.moneda, esperado: f.esperado, contado: contadoM, diferencia: parseFloat((contadoM - f.esperado).toFixed(2)) };
      });
      // Una moneda contada que no aparece en el resumen también se registra.
      for (const m of MONEDAS) {
        const c = porMoneda[m] as number | undefined;
        if (c && c > 0 && !detalle.some((d) => d.moneda === m)) {
          total += convertirAmonedaPrincipal(c, m, tasas, principal);
          detalle.push({ moneda: m, esperado: 0, contado: c, diferencia: parseFloat(c.toFixed(2)) });
        }
      }
      contado = parseFloat(total.toFixed(2));
      detalleCierre = JSON.stringify(detalle);
    }
    if (contado === undefined) {
      return res.status(400).json({ message: "Indica el efectivo contado." });
    }

    const cerrada = await prisma.cajaSesion.update({
      where: { id: abierta.id },
      data: {
        estado: "CERRADA",
        fechaCierre: new Date(),
        montoFinalContado: contado,
        montoFinalSistema: esperado,
        diferencia: parseFloat((contado - esperado).toFixed(2)),
        observacionCierre: result.data.observacionCierre ?? null,
        detalleCierre,
      },
    });
    return res.json(cerrada);
  } catch (error) {
    console.error("Error al cerrar caja:", error);
    return res.status(500).json({ message: "Error al cerrar la caja" });
  }
}

// GET /api/caja/:id/comprobante — todo lo necesario para imprimir el arqueo de una sesión.
export async function getComprobanteCaja(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: "Sesión inválida." });
  try {
    const resumen = await calcularResumen(id);
    if (!resumen) return res.status(404).json({ message: "Sesión de caja no encontrada." });
    const sesion = await prisma.cajaSesion.findUnique({
      where: { id },
      include: {
        usuarioApertura: { select: { id: true, name: true, email: true } },
        movimientos: { orderBy: { fecha: "asc" } },
      },
    });
    const { tasas } = await cargarTasas();
    return res.json({ ...resumen, sesion, tasas });
  } catch (error) {
    console.error("Error al obtener el comprobante de caja:", error);
    return res.status(500).json({ message: "Error al obtener el comprobante" });
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
