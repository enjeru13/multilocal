import { z } from "zod";

const monto = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" ? Number(v.replace(",", ".").replace(/\s/g, "")) : v))
  .refine((n) => !isNaN(n) && n > 0, { message: "El monto debe ser mayor a 0" });

const fecha = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Fecha inválida" });
      return z.NEVER;
    }
    return d;
  });

export const GastoSchema = z.object({
  concepto: z.string().trim().min(1, "Indica en qué se gastó").max(120),
  categoria: z.string().trim().min(1, "Elige una categoría").max(40),
  monto,
  moneda: z.enum(["USD", "VES", "COP"]).default("USD"),
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "PAGO_MOVIL"]).default("EFECTIVO"),
  fecha,
  proveedorId: z.number().int().positive().nullable().optional(),
  nota: z.string().trim().max(300).nullable().optional(),
  // Sale de la caja abierta como egreso. Por defecto solo el efectivo con caja activa.
  desdeCaja: z.boolean().optional(),
});

export const PagoCompraSchema = z.object({
  monto,
  moneda: z.enum(["USD", "VES", "COP"]).default("USD"),
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "PAGO_MOVIL"]).default("EFECTIVO"),
  nota: z.string().trim().max(300).nullable().optional(),
  desdeCaja: z.boolean().optional(),
});
