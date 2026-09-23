import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

function borrar(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* Windows puede tener el archivo bloqueado un instante; se limpia en la próxima corrida */
  }
}

export default function setup() {
  const dir = process.env.TEST_DB_DIR!;

  // Limpia restos de corridas anteriores (cada corrida usa su propia carpeta).
  for (const nombre of fs.readdirSync(os.tmpdir())) {
    if (nombre.startsWith("mostrador-test-db-")) borrar(path.join(os.tmpdir(), nombre));
  }

  fs.mkdirSync(dir, { recursive: true });
  execSync(`node ${path.join("node_modules", "prisma", "build", "index.js")} migrate deploy`, {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env },
    stdio: "pipe",
  });
  return () => borrar(dir);
}
