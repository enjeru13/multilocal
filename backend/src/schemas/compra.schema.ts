import { z } from "zod";

const numero = (msg: string) =>
  z
    .union([z.string(), z.number()])
    .transform((val) =>
      typeof val === "string" ? Number(val.replace(",", ".").replace(/\s/g, "")) : val
    )
    .refine((n) => !isNaN(n) && n >= 0, { message: msg });

const compraDetalleSchema = z.object({
  servicioId: z.number().int().positive("ID de producto inválido"),
  cantidad: numero("La cantidad debe ser un número válido mayor o igual a 0").refine(
    (n) => n > 0,
    { message: "La cantidad debe ser mayor a 0" }
  ),
  costoUnit: numero("El costo unitario debe ser un número válido mayor o igual a 0"),
});

export const CompraSchema = z.object({
  proveedorId: z.number().int().positive("ID de proveedor inválido"),
  observaciones: z.string().nullable().optional(),
  estado: z.enum(["PENDIENTE", "RECIBIDA", "CANCELADA"]).optional(),
  detalles: z.array(compraDetalleSchema).min(1, "Agrega al menos un producto a la compra"),
});
