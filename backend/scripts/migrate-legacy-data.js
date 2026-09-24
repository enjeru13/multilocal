/**
 * Importa el respaldo (.db) del sistema anterior a la base actual. Es la misma lógica que la
 * pantalla «Respaldos» de la app; esta versión es para hacerlo desde la terminal.
 * REEMPLAZA los datos actuales.
 *
 * Uso: pnpm --filter backend build && node scripts/migrate-legacy-data.js <ruta-al-backup.db>
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { importarLegado } = require("../build/lib/importarLegado");

const ruta = process.argv[2];
if (!ruta) {
  console.error("Uso: node scripts/migrate-legacy-data.js <ruta-al-backup.db>");
  process.exit(1);
}

const prisma = new PrismaClient();
importarLegado(ruta, prisma)
  .then((r) => console.log("Importado:", r))
  .catch((e) => {
    console.error("Error en la migración:", e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
