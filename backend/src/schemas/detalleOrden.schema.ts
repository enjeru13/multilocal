import { z } from "zod";

export const DetalleOrdenSchema = z.object({
  ordenId: z.number().int().positive({
    message: "El ordenId es obligatorio y debe ser un entero positivo",
  }),

  servicioId: z.number().int().positive({
    message: "ID de servicio inválido",
  }),

  cantidad: z
    .union([z.string(), z.number()])
    .transform((val) =>
      typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val
    )
    .refine((n) => n > 0 && !isNaN(n), {
      message: "La cantidad debe ser mayor que 0",
    }),

  precioUnit: z
    .union([z.string(), z.number()])
    .transform((val) =>
      typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val
    )
    .refine((n) => n >= 0 && !isNaN(n), {
      message: "El precio unitario debe ser válido",
    }),

  subtotal: z
    .union([z.string(), z.number()])
    .transform((val) =>
      typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val
    )
    .refine((n) => n >= 0 && !isNaN(n), {
      message: "El subtotal debe ser válido",
    }),
});
