-- CreateTable
CREATE TABLE "Devolucion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordenId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "motivo" TEXT,
    "total" REAL NOT NULL,
    "reembolso" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Devolucion_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DevolucionDetalle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "devolucionId" INTEGER NOT NULL,
    "detalleOrdenId" INTEGER NOT NULL,
    "servicioId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "monto" REAL NOT NULL,
    CONSTRAINT "DevolucionDetalle_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "Devolucion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DevolucionDetalle_detalleOrdenId_fkey" FOREIGN KEY ("detalleOrdenId") REFERENCES "DetalleOrden" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nombreNegocio" TEXT,
    "monedaPrincipal" TEXT NOT NULL DEFAULT 'USD',
    "tasaUSD" REAL,
    "tasaVES" REAL,
    "tasaCOP" REAL,
    "rif" TEXT,
    "direccion" TEXT,
    "telefonoPrincipal" TEXT,
    "telefonoSecundario" TEXT,
    "mensajePieRecibo" TEXT,
    "rubro" TEXT NOT NULL DEFAULT 'GENERICO',
    "moduloInventario" BOOLEAN NOT NULL DEFAULT false,
    "moduloProveedores" BOOLEAN NOT NULL DEFAULT false,
    "moduloCaja" BOOLEAN NOT NULL DEFAULT false,
    "moduloFechaEntrega" BOOLEAN NOT NULL DEFAULT true,
    "moduloClienteTipo" BOOLEAN NOT NULL DEFAULT true,
    "clienteObligatorio" BOOLEAN NOT NULL DEFAULT true,
    "deduccionStockEn" TEXT NOT NULL DEFAULT 'ENTREGA',
    "terminologia" TEXT,
    "impuestoActivo" BOOLEAN NOT NULL DEFAULT false,
    "impuestoNombre" TEXT NOT NULL DEFAULT 'IVA',
    "impuestoTasa" REAL NOT NULL DEFAULT 16,
    "preciosIncluyenImpuesto" BOOLEAN NOT NULL DEFAULT true,
    "descuentoMaxPct" REAL NOT NULL DEFAULT 100
);
INSERT INTO "new_Configuracion" ("clienteObligatorio", "deduccionStockEn", "direccion", "id", "mensajePieRecibo", "moduloCaja", "moduloClienteTipo", "moduloFechaEntrega", "moduloInventario", "moduloProveedores", "monedaPrincipal", "nombreNegocio", "rif", "rubro", "tasaCOP", "tasaUSD", "tasaVES", "telefonoPrincipal", "telefonoSecundario", "terminologia") SELECT "clienteObligatorio", "deduccionStockEn", "direccion", "id", "mensajePieRecibo", "moduloCaja", "moduloClienteTipo", "moduloFechaEntrega", "moduloInventario", "moduloProveedores", "monedaPrincipal", "nombreNegocio", "rif", "rubro", "tasaCOP", "tasaUSD", "tasaVES", "telefonoPrincipal", "telefonoSecundario", "terminologia" FROM "Configuracion";
DROP TABLE "Configuracion";
ALTER TABLE "new_Configuracion" RENAME TO "Configuracion";
CREATE TABLE "new_DetalleOrden" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordenId" INTEGER NOT NULL,
    "servicioId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioUnit" REAL NOT NULL,
    "costoUnit" REAL,
    "subtotal" REAL NOT NULL,
    "descuento" REAL NOT NULL DEFAULT 0,
    "impuesto" REAL NOT NULL DEFAULT 0,
    "base" REAL NOT NULL DEFAULT 0,
    "cantidadDevuelta" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "DetalleOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DetalleOrden_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DetalleOrden" ("cantidad", "costoUnit", "id", "ordenId", "precioUnit", "servicioId", "subtotal") SELECT "cantidad", "costoUnit", "id", "ordenId", "precioUnit", "servicioId", "subtotal" FROM "DetalleOrden";
DROP TABLE "DetalleOrden";
ALTER TABLE "new_DetalleOrden" RENAME TO "DetalleOrden";
CREATE INDEX "DetalleOrden_ordenId_fkey" ON "DetalleOrden"("ordenId");
CREATE INDEX "DetalleOrden_servicioId_fkey" ON "DetalleOrden"("servicioId");
CREATE TABLE "new_Orden" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER,
    "tipo" TEXT NOT NULL DEFAULT 'ORDEN_LAVANDERIA',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaIngreso" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntrega" DATETIME,
    "observaciones" TEXT,
    "total" REAL NOT NULL,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "descuento" REAL NOT NULL DEFAULT 0,
    "descuentoTipo" TEXT,
    "descuentoValor" REAL,
    "impuesto" REAL NOT NULL DEFAULT 0,
    "impuestoTasa" REAL,
    "devuelto" REAL NOT NULL DEFAULT 0,
    "abonado" REAL NOT NULL DEFAULT 0,
    "faltante" REAL NOT NULL DEFAULT 0,
    "estadoPago" TEXT NOT NULL DEFAULT 'INCOMPLETO',
    "deliveredByUserId" INTEGER,
    "deliveredByUserName" TEXT,
    "cajaSesionId" INTEGER,
    CONSTRAINT "Orden_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Orden_deliveredByUserId_fkey" FOREIGN KEY ("deliveredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Orden_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "CajaSesion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Orden" ("abonado", "cajaSesionId", "clienteId", "deliveredByUserId", "deliveredByUserName", "estado", "estadoPago", "faltante", "fechaEntrega", "fechaIngreso", "id", "observaciones", "tipo", "total") SELECT "abonado", "cajaSesionId", "clienteId", "deliveredByUserId", "deliveredByUserName", "estado", "estadoPago", "faltante", "fechaEntrega", "fechaIngreso", "id", "observaciones", "tipo", "total" FROM "Orden";
DROP TABLE "Orden";
ALTER TABLE "new_Orden" RENAME TO "Orden";
CREATE INDEX "Orden_clienteId_idx" ON "Orden"("clienteId");
CREATE INDEX "Orden_estado_idx" ON "Orden"("estado");
CREATE INDEX "Orden_deliveredByUserId_idx" ON "Orden"("deliveredByUserId");
CREATE INDEX "Orden_cajaSesionId_idx" ON "Orden"("cajaSesionId");
CREATE TABLE "new_Servicio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombreServicio" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioBase" REAL NOT NULL,
    "permiteDecimales" BOOLEAN NOT NULL DEFAULT false,
    "categoriaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'SERVICIO',
    "unidadMedida" TEXT NOT NULL DEFAULT 'unidad',
    "controlaStock" BOOLEAN NOT NULL DEFAULT false,
    "sku" TEXT,
    "codigoBarras" TEXT,
    "costoBase" REAL,
    "stockActual" REAL NOT NULL DEFAULT 0,
    "stockMinimo" REAL,
    "exentoImpuesto" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Servicio_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Servicio" ("categoriaId", "codigoBarras", "controlaStock", "costoBase", "descripcion", "id", "nombreServicio", "permiteDecimales", "precioBase", "sku", "stockActual", "stockMinimo", "tipo", "unidadMedida") SELECT "categoriaId", "codigoBarras", "controlaStock", "costoBase", "descripcion", "id", "nombreServicio", "permiteDecimales", "precioBase", "sku", "stockActual", "stockMinimo", "tipo", "unidadMedida" FROM "Servicio";
DROP TABLE "Servicio";
ALTER TABLE "new_Servicio" RENAME TO "Servicio";
CREATE UNIQUE INDEX "Servicio_sku_key" ON "Servicio"("sku");
CREATE UNIQUE INDEX "Servicio_codigoBarras_key" ON "Servicio"("codigoBarras");
CREATE INDEX "Servicio_categoriaId_fkey" ON "Servicio"("categoriaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Devolucion_ordenId_idx" ON "Devolucion"("ordenId");

-- CreateIndex
CREATE INDEX "DevolucionDetalle_devolucionId_idx" ON "DevolucionDetalle"("devolucionId");

-- CreateIndex
CREATE INDEX "DevolucionDetalle_detalleOrdenId_idx" ON "DevolucionDetalle"("detalleOrdenId");

-- Datos existentes: sin descuento ni impuesto; el subtotal/base equivalen al total.
UPDATE "Orden" SET "subtotal" = "total";
UPDATE "DetalleOrden" SET "base" = "subtotal";
