import { z } from "zod";
import dayjs from "dayjs";

const fechaTransformada = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((val): Date | null => {
    if (val === null || val === undefined || val === "") return null;
    const fecha = dayjs(val);
    return fecha.isValid() ? fecha.toDate() : null;
  })
  .refine((val): val is Date | null => val === null || val instanceof Date, {
    message: "Fecha inválida",
  });

// Definimos el esquema del item de servicio una vez para reutilizarlo
const servicioItemSchema = z.object({
  servicioId: z.number().int().positive("ID de servicio inválido"),
  cantidad: z
    .union([z.number(), z.string()])
    .transform((val) =>
      typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val
    )
    .refine((n) => n > 0 && !isNaN(n), {
      message: "La cantidad debe ser un número válido mayor que 0",
    }),

  //  NUEVO CAMPO: Precio unitario (Opcional)
  precio: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      return typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val;
    })
    .refine((n) => n === undefined || (!isNaN(n) && n >= 0), {
      message: "El precio debe ser un número válido mayor o igual a 0",
    }),
});

export const ordenSchema = z.object({
  clienteId: z.number().int().positive("ID de cliente inválido"),

  estado: z.enum(["PENDIENTE", "ENTREGADO"], {
    errorMap: () => ({ message: "Estado de orden inválido" }),
  }),

  observaciones: z.string().nullable().optional(),

  fechaEntrega: fechaTransformada,

  servicios: z
    .array(servicioItemSchema)
    .min(1, "Debes agregar al menos un servicio a la orden"),
});

export const ordenUpdateSchema = z
  .object({
    clienteId: z.number().int().positive("ID de cliente inválido").optional(),
    estado: z
      .enum(["PENDIENTE", "ENTREGADO"], {
        errorMap: () => ({ message: "Estado de orden inválido" }),
      })
      .optional(),
    observaciones: z.string().nullable().optional(),
    fechaEntrega: fechaTransformada.optional(),

    // Aquí reutilizamos el mismo esquema de item que ya incluye 'precio'
    servicios: z
      .array(servicioItemSchema)
      .min(1, "Debes agregar al menos un servicio a la orden")
      .optional(),

    deliveredByUserId: z.number().int().nullable().optional(),
    deliveredByUserName: z.string().nullable().optional(),
  })
  .partial();

export const ObservacionUpdateSchema = z.object({
  observaciones: z.string().nullable().optional(),
});
