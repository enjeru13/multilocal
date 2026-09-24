// electron-builder descarta las carpetas "node_modules" y las que empiezan con punto al copiar
// recursos extra. El servidor las necesita (dependencias y motor de Prisma en ".prisma"), así que
// se copia entero aquí, después del empaquetado y antes de crear el instalador.
const fs = require("fs");
const path = require("path");

exports.default = async function despuesDeEmpaquetar(context) {
  const origen = path.join(__dirname, "..", "stage", "server");
  const destino = path.join(context.appOutDir, "resources", "server");
  if (!fs.existsSync(origen)) throw new Error("Falta stage/server: ejecuta primero «pnpm --filter desktop preparar».");
  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(origen, destino, { recursive: true });
  const motor = path.join(destino, "node_modules", ".prisma", "client");
  if (!fs.existsSync(motor) || !fs.readdirSync(motor).some((f) => f.endsWith(".node"))) {
    throw new Error("El motor de Prisma no quedó en el paquete.");
  }
};
