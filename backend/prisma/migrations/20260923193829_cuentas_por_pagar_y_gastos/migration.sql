-- CreateTable
CREATE TABLE "PagoCompra" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "compraId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" REAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "montoMoneda" REAL NOT NULL,
    "tasa" REAL NOT NULL DEFAULT 1,
    "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "nota" TEXT,
    "userId" INTEGER,
    "cajaMovimientoId" INTEGER,
    CONSTRAINT "PagoCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "montoMoneda" REAL NOT NULL,
    "tasa" REAL NOT NULL DEFAULT 1,
    "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "proveedorId" INTEGER,
    "nota" TEXT,
    "userId" INTEGER,
    "cajaMovimientoId" INTEGER
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Compra" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proveedorId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "total" REAL NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "montoPagado" REAL NOT NULL DEFAULT 0,
    "fechaVencimiento" DATETIME,
    CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Compra" ("estado", "fecha", "id", "observaciones", "proveedorId", "total") SELECT "estado", "fecha", "id", "observaciones", "proveedorId", "total" FROM "Compra";
DROP TABLE "Compra";
ALTER TABLE "new_Compra" RENAME TO "Compra";
CREATE INDEX "Compra_proveedorId_idx" ON "Compra"("proveedorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PagoCompra_compraId_idx" ON "PagoCompra"("compraId");

-- CreateIndex
CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");

-- CreateIndex
CREATE INDEX "Gasto_categoria_idx" ON "Gasto"("categoria");

-- Compras existentes: se consideran pagadas por completo (antes no se registraba el pago).
UPDATE "Compra" SET "montoPagado" = "total" WHERE "estado" <> 'CANCELADA';
