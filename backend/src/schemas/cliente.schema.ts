import { z } from "zod";

export const ClienteSchemaBase = z.object({
  nombre: z.string().trim(),
  apellido: z.string().trim(),

  tipo: z.enum(["NATURAL", "EMPRESA"], {
    required_error: "El tipo de cliente es obligatorio",
    invalid_type_error: "Tipo de cliente inválido",
  }),
  telefono: z
    .string()
    .min(6, "El teléfono principal debe tener al menos 6 caracteres")
    .max(20, "El teléfono principal es demasiado largo")
    .regex(
      /^[0-9()+\-.\s]{6,20}$/,
      "Formato de teléfono inválido (solo números, +, -, ., (, ))"
    ),

  telefono_secundario: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((val) => !val || /^[0-9()+\-.\s]{6,20}$/.test(val), {
      message: "Formato de teléfono secundario inválido.",
    }),

  direccion: z
    .string()
    .min(4, "La dirección es obligatoria y debe tener al menos 4 caracteres"),

  identificacion: z
    .string()
    .regex(
      /^(V|J|E)-[\d-]{6,15}$/,
      "Formato de identificación inválido (Ej: V-12345678, J-12345678-0, E-9876543)"
    ),

  email: z
    .string()
    .trim()
    .email("Formato de correo electrónico inválido")
    .nullable()
    .optional(),
});

export const ClienteSchema = ClienteSchemaBase.superRefine((data, ctx) => {
  if (data.tipo === "NATURAL") {
    if (!data.nombre || data.nombre.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre es obligatorio y debe tener al menos 2 caracteres.",
        path: ["nombre"],
      });
    } else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(data.nombre)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre solo puede contener letras.",
        path: ["nombre"],
      });
    }

    if (!data.apellido || data.apellido.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "El apellido es obligatorio y debe tener al menos 2 caracteres.",
        path: ["apellido"],
      });
    } else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(data.apellido)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El apellido solo puede contener letras.",
        path: ["apellido"],
      });
    }
  } else if (data.tipo === "EMPRESA") {
    if (!data.nombre || data.nombre.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "La razón social (nombre) es obligatoria y debe tener al menos 2 caracteres.",
        path: ["nombre"],
      });
    }
    if (data.apellido && data.apellido.trim() !== "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El apellido debe estar vacío para clientes tipo EMPRESA.",
        path: ["apellido"],
      });
    }
  }
});

export const ClienteUpdateSchema = ClienteSchemaBase.partial().superRefine(
  (data, ctx) => {
    if (data.tipo) {
      if (data.tipo === "NATURAL") {
        if (data.nombre && data.nombre.trim().length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El nombre debe tener al menos 2 caracteres.",
            path: ["nombre"],
          });
        } else if (
          data.nombre &&
          !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(data.nombre)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El nombre solo puede contener letras.",
            path: ["nombre"],
          });
        }

        if (data.apellido && data.apellido.trim().length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El apellido debe tener al menos 2 caracteres.",
            path: ["apellido"],
          });
        } else if (
          data.apellido &&
          !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(data.apellido)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El apellido solo puede contener letras.",
            path: ["apellido"],
          });
        }
      } else if (data.tipo === "EMPRESA") {
        if (data.nombre && data.nombre.trim().length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "La razón social (nombre) debe tener al menos 2 caracteres.",
            path: ["nombre"],
          });
        }
        if (data.apellido && data.apellido.trim() !== "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El apellido debe estar vacío para clientes tipo EMPRESA.",
            path: ["apellido"],
          });
        }
      }
    }

    if (
      data.telefono &&
      (data.telefono.length < 6 ||
        data.telefono.length > 20 ||
        !/^[0-9()+\-.\s]{6,20}$/.test(data.telefono))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Formato de teléfono principal inválido.",
        path: ["telefono"],
      });
    }
    if (
      data.telefono_secundario &&
      data.telefono_secundario.trim() !== "" &&
      !/^[0-9()+\-.\s]{6,20}$/.test(data.telefono_secundario)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Formato de teléfono secundario inválido.",
        path: ["telefono_secundario"],
      });
    }
    if (data.direccion && data.direccion.trim().length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La dirección debe tener al menos 4 caracteres.",
        path: ["direccion"],
      });
    }
    if (
      data.identificacion &&
      !/^(V|J|E)-[\d-]{6,15}$/.test(data.identificacion)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Formato de identificación inválido (Ej: V-12345678, J-12345678-0, E-9876543).",
        path: ["identificacion"],
      });
    }
    if (
      data.email &&
      data.email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Formato de correo electrónico inválido.",
        path: ["email"],
      });
    }
  }
);

// Ficha simple (perfiles sin "tipo de cliente": repuestos, minimarket...):
// solo el nombre es obligatorio; el resto es libre porque los documentos
// de identidad varían por país y por negocio.
const telefonoLibre = z
  .string()
  .trim()
  .nullable()
  .optional()
  .refine((v) => !v || /^[0-9()+\-.\s]{6,20}$/.test(v), {
    message: "Formato de teléfono inválido (solo números, +, -, ., (, ))",
  });

export const ClienteSimpleSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  apellido: z.string().trim().nullable().optional(),
  telefono: telefonoLibre,
  telefono_secundario: telefonoLibre,
  direccion: z.string().trim().nullable().optional(),
  identificacion: z.string().trim().nullable().optional(),
  email: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Formato de correo electrónico inválido",
    }),
});

export const ClienteSimpleUpdateSchema = ClienteSimpleSchema.partial();

/** Normaliza una ficha simple a lo que espera la base (texto vacío en vez de null donde el resto del sistema concatena). */
export function normalizarClienteSimple(
  d: z.infer<typeof ClienteSimpleUpdateSchema>,
  creando = false
) {
  const out: Record<string, unknown> = creando ? { apellido: "", telefono: "", direccion: "" } : {};
  if (d.nombre !== undefined) out.nombre = d.nombre;
  if (d.apellido !== undefined) out.apellido = d.apellido ?? "";
  if (d.telefono !== undefined) out.telefono = d.telefono ?? "";
  if (d.telefono_secundario !== undefined) out.telefono_secundario = d.telefono_secundario || null;
  if (d.direccion !== undefined) out.direccion = d.direccion ?? "";
  if (d.identificacion !== undefined) out.identificacion = d.identificacion || null;
  if (d.email !== undefined) out.email = d.email || null;
  return out;
}
