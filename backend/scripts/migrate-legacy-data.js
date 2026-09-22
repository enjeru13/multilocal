/**
 * Migra los datos reales de la lavandería (backup SQLite del Electron perdido)
 * hacia el nuevo schema genérico. Preserva IDs 1:1 (las tablas no cambiaron de
 * nombre, solo se agregaron columnas/tablas nuevas con defaults seguros).
 *
 * Uso: node scripts/migrate-legacy-data.js <ruta-al-backup.db>
 */
const { DatabaseSync } = require("node:sqlite");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

const legacyPath = process.argv[2];
if (!legacyPath) {
  console.error("Uso: node scripts/migrate-legacy-data.js <ruta-al-backup.db>");
  process.exit(1);
}

const legacy = new DatabaseSync(path.resolve(legacyPath), { readOnly: true });
const prisma = new PrismaClient();

function allRows(sql) {
  return legacy.prepare(sql).all();
}

async function fixSequence(table) {
  await prisma.$executeRawUnsafe(
    `UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM "${table}") WHERE name = '${table}'`
  );
}

async function main() {
  console.log("Leyendo backup legado:", path.resolve(legacyPath));

  const categorias = allRows("SELECT * FROM Categoria");
  const clientes = allRows("SELECT * FROM Cliente");
  const servicios = allRows("SELECT * FROM Servicio");
  const ordenes = allRows("SELECT * FROM Orden");
  const detalles = allRows("SELECT * FROM DetalleOrden");
  const pagos = allRows("SELECT * FROM Pago");
  const vueltos = allRows("SELECT * FROM VueltoEntregado");
  const users = allRows("SELECT * FROM User");
  const configuraciones = allRows("SELECT * FROM Configuracion");

  console.log(
    `Encontrado: ${categorias.length} categorías, ${clientes.length} clientes, ${servicios.length} servicios, ${ordenes.length} órdenes, ${detalles.length} detalles, ${pagos.length} pagos, ${vueltos.length} vueltos, ${users.length} usuarios, ${configuraciones.length} configuración(es).`
  );

  await prisma.$transaction(
    async (tx) => {
      // --- Users (preservar hash de password tal cual) ---
      if (users.length > 0) {
        await tx.user.createMany({
          data: users.map((u) => ({
            id: u.id,
            email: u.email,
            password: u.password,
            name: u.name,
            role: u.role,
            createdAt: new Date(u.createdAt),
            updatedAt: new Date(u.updatedAt),
          })),
        });
      }

      // --- Categorias ---
      if (categorias.length > 0) {
        await tx.categoria.createMany({
          data: categorias.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          })),
        });
      }

      // --- Clientes ---
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
            fechaRegistro: new Date(c.fechaRegistro),
          })),
        });
      }

      // --- Servicios (tipo=SERVICIO, sin control de stock: comportamiento idéntico al legado) ---
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

      // --- Ordenes (tipo=ORDEN_LAVANDERIA: preserva flujo de entrega actual) ---
      if (ordenes.length > 0) {
        await tx.orden.createMany({
          data: ordenes.map((o) => ({
            id: o.id,
            clienteId: o.clienteId,
            tipo: "ORDEN_LAVANDERIA",
            estado: o.estado,
            fechaIngreso: new Date(o.fechaIngreso),
            fechaEntrega: o.fechaEntrega ? new Date(o.fechaEntrega) : null,
            observaciones: o.observaciones,
            total: o.total,
            abonado: o.abonado,
            faltante: o.faltante,
            estadoPago: o.estadoPago,
            deliveredByUserId: o.deliveredByUserId,
            deliveredByUserName: o.deliveredByUserName,
          })),
        });
      }

      // --- Detalles de orden ---
      if (detalles.length > 0) {
        await tx.detalleOrden.createMany({
          data: detalles.map((d) => ({
            id: d.id,
            ordenId: d.ordenId,
            servicioId: d.servicioId,
            cantidad: d.cantidad,
            precioUnit: d.precioUnit,
            subtotal: d.subtotal,
          })),
        });
      }

      // --- Pagos ---
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
            fechaPago: new Date(p.fechaPago),
          })),
        });
      }

      // --- Vueltos ---
      if (vueltos.length > 0) {
        await tx.vueltoEntregado.createMany({
          data: vueltos.map((v) => ({
            id: v.id,
            pagoId: v.pagoId,
            monto: v.monto,
            moneda: v.moneda,
          })),
        });
      }

      // --- Configuracion -> perfil de negocio (rubro LAVANDERIA, módulos apagados = comportamiento idéntico al legado) ---
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
    { timeout: 60000 }
  );

  // Corregir los contadores autoincrement para que las próximas filas nuevas
  // no colisionen con los IDs migrados.
  for (const table of ["User", "Cliente", "Servicio", "Orden", "DetalleOrden", "Pago", "VueltoEntregado"]) {
    await fixSequence(table);
  }

  console.log("Migración completada.");
}

main()
  .catch((err) => {
    console.error("Error en la migración:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    legacy.close();
    await prisma.$disconnect();
  });
