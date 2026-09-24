import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

/**
 * Lleva la base al esquema de esta versión sin depender de la herramienta de desarrollo de
 * Prisma: aplica, en orden, los .sql de `prisma/migrations` que falten. Se usa al arrancar la
 * app instalada (base nueva o actualización). Antes de tocar una base con datos hace una copia.
 */

const TABLA = "_migraciones_mostrador";

export interface ResultadoMigraciones {
  aplicadas: string[];
  respaldo: string | null;
}

function carpetas(dir: string) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();
}

export function aplicarMigraciones(dbPath: string, dirMigraciones: string, dirRespaldos: string): ResultadoMigraciones {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const existia = fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0;
  const db = new DatabaseSync(dbPath);
  let respaldo: string | null = null;
  const aplicadas: string[] = [];
  let fallo = false;

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ${TABLA} (nombre TEXT PRIMARY KEY, aplicada TEXT NOT NULL)`);
    const hechas = new Set((db.prepare(`SELECT nombre FROM ${TABLA}`).all() as { nombre: string }[]).map((r) => r.nombre));

    // Una base creada con la herramienta de desarrollo ya trae su propio registro.
    const hayPrisma = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'").get();
    if (hayPrisma) {
      for (const r of db.prepare("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL").all() as { migration_name: string }[]) {
        hechas.add(r.migration_name);
      }
    }

    const pendientes = carpetas(dirMigraciones).filter((n) => !hechas.has(n));
    if (pendientes.length === 0) return { aplicadas, respaldo };

    if (existia && hechas.size > 0) {
      fs.mkdirSync(dirRespaldos, { recursive: true });
      const sello = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      respaldo = path.join(dirRespaldos, `previo-actualizacion-${sello}.db`);
      db.exec(`VACUUM INTO '${respaldo.replace(/'/g, "''")}'`);
    }

    for (const nombre of pendientes) {
      const sql = fs.readFileSync(path.join(dirMigraciones, nombre, "migration.sql"), "utf8");
      try {
        db.exec(sql);
        db.prepare(`INSERT INTO ${TABLA} (nombre, aplicada) VALUES (?, ?)`).run(nombre, new Date().toISOString());
        aplicadas.push(nombre);
      } catch (e) {
        fallo = true;
        throw new Error(`Falló la actualización de la base (${nombre}): ${(e as Error).message}${respaldo ? ` Tus datos anteriores están en ${respaldo}.` : ""}`);
      }
    }
  } finally {
    db.close();
    // Una base nueva a medio crear no sirve: se descarta para empezar limpio la próxima vez.
    if (fallo && !existia) fs.rmSync(dbPath, { force: true });
  }
  return { aplicadas, respaldo };
}
