# Versión de escritorio (local)

La app instalada corre **toda en la computadora del negocio**: un servidor interno (Express + SQLite)
que se abre solo con la ventana y sirve la interfaz. No usa internet ni ningún servidor externo.

## Dónde quedan los datos

`%APPDATA%\Mostrador\`

| Carpeta | Contenido |
|---|---|
| `datos\mostrador.db` | La base de datos (todo el negocio) |
| `datos\respaldos\` | Respaldos automáticos (uno al día, se conservan 14) y manuales |
| `datos\clave-sesiones.txt` | Clave que firma las sesiones (se crea sola, no compartir) |
| `logs\servidor.log` | Registro del servidor interno, útil para soporte |

Desinstalar la app **no borra** esa carpeta. Al actualizar, la base se lleva sola al esquema nuevo
y, si ya tenía datos, antes se guarda una copia `previo-actualizacion-*.db` en `respaldos`.

## Generar el instalador

```bash
pnpm --filter desktop dist        # prepara todo y crea release/Mostrador Setup x.y.z.exe
pnpm --filter desktop dist:dir    # igual, pero sin instalador (release/win-unpacked) para probar
```

`dist` ejecuta antes `scripts/preparar.mjs`, que compila `shared`, el servidor y la interfaz, e instala las
dependencias del servidor con npm en `stage/` (más el cliente de Prisma generado para Windows).
Necesita internet solo para eso.

Para probar el modo instalado sin generar el instalador:

```bash
pnpm --filter desktop preparar
pnpm --filter desktop probar:stage
```

`MOSTRADOR_USERDATA=<carpeta>` usa otra carpeta de datos (pruebas) y `MOSTRADOR_PORT` cambia el puerto
preferido (por defecto 47821; si está ocupado se elige otro, pero entonces hay que volver a iniciar sesión).

## Nombre y marca

El nombre está en dos sitios: la constante `NOMBRE` de `main.js` y `build.productName` / `nsis.shortcutName`
de `package.json`. El icono provisional sale de `scripts/icono.mjs` (`build/icon.png`); para el definitivo basta
con reemplazar ese PNG (512×512).

## Desarrollo

`pnpm dev:desktop` abre la ventana contra los servidores de desarrollo (backend 4000, frontend 5173).
