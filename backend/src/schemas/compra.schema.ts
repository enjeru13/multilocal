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

const fechaOpcional = z
  .string()
  .nullable()
  .optional()
  .refine((v) => !v || !isNaN(new Date(v).getTime()), { message: "Fecha inválida" });

export const CompraSchema = z.object({
  // Lo pagado al recibir la compra (moneda principal). Sin indicar: todo si ya
  // llegó la mercancía, nada si es un pedido pendiente. 0 = a crédito.
  pagoInicial: numero("El pago inicial debe ser un número válido mayor o igual a 0").optional(),
  fechaVencimiento: fechaOpcional,
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "PAGO_MOVIL"]).optional(),
  desdeCaja: z.boolean().optional(),
  proveedorId: z.number().int().positive("ID de proveedor inválido"),
  observaciones: z.string().nullable().optional(),
  estado: z.enum(["PENDIENTE", "RECIBIDA", "CANCELADA"]).optional(),
  detalles: z.array(compraDetalleSchema).min(1, "Agrega al menos un producto a la compra"),
});
