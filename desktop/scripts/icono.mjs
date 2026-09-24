// Genera los iconos provisionales de la app: una "M" blanca sobre un cuadrado azul.
//   desktop/build/icon.png                       512  (Windows / instalador)
//   frontend/public/icons/icon-192.png / -512    esquinas redondeadas (PWA, "any")
//   frontend/public/icons/icon-maskable-512.png  a sangre, con la M dentro de la zona segura (PWA, "maskable")
//   frontend/public/icons/apple-touch-icon.png   180, a sangre y sin transparencia (iPhone)
//   frontend/public/icons/favicon-32.png         32
// Cuando se decida la marca definitiva, basta reemplazar estos archivos por el diseño final.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..", "..");

const fondo = [37, 99, 235];
const fondo2 = [29, 78, 216];
const trazo = [255, 255, 255];

// La M se define sobre un lienzo de 512 y se escala a cualquier tamaño.
const segmentos = [
  [150, 372, 150, 140],
  [150, 140, 256, 290],
  [256, 290, 362, 140],
  [362, 140, 362, 372],
];

function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const crcTabla = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const trozo = (tipo, datos) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
};

/** redondeo: radio de las esquinas (0 = a sangre). escalaM: tamaño de la M (1 = normal). */
function dibujar(N, { redondeo, escalaM = 1 }) {
  const e = N / 512;
  const radio = redondeo * e;
  const grosor = 34 * e * escalaM;
  const filas = [];
  for (let y = 0; y < N; y++) {
    const fila = Buffer.alloc(1 + N * 4);
    for (let x = 0; x < N; x++) {
      let a = 1;
      if (radio > 0) {
        const cx = Math.min(Math.max(x + 0.5, radio), N - radio);
        const cy = Math.min(Math.max(y + 0.5, radio), N - radio);
        a = Math.max(0, Math.min(1, radio - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
      }
      const g = y / N;
      let color = fondo.map((c, i) => c + (fondo2[i] - c) * g);
      let d = Infinity;
      for (const [x1, y1, x2, y2] of segmentos) {
        // Se escala respecto al centro para poder achicar la M y dejarle margen.
        const f = (v) => 256 + (v - 256) * escalaM;
        d = Math.min(d, distSeg((x + 0.5) / e, (y + 0.5) / e, f(x1), f(y1), f(x2), f(y2)));
      }
      const m = Math.max(0, Math.min(1, (grosor / e) / 2 - d + 0.5));
      color = color.map((c, i) => c + (trazo[i] - c) * m);
      const o = 1 + x * 4;
      fila[o] = color[0];
      fila[o + 1] = color[1];
      fila[o + 2] = color[2];
      fila[o + 3] = Math.round(a * 255);
    }
    filas.push(fila);
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(N, 0);
  cabecera.writeUInt32BE(N, 4);
  cabecera[8] = 8;
  cabecera[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo("IHDR", cabecera),
    trozo("IDAT", zlib.deflateSync(Buffer.concat(filas), { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

const salidas = [
  [path.join(raiz, "desktop", "build", "icon.png"), 512, { redondeo: 96 }],
  [path.join(raiz, "frontend", "public", "icons", "icon-192.png"), 192, { redondeo: 96 }],
  [path.join(raiz, "frontend", "public", "icons", "icon-512.png"), 512, { redondeo: 96 }],
  [path.join(raiz, "frontend", "public", "icons", "icon-maskable-512.png"), 512, { redondeo: 0, escalaM: 0.72 }],
  [path.join(raiz, "frontend", "public", "icons", "apple-touch-icon.png"), 180, { redondeo: 0, escalaM: 0.85 }],
  [path.join(raiz, "frontend", "public", "icons", "favicon-32.png"), 32, { redondeo: 8 }],
];

for (const [ruta, tam, opciones] of salidas) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const png = dibujar(tam, opciones);
  fs.writeFileSync(ruta, png);
  console.log(path.relative(raiz, ruta), `${tam}px`, `${png.length} bytes`);
}
