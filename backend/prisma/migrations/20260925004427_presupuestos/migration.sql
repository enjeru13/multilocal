-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validoHasta" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "condiciones" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "descuento" REAL NOT NULL DEFAULT 0,
    "descuentoTipo" TEXT,
    "descuentoValor" REAL,
    "impuesto" REAL NOT NULL DEFAULT 0,
    "impuestoTasa" REAL,
    "total" REAL NOT NULL DEFAULT 0,
    "ordenId" INTEGER,
    "userId" INTEGER,
    "userName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Presupuesto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Presupuesto_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PresupuestoDetalle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "presupuestoId" INTEGER NOT NULL,
    "servicioId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioUnit" REAL NOT NULL,
    "exento" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" REAL NOT NULL,
    "descuento" REAL NOT NULL DEFAULT 0,
    "impuesto" REAL NOT NULL DEFAULT 0,
    "base" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "PresupuestoDetalle_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresupuestoDetalle_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nombreNegocio" TEXT,
    "monedaPrincipal" TEXT NOT NULL DEFAULT 'USD',
    "monedasActivas" TEXT NOT NULL DEFAULT 'USD,VES,COP',
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
    "descuentoMaxPct" REAL NOT NULL DEFAULT 100,
    "moduloPresupuestos" BOOLEAN NOT NULL DEFAULT false,
    "presupuestoValidezDias" INTEGER NOT NULL DEFAULT 15,
    "presupuestoCondiciones" TEXT
);
INSERT INTO "new_Configuracion" ("clienteObligatorio", "deduccionStockEn", "descuentoMaxPct", "direccion", "id", "impuestoActivo", "impuestoNombre", "impuestoTasa", "mensajePieRecibo", "moduloCaja", "moduloClienteTipo", "moduloFechaEntrega", "moduloInventario", "moduloProveedores", "monedaPrincipal", "monedasActivas", "nombreNegocio", "preciosIncluyenImpuesto", "rif", "rubro", "tasaCOP", "tasaUSD", "tasaVES", "telefonoPrincipal", "telefonoSecundario", "terminologia") SELECT "clienteObligatorio", "deduccionStockEn", "descuentoMaxPct", "direccion", "id", "impuestoActivo", "impuestoNombre", "impuestoTasa", "mensajePieRecibo", "moduloCaja", "moduloClienteTipo", "moduloFechaEntrega", "moduloInventario", "moduloProveedores", "monedaPrincipal", "monedasActivas", "nombreNegocio", "preciosIncluyenImpuesto", "rif", "rubro", "tasaCOP", "tasaUSD", "tasaVES", "telefonoPrincipal", "telefonoSecundario", "terminologia" FROM "Configuracion";
DROP TABLE "Configuracion";
ALTER TABLE "new_Configuracion" RENAME TO "Configuracion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Presupuesto_ordenId_key" ON "Presupuesto"("ordenId");

-- CreateIndex
CREATE INDEX "Presupuesto_clienteId_idx" ON "Presupuesto"("clienteId");

-- CreateIndex
CREATE INDEX "Presupuesto_estado_idx" ON "Presupuesto"("estado");

-- CreateIndex
CREATE INDEX "Presupuesto_fecha_idx" ON "Presupuesto"("fecha");

-- CreateIndex
CREATE INDEX "PresupuestoDetalle_presupuestoId_idx" ON "PresupuestoDetalle"("presupuestoId");

-- CreateIndex
CREATE INDEX "PresupuestoDetalle_servicioId_idx" ON "PresupuestoDetalle"("servicioId");
