import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { tasaCruzada } from "@lavanderia/shared/dist/utils/monedaHelpers";
import type { Moneda, TasasConversion } from "@lavanderia/shared/dist/types/types";

/**
 * Importación masiva de productos desde una hoja de cálculo. El navegador lee el archivo y manda
 * las filas tal cual (texto o número); aquí se entienden, se validan y se crean o actualizan.
 * La misma función sirve para la vista previa (sin guardar) y para aplicar los cambios.
 */

export type Celda = string | number | boolean | null | undefined;

export interface FilaEntrada {
  /** Número de fila en el archivo original, para que los mensajes digan dónde está el problema. */
  fila: number;
  nombre?: Celda;
  sku?: Celda;
  codigoBarras?: Celda;
  precio?: Celda;
  costo?: Celda;
  stock?: Celda;
  stockMinimo?: Celda;
  categoria?: Celda;
  unidad?: Celda;
  exento?: Celda;
  descripcion?: Celda;
}

export type AccionFila = "CREAR" | "ACTUALIZAR" | "ERROR";

export interface FilaAnalizada {
  fila: number;
  accion: AccionFila;
  nombre: string;
  errores: string[];
  avisos: string[];
  /** Solo si actualiza: qué producto existente coincidió y por qué. */
  coincide?: { id: number; nombre: string; por: "código" | "código de barras" | "nombre" };
  /** Solo si actualiza: los campos que cambian. */
  cambios?: string[];
}

export interface DatosProducto {
  nombre?: string;
  descripcion?: string;
  sku?: string;
  codigoBarras?: string;
  precio?: number;
  costo?: number;
  stock?: number;
  stockMinimo?: number;
  categoria?: string;
  unidad?: string;
  permiteDecimales?: boolean;
  exento?: boolean;
}

interface Analisis {
  fila: FilaAnalizada;
  datos: DatosProducto;
  existenteId?: number;
}

export interface OpcionesImportacion {
  moneda: Moneda;
  principal: Moneda;
  tasas: TasasConversion;
  moduloInventario: boolean;
}

const vacio = (v: Celda) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const texto = (v: Celda): string | undefined => (vacio(v) ? undefined : String(v).trim());

/**
 * Lee un número escrito como sea: 1234.5, "1.234,50", "1,234.50", "$ 12", "Bs. 1.000".
 * Con un solo tipo de separador, tres cifras después indican miles ("1.234" = 1234); es el uso habitual
 * en Venezuela y Colombia. Devuelve undefined si está vacío y NaN si no es un número.
 */
export function parsearNumero(v: Celda): number | undefined {
  if (vacio(v)) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  let s = String(v).trim().replace(/[^\d.,\-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return NaN;
  const negativo = s.startsWith("-");
  s = s.replace(/-/g, "");
  const ultimoPunto = s.lastIndexOf(".");
  const ultimaComa = s.lastIndexOf(",");
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // El separador que aparece último es el decimal.
    const decimal = ultimoPunto > ultimaComa ? "." : ",";
    const miles = decimal === "." ? "," : ".";
    s = s.split(miles).join("").replace(decimal, ".");
  } else if (ultimaComa >= 0 || ultimoPunto >= 0) {
    const sep = ultimaComa >= 0 ? "," : ".";
    const partes = s.split(sep);
    const esMiles = partes.length > 2 || (partes.length === 2 && partes[1].length === 3 && partes[0].length >= 1 && partes[0].length <= 3 && partes[0] !== "0");
    s = esMiles ? partes.join("") : partes.join(".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return negativo ? -n : n;
}

/** "sí", "si", "s", "x", "1", "true", "exento"… son verdadero; "no", "0", "false" son falso. */
export function parsearBooleano(v: Celda): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (vacio(v)) return undefined;
  const s = String(v).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (["si", "s", "x", "1", "true", "yes", "y", "verdadero", "exento", "exenta"].includes(s)) return true;
  if (["no", "n", "0", "false", "falso"].includes(s)) return false;
  return undefined;
}

const UNIDADES_DECIMALES = new Set(["kg", "kilo", "kilos", "kilogramo", "g", "gr", "gramo", "gramos", "l", "lt", "lts", "litro", "litros", "ml", "m", "mt", "mts", "metro", "metros", "cm", "lb", "libra", "libras"]);
const normalizar = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const CATEGORIA_POR_DEFECTO = "Sin categoría";
const MAX_FILAS = 10000;

/** Entiende y valida cada fila y la compara con el catálogo actual. No modifica nada. */
export async function analizarFilas(filas: FilaEntrada[], op: OpcionesImportacion): Promise<{ analisis: Analisis[]; sinTasa: boolean }> {
  if (filas.length > MAX_FILAS) throw Object.assign(new Error(`El archivo tiene demasiadas filas (máximo ${MAX_FILAS}). Divídelo en partes.`), { status: 400 });

  const tasa = tasaCruzada(op.moneda, op.principal, op.tasas);
  if (tasa === null) return { analisis: [], sinTasa: true };
  const aPrincipal = (n: number) => r2(n / tasa);

  const existentes = await prisma.servicio.findMany({
    select: { id: true, nombreServicio: true, sku: true, codigoBarras: true, precioBase: true, costoBase: true, stockActual: true, stockMinimo: true, controlaStock: true, exentoImpuesto: true, unidadMedida: true, descripcion: true, categoria: { select: { nombre: true } } },
  });
  const porSku = new Map(existentes.filter((e) => e.sku).map((e) => [e.sku!.toLowerCase(), e]));
  const porBarras = new Map(existentes.filter((e) => e.codigoBarras).map((e) => [e.codigoBarras!.toLowerCase(), e]));
  const porNombre = new Map<string, typeof existentes>();
  for (const e of existentes) {
    const k = normalizar(e.nombreServicio);
    porNombre.set(k, [...(porNombre.get(k) ?? []), e]);
  }

  // Lo que ya usan las filas nuevas del archivo, para detectar códigos repetidos dentro del mismo archivo.
  const skuEnArchivo = new Map<string, number>();
  const barrasEnArchivo = new Map<string, number>();
  const idsActualizados = new Map<number, number>();

  const analisis: Analisis[] = [];

  for (const f of filas) {
    const errores: string[] = [];
    const avisos: string[] = [];
    const datos: DatosProducto = {};

    const celdas = [f.nombre, f.sku, f.codigoBarras, f.precio, f.costo, f.stock, f.stockMinimo, f.categoria, f.unidad, f.exento, f.descripcion];
    if (celdas.every(vacio)) continue; // fila en blanco: se ignora sin ruido

    datos.nombre = texto(f.nombre);
    datos.descripcion = texto(f.descripcion);
    datos.sku = texto(f.sku);
    datos.codigoBarras = texto(f.codigoBarras);
    datos.categoria = texto(f.categoria);
    datos.unidad = texto(f.unidad);

    const numero = (v: Celda, etiqueta: string, permitirNegativo = false): number | undefined => {
      const n = parsearNumero(v);
      if (n === undefined) return undefined;
      if (Number.isNaN(n)) {
        errores.push(`${etiqueta} no es un número válido ("${String(v)}").`);
        return undefined;
      }
      if (n < 0 && !permitirNegativo) {
        errores.push(`${etiqueta} no puede ser negativo.`);
        return undefined;
      }
      return n;
    };

    const precio = numero(f.precio, "El precio");
    const costo = numero(f.costo, "El costo");
    const stock = numero(f.stock, "Las existencias");
    const stockMinimo = numero(f.stockMinimo, "El mínimo");
    if (precio !== undefined) datos.precio = aPrincipal(precio);
    if (costo !== undefined) datos.costo = aPrincipal(costo);
    if (stock !== undefined) datos.stock = stock;
    if (stockMinimo !== undefined) datos.stockMinimo = stockMinimo;

    if (!vacio(f.exento)) {
      const b = parsearBooleano(f.exento);
      if (b === undefined) avisos.push(`«Exento» no se entendió ("${String(f.exento)}"); se dejó como estaba.`);
      else datos.exento = b;
    }
    if (datos.unidad) datos.permiteDecimales = UNIDADES_DECIMALES.has(normalizar(datos.unidad));
    // Existencias como 12,5 sin unidad: se entiende que se vende por fracciones.
    if (datos.permiteDecimales === undefined && datos.stock !== undefined && !Number.isInteger(datos.stock)) {
      datos.permiteDecimales = true;
      avisos.push("Tiene existencias con decimales: se podrá vender por fracciones.");
    }
    if (datos.nombre && datos.nombre.length > 120) {
      avisos.push("El nombre pasa de 120 caracteres y se recortó.");
      datos.nombre = datos.nombre.slice(0, 120);
    }

    // ¿Es un producto que ya existe?
    let coincide: { e: (typeof existentes)[number]; por: "código" | "código de barras" | "nombre" } | undefined;
    const porCodigo = datos.sku ? porSku.get(datos.sku.toLowerCase()) : undefined;
    const porBarra = datos.codigoBarras ? porBarras.get(datos.codigoBarras.toLowerCase()) : undefined;
    if (porCodigo && porBarra && porCodigo.id !== porBarra.id) {
      errores.push(`El código «${datos.sku}» es de «${porCodigo.nombreServicio}» y el código de barras es de «${porBarra.nombreServicio}»: no se sabe cuál actualizar.`);
    } else if (porCodigo) coincide = { e: porCodigo, por: "código" };
    else if (porBarra) coincide = { e: porBarra, por: "código de barras" };
    else if (!datos.sku && !datos.codigoBarras && datos.nombre) {
      const iguales = porNombre.get(normalizar(datos.nombre)) ?? [];
      if (iguales.length === 1) coincide = { e: iguales[0], por: "nombre" };
      else if (iguales.length > 1) errores.push(`Hay ${iguales.length} productos llamados «${datos.nombre}»: agrega el código para saber cuál es.`);
    }

    let accion: AccionFila = coincide ? "ACTUALIZAR" : "CREAR";
    let cambios: string[] | undefined;

    if (coincide) {
      const e = coincide.e;
      const previa = idsActualizados.get(e.id);
      if (previa !== undefined) errores.push(`Este producto ya aparece en la fila ${previa}.`);
      else idsActualizados.set(e.id, f.fila);

      cambios = [];
      if (datos.nombre && datos.nombre !== e.nombreServicio) cambios.push(`nombre → ${datos.nombre}`);
      if (datos.precio !== undefined && Math.abs(datos.precio - e.precioBase) > 0.004) cambios.push(`precio ${e.precioBase} → ${datos.precio}`);
      if (datos.costo !== undefined && Math.abs(datos.costo - (e.costoBase ?? -1)) > 0.004) cambios.push(`costo ${e.costoBase ?? "—"} → ${datos.costo}`);
      if (datos.stock !== undefined && op.moduloInventario && Math.abs(datos.stock - e.stockActual) > 1e-9) cambios.push(`existencias ${e.stockActual} → ${datos.stock}`);
      if (datos.stockMinimo !== undefined && datos.stockMinimo !== e.stockMinimo) cambios.push(`mínimo ${e.stockMinimo ?? "—"} → ${datos.stockMinimo}`);
      if (datos.categoria && datos.categoria !== e.categoria.nombre) cambios.push(`categoría → ${datos.categoria}`);
      if (datos.exento !== undefined && datos.exento !== e.exentoImpuesto) cambios.push(datos.exento ? "pasa a exento" : "deja de ser exento");
      if (datos.sku && datos.sku.toLowerCase() !== (e.sku ?? "").toLowerCase()) cambios.push(`código → ${datos.sku}`);
      if (datos.codigoBarras && datos.codigoBarras.toLowerCase() !== (e.codigoBarras ?? "").toLowerCase()) cambios.push(`código de barras → ${datos.codigoBarras}`);
      if (datos.unidad && datos.unidad !== e.unidadMedida) cambios.push(`unidad → ${datos.unidad}`);
      if (datos.descripcion && datos.descripcion !== e.descripcion) cambios.push("descripción");
      if (cambios.length === 0) avisos.push("Sin cambios: ya estaba igual.");
    } else {
      if (!datos.nombre) errores.push("Falta el nombre del producto.");
      if (datos.precio === undefined && !errores.some((x) => x.startsWith("El precio"))) errores.push("Falta el precio.");
      for (const [valor, mapa, etiqueta] of [
        [datos.sku, skuEnArchivo, "código"],
        [datos.codigoBarras, barrasEnArchivo, "código de barras"],
      ] as const) {
        if (!valor) continue;
        const otra = mapa.get(valor.toLowerCase());
        if (otra !== undefined) errores.push(`El ${etiqueta} «${valor}» ya aparece en la fila ${otra}.`);
      }
      if (datos.sku && porBarras.has(datos.sku.toLowerCase())) errores.push(`El código «${datos.sku}» ya es el código de barras de otro producto.`);
    }

    if (datos.stock !== undefined && !op.moduloInventario) avisos.push("El inventario está apagado: no se cargan las existencias (actívalo en Configuración).");

    if (errores.length > 0) accion = "ERROR";
    else if (!coincide) {
      if (datos.sku) skuEnArchivo.set(datos.sku.toLowerCase(), f.fila);
      if (datos.codigoBarras) barrasEnArchivo.set(datos.codigoBarras.toLowerCase(), f.fila);
    }

    analisis.push({
      fila: {
        fila: f.fila,
        accion,
        nombre: datos.nombre ?? coincide?.e.nombreServicio ?? "(sin nombre)",
        errores,
        avisos,
        ...(coincide ? { coincide: { id: coincide.e.id, nombre: coincide.e.nombreServicio, por: coincide.por }, cambios } : {}),
      },
      datos,
      existenteId: coincide?.e.id,
    });
  }
  return { analisis, sinTasa: false };
}

export interface ResultadoImportacion {
  resumen: { total: number; crear: number; actualizar: number; sinCambios: number; errores: number };
  filas: FilaAnalizada[];
  aplicado: boolean;
}

function resumir(analisis: Analisis[]): ResultadoImportacion["resumen"] {
  const a = analisis.map((x) => x.fila);
  const actualizar = a.filter((f) => f.accion === "ACTUALIZAR" && (f.cambios?.length ?? 0) > 0).length;
  return {
    total: a.length,
    crear: a.filter((f) => f.accion === "CREAR").length,
    actualizar,
    sinCambios: a.filter((f) => f.accion === "ACTUALIZAR").length - actualizar,
    errores: a.filter((f) => f.accion === "ERROR").length,
  };
}

/** Vista previa: qué se crearía y actualizaría, y qué filas tienen problemas. */
export async function simularImportacion(filas: FilaEntrada[], op: OpcionesImportacion): Promise<ResultadoImportacion | { sinTasa: true }> {
  const { analisis, sinTasa } = await analizarFilas(filas, op);
  if (sinTasa) return { sinTasa: true };
  return { resumen: resumir(analisis), filas: analisis.map((a) => a.fila), aplicado: false };
}

/** Aplica las filas correctas en una sola operación; las filas con error se omiten. */
export async function aplicarImportacion(filas: FilaEntrada[], op: OpcionesImportacion, userId: number | null): Promise<ResultadoImportacion | { sinTasa: true }> {
  const { analisis, sinTasa } = await analizarFilas(filas, op);
  if (sinTasa) return { sinTasa: true };

  await prisma.$transaction(
    async (tx) => {
      const categorias = new Map((await tx.categoria.findMany()).map((c) => [normalizar(c.nombre), c.id]));
      const categoriaId = async (nombre: string | undefined) => {
        const n = nombre || CATEGORIA_POR_DEFECTO;
        const k = normalizar(n);
        const existente = categorias.get(k);
        if (existente) return existente;
        const creada = await tx.categoria.create({ data: { nombre: n.slice(0, 60) } });
        categorias.set(k, creada.id);
        return creada.id;
      };

      for (const { fila, datos, existenteId } of analisis) {
        if (fila.accion === "ERROR") continue;

        if (fila.accion === "CREAR") {
          const conStock = op.moduloInventario && datos.stock !== undefined;
          const creado = await tx.servicio.create({
            data: {
              nombreServicio: datos.nombre!,
              descripcion: datos.descripcion ?? null,
              precioBase: datos.precio!,
              costoBase: datos.costo ?? null,
              categoriaId: await categoriaId(datos.categoria),
              tipo: datos.sku || datos.codigoBarras || datos.stock !== undefined || datos.costo !== undefined ? "PRODUCTO" : "SERVICIO",
              unidadMedida: datos.unidad ?? "unidad",
              permiteDecimales: datos.permiteDecimales ?? false,
              controlaStock: conStock,
              stockActual: conStock ? datos.stock! : 0,
              stockMinimo: datos.stockMinimo ?? null,
              sku: datos.sku ?? null,
              codigoBarras: datos.codigoBarras ?? null,
              exentoImpuesto: datos.exento ?? false,
            },
          });
          if (conStock && datos.stock! > 0) {
            await tx.inventarioMovimiento.create({
              data: { servicioId: creado.id, tipo: "ENTRADA", cantidad: datos.stock!, motivo: "AJUSTE_MANUAL", stockResultante: datos.stock!, userId, nota: "Carga inicial desde archivo" },
            });
          }
          continue;
        }

        // ACTUALIZAR: solo se tocan los datos que el archivo trae.
        if (!fila.cambios || fila.cambios.length === 0) continue;
        const actual = await tx.servicio.findUniqueOrThrow({ where: { id: existenteId! } });
        const data: Prisma.ServicioUncheckedUpdateInput = {};
        if (datos.nombre) data.nombreServicio = datos.nombre;
        if (datos.descripcion) data.descripcion = datos.descripcion;
        if (datos.precio !== undefined) data.precioBase = datos.precio;
        if (datos.costo !== undefined) data.costoBase = datos.costo;
        if (datos.stockMinimo !== undefined) data.stockMinimo = datos.stockMinimo;
        if (datos.sku && datos.sku.toLowerCase() !== (actual.sku ?? "").toLowerCase()) data.sku = datos.sku;
        if (datos.codigoBarras && datos.codigoBarras.toLowerCase() !== (actual.codigoBarras ?? "").toLowerCase()) data.codigoBarras = datos.codigoBarras;
        if (datos.unidad) {
          data.unidadMedida = datos.unidad;
          data.permiteDecimales = datos.permiteDecimales ?? false;
        } else if (datos.permiteDecimales) data.permiteDecimales = true;
        if (datos.exento !== undefined) data.exentoImpuesto = datos.exento;
        if (datos.categoria) data.categoriaId = await categoriaId(datos.categoria);

        let movimiento: { tipo: "ENTRADA" | "SALIDA"; cantidad: number } | null = null;
        if (op.moduloInventario && datos.stock !== undefined && Math.abs(datos.stock - actual.stockActual) > 1e-9) {
          data.controlaStock = true;
          data.stockActual = datos.stock;
          const diferencia = datos.stock - actual.stockActual;
          movimiento = { tipo: diferencia > 0 ? "ENTRADA" : "SALIDA", cantidad: Math.abs(diferencia) };
        }
        await tx.servicio.update({ where: { id: existenteId! }, data });
        if (movimiento) {
          await tx.inventarioMovimiento.create({
            data: { servicioId: existenteId!, ...movimiento, motivo: "AJUSTE_MANUAL", stockResultante: datos.stock!, userId, nota: "Ajuste desde archivo" },
          });
        }
      }
    },
    { timeout: 120_000, maxWait: 20_000 }
  );

  return { resumen: resumir(analisis), filas: analisis.map((a) => a.fila), aplicado: true };
}
