/**
 * Arranque de la app instalada. Lo lanza Electron con estas variables:
 *   MOSTRADOR_DATA_DIR  carpeta de datos del usuario (base, respaldos, clave)
 *   MIGRATIONS_DIR      carpeta con las migraciones .sql
 *   FRONTEND_DIR        interfaz ya compilada
 *   PORT                puerto preferido (si está ocupado se elige otro)
 * Prepara el entorno ANTES de cargar el servidor, actualiza la base y avisa el puerto.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { aplicarMigraciones } from "./lib/migraciones";

function exigir(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable ${nombre}.`);
  return v;
}

function main() {
  const datos = exigir("MOSTRADOR_DATA_DIR");
  fs.mkdirSync(datos, { recursive: true });

  const dbPath = path.join(datos, "mostrador.db");
  const respaldos = path.join(datos, "respaldos");
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = `file:${dbPath.split(path.sep).join("/")}`;
  process.env.BACKUP_DIR = respaldos;

  // La clave que firma las sesiones se crea una vez y se conserva: al reiniciar no se cierran sesiones.
  const archivoClave = path.join(datos, "clave-sesiones.txt");
  if (!fs.existsSync(archivoClave)) fs.writeFileSync(archivoClave, crypto.randomBytes(48).toString("hex"), { mode: 0o600 });
  process.env.JWT_SECRET = fs.readFileSync(archivoClave, "utf8").trim();

  const r = aplicarMigraciones(dbPath, exigir("MIGRATIONS_DIR"), respaldos);
  if (r.aplicadas.length > 0) console.log(`Base actualizada: ${r.aplicadas.join(", ")}`);

  // Se carga recién ahora: el servidor lee estas variables al importarse.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { startServer } = require("./index") as typeof import("./index");
  const preferido = Number(process.env.PORT) || 47821;

  const avisar = (server: ReturnType<typeof startServer>) => {
    const dir = server.address();
    const puerto = typeof dir === "object" && dir ? dir.port : preferido;
    console.log(`MOSTRADOR_LISTO:${puerto}`);
    process.send?.({ listo: puerto });
  };

  const servidor = startServer(preferido, "127.0.0.1");
  servidor.on("listening", () => avisar(servidor));
  servidor.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code !== "EADDRINUSE") throw e;
    const otro = startServer(0, "127.0.0.1");
    otro.on("listening", () => avisar(otro));
  });
}

// Si la ventana se cierra (o el proceso padre muere de golpe), el servidor no debe quedar huérfano
// ocupando el puerto: Electron le deja la entrada estándar abierta y aquí se vigila su cierre.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
process.stdin.resume();

try {
  main();
} catch (e) {
  console.error("MOSTRADOR_ERROR:", (e as Error).message);
  process.exit(1);
}
