import nodemailer from "nodemailer";
import prisma from "./prisma";

/** Error con un mensaje ya listo para mostrarle a la persona (no un detalle técnico de SMTP). */
export class ErrorCorreo extends Error {}

async function transportador() {
  const config = await prisma.configuracion.findFirst();
  if (!config?.correoRemitente || !config?.correoContrasena) {
    throw new ErrorCorreo("Todavía no configuraste el correo del negocio (Configuración → Correo).");
  }
  return {
    remitente: config.correoRemitente,
    nombreNegocio: config.nombreNegocio || "Mostrador",
    transporte: nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.correoRemitente, pass: config.correoContrasena },
      // Sin esto, si no hay internet el envío se queda esperando varios minutos en vez de avisar.
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    }),
  };
}

/** Mensajes típicos de Gmail traducidos a algo que la persona pueda resolver. */
function traducirError(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);
  if (/Invalid login|Username and Password not accepted|EAUTH/i.test(texto)) {
    return "Gmail rechazó el correo o la contraseña. Revisa que sea una contraseña de aplicación (no la normal de la cuenta) en Configuración → Correo.";
  }
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/i.test(texto)) {
    return "No hay conexión a internet para mandar el correo.";
  }
  return "No se pudo mandar el correo. Inténtalo de nuevo en un momento.";
}

interface EnvioCorreo {
  para: string;
  asunto: string;
  html: string;
  texto?: string;
}

export async function enviarCorreo({ para, asunto, html, texto }: EnvioCorreo) {
  const { remitente, nombreNegocio, transporte } = await transportador();
  try {
    await transporte.sendMail({
      from: `"${nombreNegocio}" <${remitente}>`,
      to: para,
      subject: asunto,
      html,
      text: texto,
    });
  } catch (error) {
    if (error instanceof ErrorCorreo) throw error;
    console.error("Error al mandar correo:", error);
    throw new ErrorCorreo(traducirError(error));
  }
}
