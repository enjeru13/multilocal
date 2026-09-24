// Genera el icono provisional de la app (desktop/build/icon.png, 512×512): una "M" blanca sobre
// un cuadrado azul de esquinas redondeadas. Cuando se decida el nombre y la marca definitivos,
// basta con reemplazar ese PNG por el diseño final.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const N = 512;
const aqui = path.dirname(fileURLToPath(import.meta.url));
const salida = path.join(aqui, "..", "build", "icon.png");

const fondo = [37, 99, 235]; // azul
const fondo2 = [29, 78, 216];
const trazo = [255, 255, 255];

// Distancia de un punto a un segmento, para dibujar los trazos de la M con bordes suaves.
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const segmentos = [
  [150, 372, 150, 140],
  [150, 140, 256, 290],
  [256, 290, 362, 140],
  [362, 140, 362, 372],
];
const grosor = 34;
const radio = 96;

function cuadradoRedondeado(x, y) {
  const cx = Math.min(Math.max(x, radio), N - radio);
  const cy = Math.min(Math.max(y, radio), N - radio);
  return radio - Math.hypot(x - cx, y - cy); // >0 dentro
}

const filas = [];
for (let y = 0; y < N; y++) {
  const fila = Buffer.alloc(1 + N * 4);
  fila[0] = 0;
  for (let x = 0; x < N; x++) {
    const a = Math.max(0, Math.min(1, cuadradoRedondeado(x + 0.5, y + 0.5) + 0.5));
    const g = y / N;
    let color = fondo.map((c, i) => c + (fondo2[i] - c) * g);
    let d = Infinity;
    for (const s of segmentos) d = Math.min(d, distSeg(x + 0.5, y + 0.5, ...s));
    const m = Math.max(0, Math.min(1, grosor / 2 - d + 0.5));
    color = color.map((c, i) => c + (trazo[i] - c) * m);
    const o = 1 + x * 4;
    fila[o] = color[0];
    fila[o + 1] = color[1];
    fila[o + 2] = color[2];
    fila[o + 3] = Math.round(a * 255);
  }
  filas.push(fila);
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

const cabecera = Buffer.alloc(13);
cabecera.writeUInt32BE(N, 0);
cabecera.writeUInt32BE(N, 4);
cabecera[8] = 8; // profundidad
cabecera[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  trozo("IHDR", cabecera),
  trozo("IDAT", zlib.deflateSync(Buffer.concat(filas), { level: 9 })),
  trozo("IEND", Buffer.alloc(0)),
]);

fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, png);
console.log("Icono generado:", salida, `(${png.length} bytes)`);
