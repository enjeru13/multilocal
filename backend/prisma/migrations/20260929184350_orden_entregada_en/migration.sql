-- AlterTable
ALTER TABLE "Orden" ADD COLUMN "entregadaEn" DATETIME;

-- Mejor esfuerzo para lo ya entregado: fechaEntrega venía sirviendo como fecha real de entrega
-- (el código la pisaba al marcar "Entregado"). No afecta al tablero (solo mira "hoy"), pero deja
-- historial en vez de nulo para lo que ya se entregó antes de este cambio.
UPDATE "Orden" SET "entregadaEn" = "fechaEntrega" WHERE "estado" = 'ENTREGADO' AND "fechaEntrega" IS NOT NULL;
