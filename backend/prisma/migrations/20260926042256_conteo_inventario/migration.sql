-- CreateTable
CREATE TABLE "ConteoInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT,
    "categoriaId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoEn" DATETIME,
    "userId" INTEGER,
    "userName" TEXT
);

-- CreateTable
CREATE TABLE "ConteoDetalle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conteoId" INTEGER NOT NULL,
    "servicioId" INTEGER NOT NULL,
    "contado" REAL NOT NULL,
    "esperado" REAL,
    "diferencia" REAL,
    "costoUnit" REAL,
    CONSTRAINT "ConteoDetalle_conteoId_fkey" FOREIGN KEY ("conteoId") REFERENCES "ConteoInventario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConteoDetalle_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConteoInventario_estado_idx" ON "ConteoInventario"("estado");

-- CreateIndex
CREATE INDEX "ConteoDetalle_servicioId_idx" ON "ConteoDetalle"("servicioId");

-- CreateIndex
CREATE UNIQUE INDEX "ConteoDetalle_conteoId_servicioId_key" ON "ConteoDetalle"("conteoId", "servicioId");
