import { Request, Response } from "express";
import { z } from "zod";
import { enviarCorreo, ErrorCorreo } from "../lib/correo";

const EnviarCorreoSchema = z.object({
  para: z.string().email("Correo del destinatario no válido"),
  asunto: z.string().min(1).max(200),
  html: z.string().min(1),
  texto: z.string().optional(),
});

// POST /api/correo/enviar — recibo, presupuesto o estado de cuenta ya armados en el frontend.
export async function enviarCorreoGenerico(req: Request, res: Response) {
  const result = EnviarCorreoSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.issues[0]?.message ?? "Datos inválidos.", detalles: result.error.format() });
  }
  try {
    await enviarCorreo(result.data);
    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof ErrorCorreo) return res.status(400).json({ message: error.message });
    console.error("Error al mandar correo:", error);
    return res.status(500).json({ message: "No se pudo mandar el correo." });
  }
}
