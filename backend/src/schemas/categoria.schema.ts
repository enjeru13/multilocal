import { z } from "zod";

export const CategoriaSchema = z.object({
  nombre: z.string().min(1, "El nombre de la categoría es requerido."),
});
