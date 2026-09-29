import fs from "fs";
import path from "path";

/**
 * Carpeta donde se guardan las fotos de los productos. En la app instalada la fija Electron
 * (junto a la base de datos, dentro de la carpeta de datos del usuario); en desarrollo cae en
 * `backend/imagenes` (fuera de git). Se crea sola si no existe.
 */
export function imagenesDir(): string {
  const dir = process.env.IMAGENES_DIR || path.join(__dirname, "..", "..", "imagenes");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Borra cualquier archivo `servicio-<id>.*` que ya exista, sin importar la extensión anterior. */
export function borrarImagenServicio(id: number) {
  const dir = imagenesDir();
  const prefijo = `servicio-${id}.`;
  for (const archivo of fs.readdirSync(dir)) {
    if (archivo.startsWith(prefijo)) fs.rmSync(path.join(dir, archivo), { force: true });
  }
}
