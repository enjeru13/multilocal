import path from "path";
import { DatabaseSync } from "node:sqlite";
import type { PrismaClient } from "@prisma/client";

/**
 * Importa los datos del sistema anterior de la lavandería (la copia .db del Electron
 * original) al esquema actual. Conserva los IDs, así que las órdenes, pagos y clientes
 * quedan con los mismos números; los usuarios conservan su contraseña.
 */

export interface ResumenLegado {
  categorias: number;
  clientes: number;
  servicios: number;
  ordenes: number;
  detalles: number;
  pagos: number;
  vueltos: number;
  usuarios: number;
  negocio: string | null;
  /** Órdenes saldadas cuyo «abonado» venía mal guardado (mayor que el total): se corrigen al importar. */
  abonadosCorregidos: number;
}

// En el sistema anterior algunas órdenes saldadas quedaron con «abonado» en la moneda del pago (p. ej. 168000
// pesos en una orden de $42). El estado y el faltante sí eran correctos: solo se ajusta el abonado al total.
const abonadoIncoherente = (o: Fila) => Number(o.faltante) <= 0.005 && Number(o.abonado) > Number(o.total) + 0.01;

const TABLAS_LEGADO = ["Categoria", "Cliente", "Servicio", "Orden", "DetalleOrden", "Pago", "VueltoEntregado", "User", "Configuracion"];

export class ArchivoNoValido extends Error {}

type Fila = Record<string, any>;

function abrir(ruta: string) {
  try {
    return new DatabaseSync(path.resolve(ruta), { readOnly: true });
  } catch {
    throw new ArchivoNoValido("No se pudo abrir el archivo: no es una base de datos válida.");
  }
}

function comprobar(db: DatabaseSync) {
  let tablas: string[];
  try {
    tablas = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Fila[]).map((t) => t.name);
  } catch {
    throw new ArchivoNoValido("El archivo no es una base de datos SQLite.");
  }
  const faltan = TABLAS_LEGADO.filter((t) => !tablas.includes(t));
  if (faltan.length > 0) {
    throw new ArchivoNoValido(`No parece un respaldo del sistema anterior (faltan: ${faltan.join(", ")}).`);
  }
  if (tablas.includes("Gasto") || tablas.includes("CajaSesion")) {
    throw new ArchivoNoValido("Este respaldo ya es del sistema actual: usa «Restaurar» en la lista de respaldos.");
  }
}

const todas = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Fila[];

/** Cuenta lo que trae el archivo, sin tocar nada. */
export function revisarLegado(ruta: string): ResumenLegado {
  const db = abrir(ruta);
  try {
    comprobar(db);
    const cuenta = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as Fila).n as number;
    const cfg = todas(db, "SELECT nombreNegocio FROM Configuracion")[0];
    return {
      categorias: cuenta("Categoria"),
      clientes: cuenta("Cliente"),
      servicios: cuenta("Servicio"),
      ordenes: cuenta("Orden"),
      detalles: cuenta("DetalleOrden"),
      pagos: cuenta("Pago"),
      vueltos: cuenta("VueltoEntregado"),
      usuarios: cuenta("User"),
      negocio: cfg?.nombreNegocio ?? null,
      abonadosCorregidos: todas(db, "SELECT total, abonado, faltante FROM Orden").filter(abonadoIncoherente).length,
    };
  } finally {
    db.close();
  }
}

const fecha = (v: unknown) => new Date(v as string | number);

/**
 * Reemplaza TODO lo que hay en la base actual por los datos del archivo. Quien llama debe
 * haber hecho un respaldo antes: aquí no se conserva nada de lo anterior.
 */
export async function importarLegado(ruta: string, prisma: PrismaClient): Promise<ResumenLegado> {
  const resumen = revisarLegado(ruta);
  const db = abrir(ruta);
  try {
    const categorias = todas(db, "SELECT * FROM Categoria");
    const clientes = todas(db, "SELECT * FROM Cliente");
    const servicios = todas(db, "SELECT * FROM Servicio");
    const ordenes = todas(db, "SELECT * FROM Orden");
    const detalles = todas(db, "SELECT * FROM DetalleOrden");
    const pagos = todas(db, "SELECT * FROM Pago");
    const vueltos = todas(db, "SELECT * FROM VueltoEntregado");
    const users = todas(db, "SELECT * FROM User");
    const configuraciones = todas(db, "SELECT * FROM Configuracion");

    await prisma.$transaction(
      async (tx) => {
        // Se vacía en orden de dependencias (hijos primero).
        await tx.pagoCompra.deleteMany();
        await tx.gasto.deleteMany();
        await tx.inventarioMovimiento.deleteMany();
        await tx.compraDetalle.deleteMany();
        await tx.compra.deleteMany();
        await tx.proveedor.deleteMany();
        await tx.devolucionDetalle.deleteMany();
        await tx.devolucion.deleteMany();
        await tx.vueltoEntregado.deleteMany();
        await tx.pago.deleteMany();
        await tx.detalleOrden.deleteMany();
        await tx.orden.deleteMany();
        await tx.cajaMovimiento.deleteMany();
        await tx.cajaSesion.deleteMany();
        await tx.servicio.deleteMany();
        await tx.categoria.deleteMany();
        await tx.cliente.deleteMany();
        await tx.user.deleteMany();
        await tx.configuracion.deleteMany();

        if (users.length > 0) {
          await tx.user.createMany({
            data: users.map((u) => ({
              id: u.id,
              email: u.email,
              password: u.password,
              name: u.name,
              role: u.role,
              createdAt: fecha(u.createdAt),
              updatedAt: fecha(u.updatedAt),
            })),
          });
        }
        if (categorias.length > 0) {
          await tx.categoria.createMany({
            data: categorias.map((c) => ({ id: c.id, nombre: c.nombre, createdAt: fecha(c.createdAt), updatedAt: fecha(c.updatedAt) })),
          });
        }
        if (clientes.length > 0) {
          await tx.cliente.createMany({
            data: clientes.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              apellido: c.apellido,
              tipo: c.tipo,
              telefono: c.telefono,
              telefono_secundario: c.telefono_secundario,
              direccion: c.direccion,
              identificacion: c.identificacion,
              email: c.email,
              fechaRegistro: fecha(c.fechaRegistro),
            })),
          });
        }
        if (servicios.length > 0) {
          await tx.servicio.createMany({
            data: servicios.map((s) => ({
              id: s.id,
              nombreServicio: s.nombreServicio,
              descripcion: s.descripcion,
              precioBase: s.precioBase,
              permiteDecimales: !!s.permiteDecimales,
              categoriaId: s.categoriaId,
              tipo: "SERVICIO",
              unidadMedida: s.permiteDecimales ? "kg" : "unidad",
              controlaStock: false,
            })),
          });
        }
        if (ordenes.length > 0) {
          await tx.orden.createMany({
            data: ordenes.map((o) => ({
              id: o.id,
              clienteId: o.clienteId,
              tipo: "ORDEN_LAVANDERIA",
              estado: o.estado,
              fechaIngreso: fecha(o.fechaIngreso),
              fechaEntrega: o.fechaEntrega ? fecha(o.fechaEntrega) : null,
              observaciones: o.observaciones,
              total: o.total,
              // Las columnas de desglose son nuevas: sin descuento ni impuesto, el subtotal es el total.
              subtotal: o.total,
              abonado: abonadoIncoherente(o) ? o.total : o.abonado,
              faltante: o.faltante,
              estadoPago: o.estadoPago,
              deliveredByUserId: o.deliveredByUserId,
              deliveredByUserName: o.deliveredByUserName,
            })),
          });
        }
        if (detalles.length > 0) {
          await tx.detalleOrden.createMany({
            data: detalles.map((d) => ({
              id: d.id,
              ordenId: d.ordenId,
              servicioId: d.servicioId,
              cantidad: d.cantidad,
              precioUnit: d.precioUnit,
              subtotal: d.subtotal,
              // Sin descuento ni impuesto, lo que vale la línea (base) es su subtotal; los reportes de ganancia y el libro de ventas parten de ahí.
              base: d.subtotal,
            })),
          });
        }
        if (pagos.length > 0) {
          await tx.pago.createMany({
            data: pagos.map((p) => ({
              id: p.id,
              ordenId: p.ordenId,
              monto: p.monto,
              moneda: p.moneda,
              metodoPago: p.metodoPago,
              tasa: p.tasa ?? 0,
              nota: p.nota,
              fechaPago: fecha(p.fechaPago),
            })),
          });
        }
        if (vueltos.length > 0) {
          await tx.vueltoEntregado.createMany({
            data: vueltos.map((v) => ({ id: v.id, pagoId: v.pagoId, monto: v.monto, moneda: v.moneda })),
          });
        }
        if (configuraciones.length > 0) {
          const c = configuraciones[0];
          await tx.configuracion.create({
            data: {
              id: c.id,
              nombreNegocio: c.nombreNegocio,
              monedaPrincipal: c.monedaPrincipal,
              tasaUSD: c.tasaUSD,
              tasaVES: c.tasaVES,
              tasaCOP: c.tasaCOP,
              rif: c.rif,
              direccion: c.direccion,
              telefonoPrincipal: c.telefonoPrincipal,
              telefonoSecundario: c.telefonoSecundario,
              mensajePieRecibo: c.mensajePieRecibo,
              rubro: "LAVANDERIA",
              moduloInventario: false,
              moduloProveedores: false,
              moduloCaja: false,
              moduloFechaEntrega: true,
              moduloClienteTipo: true,
              clienteObligatorio: true,
              deduccionStockEn: "ENTREGA",
            },
          });
        }
      },
      { timeout: 120000 }
    );

    // Los contadores de autoincremento deben seguir después del último ID importado.
    for (const tabla of ["User", "Cliente", "Servicio", "Orden", "DetalleOrden", "Pago", "VueltoEntregado"]) {
      await prisma.$executeRawUnsafe(
        `UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM "${tabla}") WHERE name = '${tabla}'`
      );
    }
    return resumen;
  } finally {
    db.close();
  }
}
