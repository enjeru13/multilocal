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
