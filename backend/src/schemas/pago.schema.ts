import { z } from "zod";

export const MetodoPagoSchema = z.enum([
  "EFECTIVO",
  "TRANSFERENCIA",
  "PAGO_MOVIL",
]);
export const MonedaSchema = z.enum(["USD", "VES", "COP"]);

export const VueltoSchema = z.object({
  monto: z
    .union([z.string(), z.number()])
    .transform((val) =>
      typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val
    )
    .refine((n) => !isNaN(n) && n > 0, {
      message: "El monto del vuelto debe ser positivo",
    }),
  moneda: MonedaSchema,
});

export const PagoSchema = z.object({
  ordenId: z.number().int().positive("ID de orden inválido"),
  monto: z
    .union([z.string(), z.number()])
    .transform((val) =>
      typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val
    )
    .refine((n) => !isNaN(n) && n > 0, {
      message: "El monto debe ser un número positivo",
    }),
  moneda: MonedaSchema,
  metodoPago: MetodoPagoSchema,
  nota: z.string().nullable().optional(),
  
  fechaPago: z.string().datetime().optional(), // Permite recibir fechas ISO (ej: 2023-10-27T...)
  tasa: z.number().positive().optional(),      // Permite recibir la tasa

  vueltos: z.array(VueltoSchema).optional(),
});