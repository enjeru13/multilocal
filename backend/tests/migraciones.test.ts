import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { aplicarMigraciones } from "../src/lib/migraciones";

const MIGRACIONES = path.resolve(__dirname, "../prisma/migrations");
const nueva = () => fs.mkdtempSync(path.join(os.tmpdir(), "mig-"));

function columnas(dbPath: string, tabla: string) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return (db.prepare(`PRAGMA table_info('${tabla}')`).all() as { name: string }[]).map((c) => c.name);
  } finally {
    db.close();
  }
}

describe("migraciones al arrancar la app instalada", () => {
  it("crea la base completa desde cero y no repite nada la segunda vez", () => {
    const dir = nueva();
    const db = path.join(dir, "mostrador.db");
    const r1 = aplicarMigraciones(db, MIGRACIONES, path.join(dir, "respaldos"));
    expect(r1.aplicadas.length).toBeGreaterThan(3);
    expect(r1.respaldo).toBeNull();
    expect(columnas(db, "Configuracion")).toContain("monedasActivas");
    expect(columnas(db, "CajaSesion")).toContain("detalleCierre");

    const r2 = aplicarMigraciones(db, MIGRACIONES, path.join(dir, "respaldos"));
    expect(r2.aplicadas).toEqual([]);
  });

  it("al actualizar una base con datos hace una copia antes y aplica solo lo nuevo", () => {
    const dir = nueva();
    const parcial = path.join(dir, "parcial");
    fs.mkdirSync(parcial);
    const todas = fs.readdirSync(MIGRACIONES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const n of todas.slice(0, 2)) fs.cpSync(path.join(MIGRACIONES, n), path.join(parcial, n), { recursive: true });

    const db = path.join(dir, "mostrador.db");
    aplicarMigraciones(db, parcial, path.join(dir, "respaldos"));
    expect(columnas(db, "Configuracion")).not.toContain("monedasActivas");

    const r = aplicarMigraciones(db, MIGRACIONES, path.join(dir, "respaldos"));
    expect(r.aplicadas).toEqual(todas.slice(2));
    expect(r.respaldo && fs.existsSync(r.respaldo)).toBe(true);
    expect(columnas(db, "Configuracion")).toContain("monedasActivas");
  });

  it("si una migración falla en una base nueva, la descarta para empezar limpio", () => {
    const dir = nueva();
    const rota = path.join(dir, "rota");
    fs.mkdirSync(path.join(rota, "001_mala"), { recursive: true });
    fs.writeFileSync(path.join(rota, "001_mala", "migration.sql"), "CREATE TABLE x (id INTEGER); ESTO NO ES SQL;");
    const db = path.join(dir, "mostrador.db");
    expect(() => aplicarMigraciones(db, rota, path.join(dir, "respaldos"))).toThrow(/Falló la actualización/);
    expect(fs.existsSync(db)).toBe(false);
  });
});
