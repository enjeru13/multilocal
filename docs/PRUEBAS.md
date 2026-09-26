# Lista de pruebas — Mostrador

Marca cada casilla al comprobarla. Si algo falla, escribe debajo **qué pantalla, qué hiciste y qué pasó**
(una captura ayuda mucho). Las pruebas están ordenadas de lo más importante a lo menos.

**Qué llevar al PC de prueba**
- [ ] El instalador `Mostrador Setup 0.1.0.exe`
- [ ] El respaldo real `respaldo_2026-09-18.db` (una **copia**, nunca el original)
- [ ] Un Excel de inventario de un negocio de repuestos (o el que baja la plantilla de la propia app)
- [ ] La impresora térmica (ticket) y una impresora de hojas
- [ ] Un lector de códigos de barras, si lo hay
- [ ] Un teléfono con WhatsApp

> Regla de oro: **las pruebas con datos reales se hacen siempre con una copia**. Antes de probar nada
> destructivo (restaurar, importar), la app guarda sola una copia previa en Respaldos.

---

## 1. Instalación

- [ ] El instalador abre (Windows avisa «editor desconocido»: **Más información → Ejecutar de todos modos**).
- [ ] Se instala sin pedir administrador y sin instalar nada más (no hace falta Node ni nada previo).
- [ ] Aparece el acceso directo «Mostrador» en el menú de inicio (y en el escritorio si se eligió).
- [ ] Se abre la ventana y llega al asistente de configuración inicial.
- [ ] Cerrar la ventana y volver a abrir: **no** vuelve a pedir el asistente y no queda ningún proceso «Mostrador» en el Administrador de tareas al cerrar.
- [ ] Abrir dos veces seguidas: la segunda no abre otra copia, trae la primera al frente.

Si falla: `%APPDATA%\Mostrador\logs\servidor.log`

## 2. Asistente inicial

Hazlo dos veces (una con **Lavandería**, otra con **Repuestos y equipos**) borrando antes `%APPDATA%\Mostrador\datos`
o usando otra cuenta de Windows.

- [ ] Paso 1: valida correo, contraseña de 6+ y que coincidan.
- [ ] Paso 2: elegir rubro cambia el color y la vista previa de la derecha; nombre y datos de recibos se guardan.
- [ ] Paso 3: monedas (activar/quitar, elegir principal), tasas, IVA y módulos en tarjetas.
- [ ] El panel morado de la izquierda **no se mueve** y solo el contenido de la derecha hace scroll.
- [ ] Al terminar, entra directo y el menú es el del rubro elegido (lavandería: Recepción/Tablero; repuestos: Facturar/Presupuestos/Catálogo).

## 3. Datos reales (lo más importante)

Restauración: **Respaldos → Importar del sistema anterior** con la copia de `respaldo_2026-09-18.db`.

- [ ] La vista previa dice: 416 clientes, 147 servicios, 849 órdenes, 295 pagos, 32 categorías, 4 usuarios.
- [ ] Avisa que **30 órdenes tienen el «abonado» mal guardado y se corregirán**.
- [ ] Tras importar, entras con **el usuario y la contraseña del sistema anterior**.
- [ ] Inicio/Resumen muestra **849 órdenes** y **por cobrar 12.898,59** en **617 órdenes**.
- [ ] Reportes → Cuentas por cobrar: **308 clientes** con deuda.
- [ ] Elige **5 órdenes que conozcas de memoria** (cliente, prendas, total, abonado, si está entregada) y confirma que coinciden:
  1. Orden # ___ ✔/✘  2. # ___ ✔/✘  3. # ___ ✔/✘  4. # ___ ✔/✘  5. # ___ ✔/✘
- [ ] Orden **#766** (vale $42): ya no muestra un abonado absurdo; sigue saldada.
- [ ] Abre un pago en **bolívares** y otro en **pesos**: los montos y la moneda se ven bien.
- [ ] Crea una orden nueva: su número continúa después del último importado.

## 4. Ventas y cobros

**Lavandería**
- [ ] Recepción: cliente existente + 2 servicios (uno con precio editado) → «Crear orden».
- [ ] Descuento en % y luego en monto: los totales cuadran.
- [ ] Cobrar **abono parcial en dólares**, luego el resto en **bolívares**: estado pasa a Parcial → Completo.
- [ ] Cobrar de más en efectivo y **dar vuelto** en otra moneda: el saldo queda en cero.
- [ ] Tablero: mover la orden Pendiente → Lista → Entregada. Al pasar a Lista, WhatsApp abre con el mensaje.
- [ ] Devolución parcial de una línea: el total y el stock se ajustan.
- [ ] Anular una orden: desaparece de ventas y del por cobrar.

**Repuestos / mostrador**
- [ ] Facturar: escanear un código agrega el producto; el precio de una línea se puede editar.
- [ ] IVA activado: se ve el desglose; probar «precios incluyen impuesto» encendido y apagado.
- [ ] Un producto marcado **exento** no lleva IVA.
- [ ] Sin stock suficiente: no deja vender y **suena el zumbido de error**.

## 5. Caja (si el módulo está activo)

- [ ] Sin caja abierta no deja cobrar; avisa cómo abrirla.
- [ ] Abrir con monto inicial, cobrar en 2 monedas, registrar un egreso.
- [ ] Cerrar: el sistema propone el efectivo esperado; contar distinto muestra la diferencia.
- [ ] Imprimir el comprobante del cierre.

## 6. Catálogo e inventario

**Importar desde Excel** (Catálogo → *Importar desde Excel*)
- [ ] Descargar la plantilla y abrirla en Excel.
- [ ] Cargar tu Excel real: las columnas se reconocen solas (o se corrigen a mano).
- [ ] La vista previa separa **nuevos / actualizaciones / con problemas** y explica cada problema.
- [ ] «Descargar las filas con problemas» funciona.
- [ ] Importar: los productos aparecen con su categoría, precio y existencias.
- [ ] Volver a cargar el mismo archivo: **no duplica**, dice «sin cambios».
- [ ] Cambiar un precio en el Excel y recargar: solo ese producto se actualiza.
- [ ] Precios escritos como `12,50`, `12.50`, `1.250,00`, `$ 12` se entienden bien.

**Exportar**
- [ ] Catálogo → *Exportar a Excel* abre en Excel con columnas anchas y números como números.
- [ ] Ese archivo se puede volver a importar sin tocarlo.
- [ ] Clientes → *Exportar a Excel*.

**Conteo físico** (Menú → Conteo físico)
- [ ] Empezar un conteo; escanear el mismo producto 3 veces → cuenta 3.
- [ ] Buscar por nombre sin tildes («bujia» encuentra «Bujía»).
- [ ] Corregir una cantidad a mano.
- [ ] «Sin contar» y «Con diferencia» muestran lo correcto; el resumen muestra faltan/sobran y su valor.
- [ ] Aplicar ajustes (como administrador): las existencias quedan iguales a lo contado y Inventario → Movimientos muestra «Toma de inventario #N».
- [ ] Un empleado puede contar pero **no** aplicar.

**Etiquetas** (Catálogo → *Imprimir etiquetas*)
- [ ] Marcar 2 productos con código; la vista previa muestra nombre, barras, código y precio.
- [ ] Imprimir en tu rollo de etiquetas: el tamaño coincide y **el escáner lee** el código impreso.
- [ ] Probar también hoja A4 de etiquetas (si tienes).
- [ ] Un producto sin código sale atenuado y no se puede marcar.

## 7. Presupuestos

- [ ] Nuevo presupuesto: cliente registrado, 1 producto del catálogo y 1 línea libre (instalación).
- [ ] Guardar: se le asigna número; al cambiar algo pide guardar antes de imprimir.
- [ ] Imprimir: sale con datos del negocio, líneas, totales, condiciones y espacio para firma.
- [ ] Enviar por WhatsApp: abre con el resumen; el estado pasa a Enviado.
- [ ] Marcar como aceptado → **Convertir en venta**: se crea la venta y el presupuesto queda bloqueado.
- [ ] La línea libre pasó al catálogo como servicio («Servicios varios»).
- [ ] Un presupuesto con fecha pasada figura como **Vencido**, con globito rojo en el menú y aviso en el Resumen.
- [ ] Apagar el módulo en Configuración: desaparece del menú.

## 8. Reportes e impresión

- [ ] **Recibo en ticket** de 58 mm y de 80 mm: sin cortes, con «Comprobante no fiscal».
- [ ] Recibo en hoja Carta y en A4.
- [ ] Reportes → *Imprimir → Resumen del periodo* en hoja.
- [ ] **Libro de ventas** en bolívares: una fila por venta, exento / base imponible / IVA, tasa de cada día y totales.
- [ ] Libro de ventas → Exportar CSV abre bien en Excel (columnas separadas).
- [ ] Cambiar de impresora o de papel: la vista previa y el resultado coinciden.
- [ ] Reporte de cuentas por cobrar impreso.

## 9. Clientes

- [ ] Ficha de un cliente **que debe**: muestra el total y desde cuántos días.
- [ ] «Enviar estado de cuenta» abre WhatsApp con una línea por orden y el total.
- [ ] «Copiar texto» copia el mensaje.
- [ ] Un cliente sin teléfono: el botón de WhatsApp está desactivado.
- [ ] Ficha con presupuestos: los lista y «Nuevo» crea uno ya con ese cliente.

## 10. Sonidos

Menú de usuario → **Sonidos**.
- [ ] «Probar» suena en cada evento; el **zumbido de error se oye bien** en las bocinas de ese PC.
- [ ] El volumen sube y baja.
- [ ] Apagar el interruptor general silencia todo.
- [ ] Cobrar suena la campanita; agregar un producto (encendido) hace el pitido.

## 11. Usuarios y permisos

- [ ] Crear un usuario **Cajero** y uno **Empleado**.
- [ ] El cajero **no ve costos** ni Reportes, ni Configuración.
- [ ] El empleado no puede aplicar un conteo, ni ver Reportes, ni cambiar precios masivamente.
- [ ] Un usuario desactivado no puede entrar.
- [ ] Cambiar mi contraseña funciona y la nueva se exige al volver a entrar.
- [ ] 8 contraseñas incorrectas seguidas bloquean el acceso unos minutos.

## 12. Respaldos

- [ ] Crear un respaldo manual y **descargarlo**.
- [ ] Al día siguiente hay un respaldo automático nuevo.
- [ ] Restaurar ese respaldo funciona y deja una copia previa.
- [ ] El archivo descargado abre en otro PC (Restaurar desde archivo).

## 13. Reinicio, actualización y desinstalación

- [ ] Reiniciar el PC: al abrir Mostrador todo sigue igual.
- [ ] **Actualizar**: instalar el `.exe` nuevo **encima** del anterior con datos cargados → conserva todo y crea una copia `previo-actualizacion-*`.
- [ ] Desinstalar **no** borra `%APPDATA%\Mostrador`; reinstalar recupera los datos.
- [ ] Con el equipo **sin internet**, todo funciona igual.

## 14. Teléfono (cuando exista el servidor en internet)

- [ ] Abrir la dirección en Chrome (Android): *Instalar aplicación*; en iPhone (Safari): *Agregar a inicio*.
- [ ] Se abre a pantalla completa, con su icono.
- [ ] La barra inferior y el menú «Más» funcionan con el pulgar.
- [ ] Vender / facturar en el teléfono: barra fija con el total y el botón de cobrar.
- [ ] Sin conexión aparece el aviso y no se pierde lo escrito.
- [ ] Los sonidos suenan tras el primer toque en la pantalla.

---

## Registro de fallos

| # | Sección | Qué hice | Qué pasó | Qué esperaba | Captura |
|---|---------|----------|----------|--------------|---------|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**Resultado general:** ☐ Listo para usar  ☐ Listo con arreglos menores  ☐ No listo
