import path from "path";
import { DatabaseSync } from "node:sqlite";
import type { PrismaClient } from "@prisma/client";

/**
 * «Empezar de cero»: trae solo clientes, servicios y categorías de un respaldo de Mostrador
 * (de este mismo sistema, no del anterior) y borra todo lo demás — órdenes, pagos, caja,
 * gastos, compras, proveedores, presupuestos, conteos. Mantiene los usuarios (login) y la
 * configuración del negocio tal como están ahora: no los toca ni los pisa con los del archivo.
 */

export interface ResumenEmpezarDeCero {
  categorias: number;
  clientes: number;
  servicios: number;
}

export class ArchivoNoValido extends Error {}

type Fila = Record<string, any>;

function abrir(ruta: string) {
  try {
    return new DatabaseSync(path.resolve(ruta), { readOnly: true });
  } catch {
    throw new ArchivoNoValido("No se pudo abrir el archivo: no es una base de datos válida.");
  }
}

// Gasto y CajaSesion solo existen en el esquema de Mostrador (el sistema anterior no las tiene).
const REQUERIDAS = ["Cliente", "Servicio", "Categoria", "CajaSesion", "Gasto"];

function comprobar(db: DatabaseSync) {
  let tablas: string[];
  try {
    tablas = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Fila[]).map((t) => t.name);
  } catch {
    throw new ArchivoNoValido("El archivo no es una base de datos SQLite.");
  }
  const faltan = REQUERIDAS.filter((t) => !tablas.includes(t));
  if (faltan.length > 0) {
    throw new ArchivoNoValido(`No parece un respaldo de Mostrador (faltan: ${faltan.join(", ")}). Para el sistema anterior usa «Importar del sistema anterior».`);
  }
}

const todas = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Fila[];
const fecha = (v: unknown) => new Date(v as string | number);

/** Cuenta lo que trae el archivo, sin tocar nada. */
export function revisarParaEmpezarDeCero(ruta: string): ResumenEmpezarDeCero {
  const db = abrir(ruta);
  try {
    comprobar(db);
    const cuenta = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as Fila).n as number;
    return { categorias: cuenta("Categoria"), clientes: cuenta("Cliente"), servicios: cuenta("Servicio") };
  } finally {
    db.close();
  }
}

export async function empezarDeCero(ruta: string, prisma: PrismaClient): Promise<ResumenEmpezarDeCero> {
  const resumen = revisarParaEmpezarDeCero(ruta);
  const db = abrir(ruta);
  try {
    const categorias = todas(db, "SELECT * FROM Categoria");
    const clientes = todas(db, "SELECT * FROM Cliente");
    const servicios = todas(db, "SELECT * FROM Servicio");

    await prisma.$transaction(
      async (tx) => {
        // Se vacía en orden de dependencias (hijos primero). Usuarios y Configuracion no se tocan.
        await tx.conteoDetalle.deleteMany();
        await tx.conteoInventario.deleteMany();
        await tx.presupuestoDetalle.deleteMany();
        await tx.presupuesto.deleteMany();
        await tx.devolucionDetalle.deleteMany();
        await tx.devolucion.deleteMany();
        await tx.pagoCompra.deleteMany();
        await tx.gasto.deleteMany();
        await tx.inventarioMovimiento.deleteMany();
        await tx.compraDetalle.deleteMany();
        await tx.compra.deleteMany();
        await tx.proveedor.deleteMany();
        await tx.vueltoEntregado.deleteMany();
        await tx.pago.deleteMany();
        await tx.detalleOrden.deleteMany();
        await tx.orden.deleteMany();
        await tx.cajaMovimiento.deleteMany();
        await tx.cajaSesion.deleteMany();
        await tx.servicio.deleteMany();
        await tx.categoria.deleteMany();
        await tx.cliente.deleteMany();

        if (categorias.length > 0) {
          await tx.categoria.createMany({
            data: categorias.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              createdAt: c.createdAt ? fecha(c.createdAt) : new Date(),
              updatedAt: c.updatedAt ? fecha(c.updatedAt) : new Date(),
            })),
          });
        }
        if (clientes.length > 0) {
          await tx.cliente.createMany({
            data: clientes.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              apellido: c.apellido ?? null,
              tipo: c.tipo ?? null,
              telefono: c.telefono ?? null,
              telefono_secundario: c.telefono_secundario ?? null,
              direccion: c.direccion ?? null,
              identificacion: c.identificacion ?? null,
              email: c.email ?? null,
              fechaRegistro: c.fechaRegistro ? fecha(c.fechaRegistro) : new Date(),
            })),
          });
        }
        if (servicios.length > 0) {
          await tx.servicio.createMany({
            data: servicios.map((s) => ({
              id: s.id,
              nombreServicio: s.nombreServicio,
              descripcion: s.descripcion ?? null,
              precioBase: s.precioBase,
              permiteDecimales: !!s.permiteDecimales,
              categoriaId: s.categoriaId,
              tipo: s.tipo ?? "SERVICIO",
              unidadMedida: s.unidadMedida ?? "unidad",
              controlaStock: !!s.controlaStock,
              sku: s.sku ?? null,
              codigoBarras: s.codigoBarras ?? null,
              costoBase: s.costoBase ?? null,
              stockActual: s.stockActual ?? 0,
              stockMinimo: s.stockMinimo ?? null,
              imagen: s.imagen ?? null,
              exentoImpuesto: !!s.exentoImpuesto,
            })),
          });
        }
      },
      { timeout: 120000 }
    );

    // Los contadores de autoincremento deben seguir después del último ID importado.
    for (const tabla of ["Cliente", "Servicio"]) {
      await prisma.$executeRawUnsafe(
        `UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM "${tabla}") WHERE name = '${tabla}'`
      );
    }
    return resumen;
  } finally {
    db.close();
  }
}
