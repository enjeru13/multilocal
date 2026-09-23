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

  tipo: z.enum(["PRODUCTO", "SERVICIO", "AMBOS"]).optional(),
  unidadMedida: z.string().min(1).optional(),
  controlaStock: z.boolean().optional(),
  sku: z.string().nullable().optional(),
  codigoBarras: z.string().nullable().optional(),
  exentoImpuesto: z.boolean().optional(),
  costoBase: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      return typeof val === "string"
        ? Number(val.replace(",", ".").replace(/\s/g, ""))
        : val;
    }),
  stockActual: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === "") return undefined;
      return typeof val === "string" ? Number(val.replace(",", ".")) : val;
    }),
  stockMinimo: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      return typeof val === "string" ? Number(val.replace(",", ".")) : val;
    }),
});
