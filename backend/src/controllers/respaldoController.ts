import { Request, Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import prisma from "../lib/prisma";
import { ArchivoNoValido, importarLegado, revisarLegado } from "../lib/importarLegado";
import {
  getBackupDir,
  listarRespaldos,
  crearRespaldo,
  restaurarDesdeArchivo,
  NOMBRE_VALIDO,
} from "../lib/respaldos";

function rutaDe(nombre: string): string | null {
  if (!NOMBRE_VALIDO.test(nombre)) return null;
  const ruta = path.join(getBackupDir(), nombre);
  return fs.existsSync(ruta) ? ruta : null;
}

export function listar(req: Request, res: Response) {
  try {
    return res.json(listarRespaldos());
  } catch (error) {
    console.error("Error al listar respaldos:", error);
    return res.status(500).json({ message: "Error al listar respaldos" });
  }
}

export async function crear(req: Request, res: Response) {
  try {
    const nombre = await crearRespaldo("manual");
    return res.status(201).json({ nombre });
  } catch (error) {
    console.error("Error al crear respaldo:", error);
    return res.status(500).json({ message: "No se pudo crear el respaldo" });
  }
}

export function descargar(req: Request, res: Response) {
  const ruta = rutaDe(String(req.params.nombre));
  if (!ruta) return res.status(404).json({ message: "Respaldo no encontrado" });
  return res.download(ruta, String(req.params.nombre));
}

export async function restaurarGuardado(req: Request, res: Response) {
  const ruta = rutaDe(String(req.params.nombre));
  if (!ruta) return res.status(404).json({ message: "Respaldo no encontrado" });
  try {
    const { respaldoPrevio } = await restaurarDesdeArchivo(ruta);
    return res.json({ message: "Respaldo restaurado.", respaldoPrevio });
  } catch (error: any) {
    return res.status(400).json({ message: error?.message ?? "No se pudo restaurar" });
  }
}

export async function restaurarArchivo(req: Request, res: Response) {
  const cuerpo = req.body as Buffer;
  if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0) {
    return res.status(400).json({ message: "No se recibió ningún archivo." });
  }
  const temporal = path.join(os.tmpdir(), `restaurar-${Date.now()}.db`);
  try {
    fs.writeFileSync(temporal, cuerpo);
    const { respaldoPrevio } = await restaurarDesdeArchivo(temporal);
    return res.json({ message: "Respaldo restaurado.", respaldoPrevio });
  } catch (error: any) {
    return res.status(400).json({ message: error?.message ?? "No se pudo restaurar" });
  } finally {
    fs.rmSync(temporal, { force: true });
  }
}

// POST /api/respaldos/importar-legado[?simular=1] — datos del sistema anterior (cuerpo = archivo .db).
// Con `simular` solo cuenta lo que trae; sin él reemplaza todo lo actual, tras un respaldo previo.
export async function importarDesdeLegado(req: Request, res: Response) {
  const cuerpo = req.body as Buffer;
  if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0) {
    return res.status(400).json({ message: "No se recibió ningún archivo." });
  }
  const temporal = path.join(os.tmpdir(), `legado-${Date.now()}.db`);
  try {
    fs.writeFileSync(temporal, cuerpo);
    const resumen = revisarLegado(temporal);
    if (req.query.simular) return res.json({ simulacion: true, resumen });

    const respaldoPrevio = await crearRespaldo("previo");
    await importarLegado(temporal, prisma);
    return res.json({ message: "Datos importados.", resumen, respaldoPrevio });
  } catch (error: any) {
    if (error instanceof ArchivoNoValido) return res.status(400).json({ message: error.message });
    console.error("Error al importar datos del sistema anterior:", error);
    return res.status(500).json({ message: "No se pudo importar. Tus datos actuales no se modificaron." });
  } finally {
    fs.rmSync(temporal, { force: true });
  }
}
