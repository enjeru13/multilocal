// Prepara todo lo que lleva la app instalada dentro de desktop/stage:
//   stage/server    el servidor ya compilado, con sus dependencias (instaladas con npm, planas,
//                   sin enlaces de pnpm), el cliente de Prisma generado y las migraciones
//   stage/frontend  la interfaz compilada (sin URL de API: se sirve desde el mismo servidor)
// Uso: node scripts/preparar.mjs   (desde desktop/)   — luego: pnpm dist
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.join(aqui, "..");
const raiz = path.join(desktop, "..");
const stage = path.join(desktop, "stage");
const servidor = path.join(stage, "server");
const web = path.join(stage, "frontend");
const win = process.platform === "win32";

const pnpm = win ? "npx.cmd --yes pnpm@latest" : "npx --yes pnpm@latest";
const ejecutar = (cmd, cwd = raiz, env = {}) => {
  console.log(`\n$ ${cmd}   (${path.relative(raiz, cwd) || "."})`);
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
};
// En Windows un antivirus o un proceso recién cerrado puede retener un archivo unos segundos.
const quitar = (p) => fs.rmSync(p, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
const leer = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const back = leer(path.join(raiz, "backend", "package.json"));
const prismaVersion = back.dependencies["@prisma/client"];

// 1. Compilar todo
ejecutar(`${pnpm} --filter @lavanderia/shared build`);
// Solo se compila: el cliente de Prisma del servidor se genera más abajo, en su propia carpeta.
ejecutar(`${pnpm} --filter backend exec tsc -p tsconfig.json`);
// La interfaz se sirve desde el propio servidor: la API queda en la misma dirección.
ejecutar(`${pnpm} --filter frontend build`, raiz, { VITE_API_URL: "" });

// 2. Servidor autónomo
quitar(stage);
fs.mkdirSync(servidor, { recursive: true });
fs.cpSync(path.join(raiz, "backend", "build"), path.join(servidor, "build"), { recursive: true });
fs.mkdirSync(path.join(servidor, "prisma"), { recursive: true });
fs.cpSync(path.join(raiz, "backend", "prisma", "schema.prisma"), path.join(servidor, "prisma", "schema.prisma"));
fs.cpSync(path.join(raiz, "backend", "prisma", "migrations"), path.join(servidor, "prisma", "migrations"), { recursive: true });

const dependencias = Object.fromEntries(Object.entries(back.dependencies).filter(([, v]) => !String(v).startsWith("workspace:")));
fs.writeFileSync(
  path.join(servidor, "package.json"),
  JSON.stringify({ name: "mostrador-servidor", version: back.version, private: true, main: "build/produccion.js", dependencies: dependencias }, null, 2)
);

ejecutar("npm install --omit=dev --no-audit --no-fund --loglevel=error", servidor);

// El paquete compartido se copia tal cual (no está publicado en npm).
const compartido = path.join(servidor, "node_modules", "@lavanderia", "shared");
fs.mkdirSync(compartido, { recursive: true });
fs.cpSync(path.join(raiz, "shared", "dist"), path.join(compartido, "dist"), { recursive: true });
fs.copyFileSync(path.join(raiz, "shared", "package.json"), path.join(compartido, "package.json"));

// El cliente de Prisma se genera en una carpeta aparte (con la herramienta de Prisma y el motor
// de esta plataforma) y solo se copia el resultado: la herramienta no viaja en la app.
const gen = path.join(stage, "gen");
fs.mkdirSync(path.join(gen, "prisma"), { recursive: true });
fs.copyFileSync(path.join(servidor, "prisma", "schema.prisma"), path.join(gen, "prisma", "schema.prisma"));
fs.writeFileSync(path.join(gen, "package.json"), JSON.stringify({ name: "gen", private: true }));
ejecutar(`npm install --no-audit --no-fund --loglevel=error prisma@${prismaVersion} @prisma/client@${prismaVersion}`, gen);
ejecutar("npx prisma generate --schema prisma/schema.prisma", gen, { DATABASE_URL: "file:./generar.db" });
fs.cpSync(path.join(gen, "node_modules", ".prisma"), path.join(servidor, "node_modules", ".prisma"), { recursive: true });
quitar(gen);

// Recorte: motores y variantes de Prisma que esta app (SQLite, motor nativo) no usa.
const borrar = (dir, patron) => {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) if (patron.test(f)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
};
borrar(path.join(servidor, "node_modules", ".prisma", "client"), /(wasm|edge|[.]d[.]ts$|index-browser)/);
borrar(path.join(servidor, "node_modules", "@prisma", "client", "runtime"), /(wasm|postgresql|mysql|sqlserver|cockroachdb|react-native|edge|[.]d[.]ts$|[.]d[.]mts$|[.]map$|[.]mjs$)/);
fs.rmSync(path.join(servidor, "node_modules", ".bin"), { recursive: true, force: true });

// 3. Interfaz
fs.cpSync(path.join(raiz, "frontend", "dist"), web, { recursive: true });

const mb = (dir) => {
  let total = 0;
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else total += fs.statSync(p).size;
    }
  };
  recorrer(dir);
  return (total / 1048576).toFixed(1);
};
console.log(`\nListo. stage/server ${mb(servidor)} MB · stage/frontend ${mb(web)} MB`);
