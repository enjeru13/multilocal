-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Orden" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER,
    "tipo" TEXT NOT NULL DEFAULT 'ORDEN_LAVANDERIA',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaIngreso" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntrega" DATETIME,
    "entregadaEn" DATETIME,
    "observaciones" TEXT,
    "total" REAL NOT NULL,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "descuento" REAL NOT NULL DEFAULT 0,
    "descuentoTipo" TEXT,
    "descuentoValor" REAL,
    "impuesto" REAL NOT NULL DEFAULT 0,
    "impuestoTasa" REAL,
    "sinImpuesto" BOOLEAN NOT NULL DEFAULT false,
    "conImpuesto" BOOLEAN NOT NULL DEFAULT false,
    "tasaVES" REAL,
    "tasaCOP" REAL,
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
INSERT INTO "new_Orden" ("abonado", "cajaSesionId", "clienteId", "deliveredByUserId", "deliveredByUserName", "descuento", "descuentoTipo", "descuentoValor", "devuelto", "entregadaEn", "estado", "estadoPago", "faltante", "fechaEntrega", "fechaIngreso", "id", "impuesto", "impuestoTasa", "observaciones", "sinImpuesto", "subtotal", "tasaCOP", "tasaVES", "tipo", "total") SELECT "abonado", "cajaSesionId", "clienteId", "deliveredByUserId", "deliveredByUserName", "descuento", "descuentoTipo", "descuentoValor", "devuelto", "entregadaEn", "estado", "estadoPago", "faltante", "fechaEntrega", "fechaIngreso", "id", "impuesto", "impuestoTasa", "observaciones", "sinImpuesto", "subtotal", "tasaCOP", "tasaVES", "tipo", "total" FROM "Orden";
DROP TABLE "Orden";
ALTER TABLE "new_Orden" RENAME TO "Orden";
CREATE INDEX "Orden_clienteId_idx" ON "Orden"("clienteId");
CREATE INDEX "Orden_estado_idx" ON "Orden"("estado");
CREATE INDEX "Orden_deliveredByUserId_idx" ON "Orden"("deliveredByUserId");
CREATE INDEX "Orden_cajaSesionId_idx" ON "Orden"("cajaSesionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
