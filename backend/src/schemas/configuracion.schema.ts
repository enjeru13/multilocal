import { z } from "zod";

export const MonedaSchema = z.enum(["USD", "VES", "COP"]);

const parseTasa = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === "string") {
      const limpio = val.replace(",", ".").replace(/\s/g, "");
      const num = Number(limpio);
      return isNaN(num) ? null : num;
    }
    return typeof val === "number" ? val : null;
  })
  .nullable();

export const ConfiguracionSchema = z.object({
  nombreNegocio: z.string().min(1, "Debes indicar el nombre del negocio"),
  monedaPrincipal: MonedaSchema,
  tasaUSD: z.number().nullable().default(1),
  tasaVES: parseTasa,
  tasaCOP: parseTasa,
  rif: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  telefonoPrincipal: z.string().nullable().optional(),
  telefonoSecundario: z.string().nullable().optional(),
  mensajePieRecibo: z.string().nullable().optional(),
});
