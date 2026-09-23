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

export const RubroSchema = z.enum([
  "LAVANDERIA",
  "REPUESTOS",
  "MINIMARKET",
  "GENERICO",
]);
export const MomentoDeduccionSchema = z.enum(["CREACION", "ENTREGA"]);

export const TerminologiaSchema = z
  .object({
    servicio: z.string().optional(),
    orden: z.string().optional(),
    cliente: z.string().optional(),
    servicioUno: z.string().optional(),
    ordenUno: z.string().optional(),
    clienteUno: z.string().optional(),
  })
  .nullable()
  .optional();

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

  rubro: RubroSchema.optional(),
  moduloInventario: z.boolean().optional(),
  moduloProveedores: z.boolean().optional(),
  moduloCaja: z.boolean().optional(),
  moduloFechaEntrega: z.boolean().optional(),
  moduloClienteTipo: z.boolean().optional(),
  clienteObligatorio: z.boolean().optional(),
  deduccionStockEn: MomentoDeduccionSchema.optional(),
  terminologia: TerminologiaSchema,

  impuestoActivo: z.boolean().optional(),
  impuestoNombre: z.string().trim().min(1).max(20).optional(),
  impuestoTasa: z.number().min(0, "La tasa no puede ser negativa").max(100, "La tasa no puede pasar de 100 %").optional(),
  preciosIncluyenImpuesto: z.boolean().optional(),
  descuentoMaxPct: z.number().min(0).max(100).optional(),
});
