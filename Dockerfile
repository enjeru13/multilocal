# Servidor de Mostrador para internet (Railway u otro proveedor con contenedores).
# Sirve la API y la interfaz desde el mismo proceso; los datos viven en el volumen /data.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@12.6.0

WORKDIR /app
COPY . .

# Solo lo que hace falta para el servidor y la interfaz (no Electron ni el resto del monorepo).
RUN pnpm install --frozen-lockfile --filter "backend..." --filter "frontend..." \
 && pnpm --filter @lavanderia/shared build \
 && pnpm --filter backend build \
 && pnpm --filter frontend build

ENV NODE_ENV=production \
    MOSTRADOR_MODO=nube \
    MOSTRADOR_DATA_DIR=/data \
    MIGRATIONS_DIR=/app/backend/prisma/migrations \
    FRONTEND_DIR=/app/frontend/dist

# La base de datos, los respaldos y la clave de sesiones van aquí: monta un volumen persistente.
VOLUME ["/data"]

CMD ["node", "backend/build/produccion.js"]
