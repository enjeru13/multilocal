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
    "descuentoMaxPct" REAL NOT NULL DEFAULT 100
);
INSERT INTO "new_Configuracion" ("clienteObligatorio", "deduccionStockEn", "descuentoMaxPct", "direccion", "id", "impuestoActivo", "impuestoNombre", "impuestoTasa", "mensajePieRecibo", "moduloCaja", "moduloClienteTipo", "moduloFechaEntrega", "moduloInventario", "moduloProveedores", "monedaPrincipal", "nombreNegocio", "preciosIncluyenImpuesto", "rif", "rubro", "tasaCOP", "tasaUSD", "tasaVES", "telefonoPrincipal", "telefonoSecundario", "terminologia") SELECT "clienteObligatorio", "deduccionStockEn", "descuentoMaxPct", "direccion", "id", "impuestoActivo", "impuestoNombre", "impuestoTasa", "mensajePieRecibo", "moduloCaja", "moduloClienteTipo", "moduloFechaEntrega", "moduloInventario", "moduloProveedores", "monedaPrincipal", "nombreNegocio", "preciosIncluyenImpuesto", "rif", "rubro", "tasaCOP", "tasaUSD", "tasaVES", "telefonoPrincipal", "telefonoSecundario", "terminologia" FROM "Configuracion";
DROP TABLE "Configuracion";
ALTER TABLE "new_Configuracion" RENAME TO "Configuracion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
