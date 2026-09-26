-- Las órdenes importadas del sistema anterior (y las anteriores a los impuestos) tienen el desglose en 0:
-- sin él, los reportes de ganancia y el libro de ventas las verían como ventas de valor cero.
-- Solo se rellenan las líneas sin descuento ni impuesto, donde la base es exactamente el subtotal.
UPDATE "DetalleOrden" SET "base" = "subtotal" WHERE "base" = 0 AND "subtotal" > 0 AND "descuento" = 0 AND "impuesto" = 0;
UPDATE "Orden" SET "subtotal" = "total" WHERE "subtotal" = 0 AND "total" > 0 AND "descuento" = 0 AND "impuesto" = 0;
