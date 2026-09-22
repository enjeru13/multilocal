import { z } from "zod";

export const ServicioSchema = z.object({
  nombreServicio: z.string().min(1, "El nombre del servicio es requerido"),

  precioBase: z
    .union([z.string(), z.number()])
    .transform((val) =>
      typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val
    )
    .refine((n) => !isNaN(n) && n >= 0, {
      message: "El precio debe ser un número válido mayor o igual a cero",
    }),

  descripcion: z.string().nullable().optional(),

  permiteDecimales: z.boolean().optional(),

  categoriaId: z
    .string()
    .uuid("El ID de la categoría debe ser un UUID válido.")
    .min(1, "El ID de la categoría es requerido."),
});
