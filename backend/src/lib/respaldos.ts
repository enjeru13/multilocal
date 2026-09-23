import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import prisma from "./prisma";

export function getDbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const raw = url.replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.resolve(__dirname, "../../prisma", raw);
}

export function getBackupDir(): string {
  const dir = process.env.BACKUP_DIR ?? path.join(path.dirname(getDbPath()), "respaldos");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export const NOMBRE_VALIDO = /^[A-Za-z0-9._-]+\.db$/;

export interface InfoRespaldo {
  nombre: string;
  tipo: "auto" | "manual" | "previo-a-restauracion" | "otro";
  tamano: number;
  fecha: string;
}

export function listarRespaldos(): InfoRespaldo[] {
  const dir = getBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => NOMBRE_VALIDO.test(f))
    .map((nombre) => {
      const st = fs.statSync(path.join(dir, nombre));
      const tipo = nombre.startsWith("auto-")
        ? "auto"
        : nombre.startsWith("manual-")
        ? "manual"
        : nombre.startsWith("previo-")
        ? "previo-a-restauracion"
        : "otro";
      return { nombre, tipo, tamano: st.size, fecha: st.mtime.toISOString() } as InfoRespaldo;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

let colaRespaldos: Promise<unknown> = Promise.resolve();

// Los respaldos se crean de a uno: evita que dos peticiones simultáneas elijan el mismo nombre.
export function crearRespaldo(prefijo: "auto" | "manual" | "previo"): Promise<string> {
  const tarea = colaRespaldos.then(() => crearRespaldoSinCola(prefijo));
  colaRespaldos = tarea.catch(() => undefined);
  return tarea;
}

async function crearRespaldoSinCola(prefijo: "auto" | "manual" | "previo"): Promise<string> {
  const base = `${prefijo}-${stamp()}`;
  let nombre = `${base}.db`;
  for (let n = 2; fs.existsSync(path.join(getBackupDir(), nombre)); n++) {
    nombre = `${base}-${n}.db`; // dos respaldos en el mismo segundo no se pisan
  }
  const destino = path.join(getBackupDir(), nombre);
  // VACUUM INTO produce una copia consistente aunque haya escrituras en curso.
  await prisma.$queryRawUnsafe(`VACUUM INTO '${destino.replace(/'/g, "''")}'`).catch(async () => {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  });
  return nombre;
}

// Solo se aceptan respaldos con el mismo esquema que el sistema actual.
export function validarRespaldo(ruta: string): { ok: true } | { ok: false; motivo: string } {
  let db: DatabaseSync | undefined;
  try {
    const header = Buffer.alloc(16);
    const fd = fs.openSync(ruta, "r");
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    if (header.toString("utf8", 0, 15) !== "SQLite format 3") {
      return { ok: false, motivo: "El archivo no es una base de datos SQLite." };
    }
    db = new DatabaseSync(ruta, { readOnly: true });
    const tablas = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
      (t) => t.name
    );
    for (const t of ["User", "Cliente", "Servicio", "Orden", "Pago", "Configuracion", "CajaSesion", "Compra"]) {
      if (!tablas.includes(t)) {
        return {
          ok: false,
          motivo: `Este respaldo no tiene el formato actual (falta la tabla ${t}). Si es del sistema anterior, debe importarse con la herramienta de migración.`,
        };
      }
    }
    const cols = (db.prepare("PRAGMA table_info('User')").all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes("activo")) {
      return { ok: false, motivo: "El respaldo es de una versión anterior del sistema." };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "No se pudo leer el archivo como respaldo válido." };
  } finally {
    db?.close();
  }
}

export async function restaurarDesdeArchivo(origen: string): Promise<{ respaldoPrevio: string }> {
  const validacion = validarRespaldo(origen);
  if (!validacion.ok) throw new Error(validacion.motivo);

  const respaldoPrevio = await crearRespaldo("previo");
  const dbPath = getDbPath();

  await prisma.$disconnect();
  try {
    for (const ext of ["-wal", "-shm", "-journal"]) {
      const extra = dbPath + ext;
      if (fs.existsSync(extra)) fs.rmSync(extra);
    }
    fs.copyFileSync(origen, dbPath);
  } finally {
    await prisma.$connect();
  }
  return { respaldoPrevio };
}

const VEINTE_HORAS = 20 * 60 * 60 * 1000;
const MAX_AUTO = 14;

async function respaldoAutomaticoSiToca() {
  try {
    const autos = listarRespaldos().filter((r) => r.tipo === "auto");
    const ultimo = autos[0] ? new Date(autos[0].fecha).getTime() : 0;
    if (Date.now() - ultimo > VEINTE_HORAS) {
      const nombre = await crearRespaldo("auto");
      console.log(`Respaldo automático creado: ${nombre}`);
    }
    const dir = getBackupDir();
    for (const viejo of listarRespaldos().filter((r) => r.tipo === "auto").slice(MAX_AUTO)) {
      fs.rmSync(path.join(dir, viejo.nombre), { force: true });
    }
  } catch (error) {
    console.error("No se pudo crear el respaldo automático:", error);
  }
}

export function iniciarRespaldosAutomaticos() {
  setTimeout(respaldoAutomaticoSiToca, 5000);
  const timer = setInterval(respaldoAutomaticoSiToca, 6 * 60 * 60 * 1000);
  timer.unref();
}
