# Mostrador en internet (Railway) y en el teléfono

La misma aplicación puede correr en un servidor en internet. Así se abre desde cualquier computadora o
teléfono, y en el teléfono se instala como una aplicación más (PWA). Cada servidor es **un solo negocio**:
si otro negocio lo quiere, se monta otro servidor.

## Qué se despliega

Un contenedor (`Dockerfile` en la raíz) que sirve la API y la interfaz desde el mismo proceso. Sus datos van
en un **volumen** montado en `/data`:

| Archivo | Contenido |
|---|---|
| `/data/mostrador.db` | La base de datos de todo el negocio |
| `/data/respaldos/` | Respaldos automáticos (uno al día, se conservan 14) y manuales |
| `/data/clave-sesiones.txt` | Clave que firma las sesiones (si no defines `JWT_SECRET`) |

Sin volumen, **cada despliegue empieza de cero y se pierden los datos**. Es lo primero que hay que montar.

## Variables

| Variable | Obligatoria | Para qué |
|---|---|---|
| `MOSTRADOR_SETUP_CODE` | **Sí** | Código que se pide al crear la cuenta de administrador. Sin él, quien abra la dirección primero se quedaría con el sistema. Elige algo largo y guárdalo. |
| `JWT_SECRET` | No | Clave de sesiones. Si no la defines se crea sola y se guarda en el volumen. |
| `PORT` | No | Railway la pone sola. |

`MOSTRADOR_MODO`, `MOSTRADOR_DATA_DIR`, `MIGRATIONS_DIR` y `FRONTEND_DIR` ya vienen en el `Dockerfile`.

## Pasos en Railway

1. **Sube el código a un repositorio privado de GitHub.** El proyecto ya tiene un remoto configurado; el código
   contiene la lógica de tu negocio, así que mantenlo privado. Nunca subas archivos `.db`.
2. En [railway.com](https://railway.com): **New Project → Deploy from GitHub repo** y elige el repositorio.
   Railway detecta `railway.json` y construye con el `Dockerfile` (la primera vez tarda varios minutos).
3. En el servicio: **Settings → Volumes → Add Volume** y móntalo en `/data`.
4. **Variables → New Variable**: `MOSTRADOR_SETUP_CODE` = tu código.
5. **Settings → Networking → Generate Domain**. Railway te da una dirección `https://algo.up.railway.app` con
   HTTPS automático (necesario para instalarla en el teléfono).
6. Abre esa dirección: sale el asistente de configuración inicial. En el primer paso te pide el código del punto 4.

Deja **una sola réplica** (ya viene así en `railway.json`): la base es un archivo SQLite y no admite dos
servidores escribiendo a la vez.

## Instalar en el teléfono

Abre la dirección del servidor en el navegador del teléfono e inicia sesión.

- **Android (Chrome):** menú ⋮ → **Instalar aplicación** (o «Agregar a la pantalla principal»).
- **iPhone (Safari):** botón Compartir → **Agregar a inicio**. Tiene que ser Safari.

Se abre a pantalla completa, con su icono, como cualquier otra aplicación. Dentro del sistema, **Más → Instalar la
app** repite estas instrucciones.

Los sonidos empiezan a funcionar después del primer toque en la pantalla.

## Respaldos: lo que hay que saber

- El sistema hace un respaldo al día, pero se guarda **en el mismo volumen** que la base. Protege de errores
  (borrar algo por accidente), **no** de perder el volumen.
- Descarga un respaldo a tu computadora con regularidad: **Respaldos → Descargar**.
- Al actualizar la aplicación, si la base tiene datos, se guarda antes una copia `previo-actualizacion-*.db`.

## Actualizar

Cada vez que subas cambios al repositorio, Railway vuelve a construir y a desplegar. La base se actualiza sola
al arrancar (con copia previa). Las sesiones abiertas siguen funcionando.

## Seguridad

- Las contraseñas se guardan cifradas, las sesiones duran 8 horas y hay HTTPS.
- Tras 8 intentos fallidos con el mismo usuario (o 40 desde el mismo lugar) se bloquea el acceso 15 minutos.
- Usa contraseñas largas y no compartidas. Crea un usuario por persona (**Usuarios**) y desactiva al que se vaya.
- Quien tenga acceso de administrador ve todo el negocio. Los cajeros y empleados ven solo lo que su rol permite.

## Coste

Railway cobra por uso (el servicio y el volumen). Revisa sus precios actuales antes de contratar: para un
negocio pequeño el consumo es bajo, pero no es gratis.

## Ejecutarlo tú mismo sin Docker (pruebas)

```bash
pnpm --filter @lavanderia/shared build && pnpm --filter backend build && pnpm --filter frontend build
MOSTRADOR_MODO=nube MOSTRADOR_DATA_DIR=./datos-prueba MIGRATIONS_DIR=backend/prisma/migrations \
FRONTEND_DIR=frontend/dist PORT=8080 MOSTRADOR_SETUP_CODE=prueba node backend/build/produccion.js
```

Requiere Node 22 o superior.
