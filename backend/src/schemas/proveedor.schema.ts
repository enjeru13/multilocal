import { z } from "zod";

export const ProveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre del proveedor es requerido"),
  identificacion: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
});

export const ProveedorUpdateSchema = ProveedorSchema.partial();
