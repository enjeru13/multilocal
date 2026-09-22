-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "tipo" TEXT,
    "telefono" TEXT,
    "telefono_secundario" TEXT,
    "direccion" TEXT,
    "identificacion" TEXT,
    "email" TEXT,
    "fechaRegistro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Servicio" (
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
    CONSTRAINT "Servicio_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Orden" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER,
    "tipo" TEXT NOT NULL DEFAULT 'ORDEN_LAVANDERIA',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaIngreso" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntrega" DATETIME,
    "observaciones" TEXT,
    "total" REAL NOT NULL,
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

-- CreateTable
CREATE TABLE "DetalleOrden" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordenId" INTEGER NOT NULL,
    "servicioId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioUnit" REAL NOT NULL,
    "costoUnit" REAL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "DetalleOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DetalleOrden_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordenId" INTEGER NOT NULL,
    "monto" REAL NOT NULL,
    "moneda" TEXT NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "tasa" REAL NOT NULL DEFAULT 0.00,
    "nota" TEXT,
    "fechaPago" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cajaSesionId" INTEGER,
    CONSTRAINT "Pago_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pago_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "CajaSesion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VueltoEntregado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pagoId" INTEGER NOT NULL,
    "monto" REAL NOT NULL,
    "moneda" TEXT NOT NULL,
    CONSTRAINT "VueltoEntregado_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Configuracion" (
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
    "terminologia" TEXT
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "identificacion" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proveedorId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "total" REAL NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompraDetalle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "compraId" INTEGER NOT NULL,
    "servicioId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "costoUnit" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "CompraDetalle_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompraDetalle_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventarioMovimiento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "servicioId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "ordenId" INTEGER,
    "compraId" INTEGER,
    "stockResultante" REAL NOT NULL,
    "userId" INTEGER,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,
    CONSTRAINT "InventarioMovimiento_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CajaSesion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioAperturaId" INTEGER NOT NULL,
    "fechaApertura" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoInicial" REAL NOT NULL DEFAULT 0,
    "fechaCierre" DATETIME,
    "montoFinalContado" REAL,
    "montoFinalSistema" REAL,
    "diferencia" REAL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "observacionCierre" TEXT,
    CONSTRAINT "CajaSesion_usuarioAperturaId_fkey" FOREIGN KEY ("usuarioAperturaId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CajaMovimiento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cajaSesionId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "concepto" TEXT NOT NULL,
    "userId" INTEGER,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CajaMovimiento_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "CajaSesion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CajaMovimiento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_identificacion_key" ON "Cliente"("identificacion");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_sku_key" ON "Servicio"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_codigoBarras_key" ON "Servicio"("codigoBarras");

-- CreateIndex
CREATE INDEX "Servicio_categoriaId_fkey" ON "Servicio"("categoriaId");

-- CreateIndex
CREATE INDEX "Orden_clienteId_idx" ON "Orden"("clienteId");

-- CreateIndex
CREATE INDEX "Orden_estado_idx" ON "Orden"("estado");

-- CreateIndex
CREATE INDEX "Orden_deliveredByUserId_idx" ON "Orden"("deliveredByUserId");

-- CreateIndex
CREATE INDEX "Orden_cajaSesionId_idx" ON "Orden"("cajaSesionId");

-- CreateIndex
CREATE INDEX "DetalleOrden_ordenId_fkey" ON "DetalleOrden"("ordenId");

-- CreateIndex
CREATE INDEX "DetalleOrden_servicioId_fkey" ON "DetalleOrden"("servicioId");

-- CreateIndex
CREATE INDEX "Pago_ordenId_fkey" ON "Pago"("ordenId");

-- CreateIndex
CREATE INDEX "Pago_cajaSesionId_idx" ON "Pago"("cajaSesionId");

-- CreateIndex
CREATE INDEX "VueltoEntregado_pagoId_idx" ON "VueltoEntregado"("pagoId");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_identificacion_key" ON "Proveedor"("identificacion");

-- CreateIndex
CREATE INDEX "Compra_proveedorId_idx" ON "Compra"("proveedorId");

-- CreateIndex
CREATE INDEX "CompraDetalle_compraId_idx" ON "CompraDetalle"("compraId");

-- CreateIndex
CREATE INDEX "CompraDetalle_servicioId_idx" ON "CompraDetalle"("servicioId");

-- CreateIndex
CREATE INDEX "InventarioMovimiento_servicioId_idx" ON "InventarioMovimiento"("servicioId");

-- CreateIndex
CREATE INDEX "InventarioMovimiento_ordenId_idx" ON "InventarioMovimiento"("ordenId");

-- CreateIndex
CREATE INDEX "InventarioMovimiento_compraId_idx" ON "InventarioMovimiento"("compraId");

-- CreateIndex
CREATE INDEX "CajaSesion_estado_idx" ON "CajaSesion"("estado");

-- CreateIndex
CREATE INDEX "CajaMovimiento_cajaSesionId_idx" ON "CajaMovimiento"("cajaSesionId");
