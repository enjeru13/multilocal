import { Request, Response } from "express";
import prisma from "../lib/prisma";
import {
  ordenSchema,
  ordenUpdateSchema,
  ObservacionUpdateSchema,
  devolucionSchema,
} from "../schemas/orden.schema";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import dayjs from "dayjs";
import { Prisma, Role } from "@prisma/client";
import { obtenerEstadoPagoRaw } from "@lavanderia/shared/dist/utils/pagoFinance";
import { convertirDesdePrincipal } from "@lavanderia/shared/dist/utils/monedaHelpers";
import { resolverTasa } from "../lib/dinero";
import {
  agregarLineas,
  calcularTotales,
  r2,
  valorDevolucion,
} from "@lavanderia/shared/dist/utils/totales";
import type { Moneda } from "@lavanderia/shared/dist/types/types";
import { cargarTasas, opcionesTotales, recalcularEstadoOrden } from "../lib/ordenFinance";

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name?: string;
    role: Role;
  };
}

// Devuelve al inventario lo que esta orden había descontado (según los
// movimientos VENTA registrados), sin duplicar devoluciones previas.
async function devolverStockDeOrden(
  tx: any,
  ordenId: number,
  userId: number | undefined,
  motivo: string
) {
  const movimientos = await tx.inventarioMovimiento.findMany({
    where: { ordenId, motivo: { in: ["VENTA", "DEVOLUCION"] } },
  });
  const neto = new Map<number, number>();
  for (const m of movimientos) {
    const signo = m.tipo === "SALIDA" ? 1 : -1;
    neto.set(m.servicioId, (neto.get(m.servicioId) ?? 0) + signo * m.cantidad);
  }
  for (const [servicioId, cantidad] of neto) {
    if (cantidad <= 0) continue;
    const actualizado = await tx.servicio.update({
      where: { id: servicioId },
      data: { stockActual: { increment: cantidad } },
    });
    await tx.inventarioMovimiento.create({
      data: {
        servicioId,
        tipo: "ENTRADA",
        cantidad,
        motivo: "DEVOLUCION",
        ordenId,
        stockResultante: actualizado.stockActual,
        userId: userId ?? null,
        nota: `${motivo} - ref. #${ordenId}`,
      },
    });
  }
}

// --- ANULAR ---
// Cancela la orden sin borrar historial: devuelve stock y registra el
// reembolso de lo cobrado como pagos negativos (así la caja y los reportes
// cuadran solos).
export async function anularOrden(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  try {
    const orden = await prisma.orden.findUnique({
      where: { id },
      include: { pagos: { include: { vueltos: true } } },
    });
    if (!orden) return res.status(404).json({ message: "Orden no encontrada." });
    if (orden.estado === "CANCELADO") {
      return res.status(409).json({ message: "La orden ya está anulada." });
    }

    const config = await prisma.configuracion.findFirst();
    // Con devoluciones previas ya hubo reembolsos parciales: se reembolsa solo
    // lo que el cliente tiene pagado en neto, en un único movimiento.
    const conDevoluciones = orden.devuelto > 0;
    const cobrados = conDevoluciones
      ? orden.abonado > 0.005
        ? [{ monto: orden.abonado, moneda: (config?.monedaPrincipal ?? "USD") as string, metodoPago: "EFECTIVO" as const, tasa: 0, vueltos: [] as { monto: number; moneda: string }[] }]
        : []
      : orden.pagos.filter((p) => p.monto > 0);
    let cajaSesionId: number | null = null;
    if (cobrados.length > 0 && config?.moduloCaja) {
      const caja = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
      if (!caja) {
        return res.status(409).json({
          message: "Hay pagos que reembolsar: abre la caja antes de anular esta orden.",
        });
      }
      cajaSesionId = caja.id;
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      await devolverStockDeOrden(tx, id, req.user?.id, "Anulación");

      for (const p of cobrados) {
        const reembolso = await tx.pago.create({
          data: {
            ordenId: id,
            monto: -p.monto,
            moneda: p.moneda as Moneda,
            metodoPago: p.metodoPago,
            // El reembolso neto va en la moneda principal (tasa 1); los demás repiten la tasa del cobro.
            tasa: conDevoluciones ? 1 : p.tasa,
            nota: `Reembolso por anulación - ref. #${id}`,
            cajaSesionId,
          },
        });
        if (p.vueltos.length > 0) {
          await tx.vueltoEntregado.createMany({
            data: p.vueltos.map((v) => ({
              pagoId: reembolso.id,
              monto: -v.monto,
              moneda: v.moneda,
            })),
          });
        }
      }

      return tx.orden.update({
        where: { id },
        data: { estado: "CANCELADO", abonado: 0, faltante: 0 },
        include: { cliente: true, pagos: { include: { vueltos: true } }, detalles: { include: { servicio: true } } },
      });
    });

    return res.json(actualizada);
  } catch (error) {
    console.error("Error al anular orden:", error);
    return res.status(500).json({ message: "Error al anular la orden" });
  }
}

// --- GET ALL ---
export async function getAllOrdenes(req: Request, res: Response) {
  try {
    const ordenes = await prisma.orden.findMany({
      include: {
        cliente: true,
        detalles: {
          include: {
            servicio: {
              select: {
                id: true,
                nombreServicio: true,
                descripcion: true,
                precioBase: true,
                permiteDecimales: true,
                categoriaId: true,
              },
            },
          },
        },
        pagos: { include: { vueltos: true } },
        deliveredBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { fechaIngreso: "desc" },
    });
    return res.json(ordenes);
  } catch (error) {
    console.error("Error al obtener órdenes:", error);
    return res.status(500).json({ message: "Error al obtener órdenes" });
  }
}

// --- TABLERO ---
// Solo lo que está en juego: pendientes, listas y lo entregado hoy. Así el
// tablero no descarga años de historial.
export async function getTablero(req: Request, res: Response) {
  try {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
    const ordenes = await prisma.orden.findMany({
      where: {
        OR: [
          { estado: { in: ["PENDIENTE", "LISTO"] } },
          { estado: "ENTREGADO", entregadaEn: { gte: inicioHoy } },
        ],
      },
      include: {
        cliente: true,
        detalles: { include: { servicio: { select: { id: true, nombreServicio: true, permiteDecimales: true } } } },
        pagos: { include: { vueltos: true } },
      },
      orderBy: [{ fechaEntrega: "asc" }, { fechaIngreso: "asc" }],
    });
    return res.json(ordenes);
  } catch (error) {
    console.error("Error al obtener el tablero:", error);
    return res.status(500).json({ message: "Error al obtener el tablero" });
  }
}

// --- GET BY ID ---
export async function getOrdenById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const orden = await prisma.orden.findUnique({
      where: { id: Number(id) },
      include: {
        cliente: true,
        detalles: {
          include: {
            servicio: {
              select: {
                id: true,
                nombreServicio: true,
                descripcion: true,
                precioBase: true,
                permiteDecimales: true,
                categoriaId: true,
              },
            },
          },
        },
        pagos: { include: { vueltos: true } },
        devoluciones: { include: { detalles: true }, orderBy: { fecha: "desc" } },
        deliveredBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!orden) {
      return res.status(404).json({ message: "Orden no encontrada" });
    }
    return res.json(orden);
  } catch (error) {
    console.error("Error al obtener orden:", error);
    return res.status(500).json({ message: "Error al obtener orden" });
  }
}

const SERVICIO_RESUMEN = {
  id: true,
  nombreServicio: true,
  descripcion: true,
  precioBase: true,
  permiteDecimales: true,
  categoriaId: true,
} as const;

// Un no-administrador no puede pasar del tope de descuento del negocio.
export function descuentoExcedeTope(
  role: Role | undefined,
  config: { descuentoMaxPct?: number | null } | null,
  totales: { subtotal: number; descuento: number }
) {
  if (role === "ADMIN") return null;
  const tope = config?.descuentoMaxPct ?? 100;
  if (tope >= 100 || totales.subtotal <= 0) return null;
  const pct = (totales.descuento / totales.subtotal) * 100;
  return pct > tope + 0.005 ? tope : null;
}

// --- CREATE ---
export async function createOrden(req: AuthRequest, res: Response) {
  const result = ordenSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validación fallida",
      detalles: result.error.format(),
    });
  }

  const {
    clienteId,
    estado,
    observaciones,
    servicios,
    fechaEntrega,
    entregaInmediata,
    descuento,
  } = result.data;

  try {
    const config = await prisma.configuracion.findFirst();

    if (!clienteId) {
      if (config?.clienteObligatorio !== false) {
        return res
          .status(400)
          .json({ message: "Debes seleccionar un cliente para crear la orden." });
      }
    } else if (!(await prisma.cliente.findUnique({ where: { id: clienteId } }))) {
      return res.status(400).json({ message: "El cliente indicado no existe." });
    }

    // Una venta inmediata ya sale del negocio: descuenta stock al crearla
    // sin importar en qué momento descuente el perfil las órdenes normales.
    const deducirAhora =
      !!config?.moduloInventario &&
      (entregaInmediata || config?.deduccionStockEn === "CREACION");
    const estadoFinal = entregaInmediata ? "ENTREGADO" : estado;
    const tipoDocumento =
      entregaInmediata || config?.moduloFechaEntrega === false
        ? "VENTA"
        : "ORDEN_LAVANDERIA";

    const lineas: Array<{
      servicioId: number;
      cantidad: number;
      precioUnit: number;
      costoUnit: number | null;
      subtotal: number;
      exento: boolean;
    }> = [];
    const serviciosParaDescontar: Array<{ id: number; cantidad: number }> = [];

    for (const item of servicios) {
      const servicio = await prisma.servicio.findUnique({
        where: { id: item.servicioId },
      });
      if (!servicio) {
        return res.status(400).json({
          message: `Servicio con ID ${item.servicioId} no encontrado.`,
        });
      }

      if (deducirAhora && servicio.controlaStock) {
        if (servicio.stockActual < item.cantidad) {
          return res.status(400).json({
            message: `Stock insuficiente de "${servicio.nombreServicio}" (disponible: ${servicio.stockActual}).`,
          });
        }
        serviciosParaDescontar.push({ id: servicio.id, cantidad: item.cantidad });
      }

      // El precio personalizado de la línea manda sobre el precio base.
      const precioUnit = item.precio !== undefined ? Number(item.precio) : Number(servicio.precioBase);

      lineas.push({
        servicioId: item.servicioId,
        cantidad: item.cantidad,
        precioUnit: parseFloat(precioUnit.toFixed(2)),
        // Costo congelado al vender: base para reportes de ganancia.
        costoUnit: servicio.costoBase,
        subtotal: r2(precioUnit * item.cantidad),
        exento: servicio.exentoImpuesto,
      });
    }

    const totales = calcularTotales(lineas, opcionesTotales(config, descuento));
    const tope = descuentoExcedeTope(req.user?.role, config, totales);
    if (tope !== null) {
      return res.status(403).json({
        message: `Tu descuento máximo es ${tope}%. Pide autorización a un administrador.`,
      });
    }

    const detalleData = lineas.map((l, i) => ({
      servicioId: l.servicioId,
      cantidad: l.cantidad,
      precioUnit: l.precioUnit,
      costoUnit: l.costoUnit,
      subtotal: totales.lineas[i].subtotal,
      descuento: totales.lineas[i].descuento,
      impuesto: totales.lineas[i].impuesto,
      base: totales.lineas[i].base,
    }));

    const orden = await prisma.$transaction(async (tx) => {
      const nuevaOrden = await tx.orden.create({
        data: {
          clienteId: clienteId ?? null,
          tipo: tipoDocumento,
          estado: estadoFinal,
          total: totales.total,
          subtotal: totales.subtotal,
          descuento: totales.descuento,
          descuentoTipo: totales.descuento > 0 ? descuento?.tipo ?? null : null,
          descuentoValor: totales.descuento > 0 ? descuento?.valor ?? null : null,
          impuesto: totales.impuesto,
          impuestoTasa: config?.impuestoActivo ? config.impuestoTasa : null,
          tasaVES: config?.tasaVES ?? null,
          tasaCOP: config?.tasaCOP ?? null,
          observaciones,
          fechaEntrega: entregaInmediata
            ? new Date()
            : fechaEntrega
            ? dayjs(fechaEntrega).toDate()
            : null,
          // Cuándo se entregó de verdad (distinto de fechaEntrega, que es la fecha estimada):
          // lo usa el tablero para "Entregado hoy". Una venta inmediata se entrega al crearse.
          entregadaEn: entregaInmediata ? new Date() : null,
          ...(entregaInmediata && req.user
            ? {
                deliveredByUserId: req.user.id,
                deliveredByUserName: req.user.name || req.user.email,
              }
            : {}),
          abonado: 0,
          faltante: totales.total,
          estadoPago: obtenerEstadoPagoRaw(totales.total, 0),
          detalles: { create: detalleData },
        },
      });

      for (const { id, cantidad } of serviciosParaDescontar) {
        const actualizado = await tx.servicio.update({
          where: { id },
          data: { stockActual: { decrement: cantidad } },
        });
        await tx.inventarioMovimiento.create({
          data: {
            servicioId: id,
            tipo: "SALIDA",
            cantidad,
            motivo: "VENTA",
            ordenId: nuevaOrden.id,
            stockResultante: actualizado.stockActual,
            userId: req.user?.id ?? null,
            nota: `Ref. #${nuevaOrden.id}`,
          },
        });
      }

      return tx.orden.findUnique({
        where: { id: nuevaOrden.id },
        include: {
          cliente: true,
          detalles: { include: { servicio: { select: SERVICIO_RESUMEN } } },
        },
      });
    });

    return res.status(201).json(orden);
  } catch (error) {
    console.error("Error al crear orden:", error);
    return res.status(500).json({ message: "Error al crear orden" });
  }
}

// --- UPDATE ---
export async function updateOrden(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const result = ordenUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validación fallida",
      detalles: result.error.format(),
    });
  }

  // Solo se aceptan los campos validados: nada de total/abonado desde fuera.
  const { fechaEntrega, estado, servicios, observaciones, clienteId, descuento } = result.data;

  try {
    const ordenActual = await prisma.orden.findUnique({
      where: { id: Number(id) },
      include: { pagos: true, detalles: { include: { servicio: true } } },
    });

    if (!ordenActual) {
      return res
        .status(404)
        .json({ message: "Orden no encontrada para actualizar." });
    }

    if (ordenActual.estado === "CANCELADO") {
      return res
        .status(409)
        .json({ message: "La orden está anulada y ya no se puede modificar." });
    }

    const reemplazaLineas = Array.isArray(servicios) && servicios.length > 0;
    const cambiaDescuento = descuento !== undefined;
    if ((reemplazaLineas || cambiaDescuento) && ordenActual.devuelto > 0) {
      return res.status(409).json({
        message: "La orden tiene devoluciones: ya no se pueden cambiar sus artículos ni el descuento.",
      });
    }

    const config = await prisma.configuracion.findFirst();
    const deducirAlEntregar =
      !!config?.moduloInventario && config?.deduccionStockEn === "ENTREGA";

    const ordenActualizada = await prisma.$transaction(async (tx) => {
      const datos: Prisma.OrdenUncheckedUpdateInput = {
        ...(estado !== undefined && { estado }),
        ...(observaciones !== undefined && { observaciones }),
        ...(clienteId !== undefined && { clienteId }),
      };

      if (fechaEntrega !== undefined) {
        datos.fechaEntrega = fechaEntrega === null ? null : dayjs(fechaEntrega).toDate();
      }

      // Cuándo se entregó de verdad: se refresca cada vez que entra a ENTREGADO (aunque ya
      // se hubiera entregado antes y se haya revertido) — es lo que usa el tablero para saber
      // qué se entregó hoy. Ojo: no confundir con fechaEntrega, que es la fecha estimada.
      if (estado === "ENTREGADO" && ordenActual.estado !== "ENTREGADO") {
        datos.entregadaEn = dayjs().toDate();
      }

      // Auto-captura de "Entregado por" solo si aún no estaba seteado.
      if (
        estado === "ENTREGADO" &&
        ordenActual.estado !== "ENTREGADO" &&
        req.user &&
        !ordenActual.deliveredByUserId
      ) {
        datos.fechaEntrega = dayjs().toDate();
        datos.deliveredByUserId = req.user.id;
        datos.deliveredByUserName = req.user.name || req.user.email;

        // Descuento de stock al momento de entrega (si el perfil lo pide),
        // con los artículos actuales de la orden.
        if (deducirAlEntregar && !reemplazaLineas) {
          for (const detalle of ordenActual.detalles) {
            if (!detalle.servicio.controlaStock) continue;
            const actualizado = await tx.servicio.update({
              where: { id: detalle.servicioId },
              data: { stockActual: { decrement: detalle.cantidad } },
            });
            await tx.inventarioMovimiento.create({
              data: {
                servicioId: detalle.servicioId,
                tipo: "SALIDA",
                cantidad: detalle.cantidad,
                motivo: "VENTA",
                ordenId: ordenActual.id,
                stockResultante: actualizado.stockActual,
                userId: req.user.id,
                nota: `Ref. #${ordenActual.id} (entrega)`,
              },
            });
          }
        }
      }

      // Reemplazo de artículos y/o descuento: se recalcula todo el desglose.
      if (reemplazaLineas || cambiaDescuento) {
        const costoPrevio = new Map(ordenActual.detalles.map((d) => [d.servicioId, d.costoUnit]));
        const entrada: Array<{
          servicioId: number;
          cantidad: number;
          precioUnit: number;
          costoUnit: number | null;
          subtotal: number;
          exento: boolean;
        }> = [];

        if (reemplazaLineas) {
          for (const item of servicios!) {
            const servicioDb = await tx.servicio.findUnique({ where: { id: item.servicioId } });
            if (!servicioDb) throw new Error(`Servicio ID ${item.servicioId} no encontrado`);
            const precioUnit = item.precio !== undefined ? Number(item.precio) : Number(servicioDb.precioBase);
            entrada.push({
              servicioId: item.servicioId,
              cantidad: item.cantidad,
              precioUnit: parseFloat(precioUnit.toFixed(2)),
              // Conserva el costo con que se vendió si el artículo ya estaba.
              costoUnit: costoPrevio.has(item.servicioId)
                ? costoPrevio.get(item.servicioId)!
                : servicioDb.costoBase,
              subtotal: r2(precioUnit * item.cantidad),
              exento: servicioDb.exentoImpuesto,
            });
          }
        } else {
          for (const d of ordenActual.detalles) {
            entrada.push({
              servicioId: d.servicioId,
              cantidad: d.cantidad,
              precioUnit: d.precioUnit,
              costoUnit: d.costoUnit,
              subtotal: d.subtotal,
              exento: d.servicio.exentoImpuesto,
            });
          }
        }

        const descuentoFinal = cambiaDescuento
          ? descuento
          : ordenActual.descuentoTipo && ordenActual.descuentoValor !== null
          ? { tipo: ordenActual.descuentoTipo as "PORCENTAJE" | "MONTO", valor: ordenActual.descuentoValor }
          : null;

        const totales = calcularTotales(entrada, opcionesTotales(config, descuentoFinal));
        const tope = descuentoExcedeTope(req.user?.role, config, totales);
        if (tope !== null) {
          throw new ErrorHttp(403, `Tu descuento máximo es ${tope}%. Pide autorización a un administrador.`);
        }

        await tx.detalleOrden.deleteMany({ where: { ordenId: Number(id) } });
        await tx.detalleOrden.createMany({
          data: entrada.map((l, i) => ({
            ordenId: Number(id),
            servicioId: l.servicioId,
            cantidad: l.cantidad,
            precioUnit: l.precioUnit,
            costoUnit: l.costoUnit,
            subtotal: totales.lineas[i].subtotal,
            descuento: totales.lineas[i].descuento,
            impuesto: totales.lineas[i].impuesto,
            base: totales.lineas[i].base,
          })),
        });

        const faltante = Math.max(0, r2(totales.total - Number(ordenActual.abonado)));
        Object.assign(datos, {
          total: totales.total,
          subtotal: totales.subtotal,
          descuento: totales.descuento,
          descuentoTipo: totales.descuento > 0 ? descuentoFinal?.tipo ?? null : null,
          descuentoValor: totales.descuento > 0 ? descuentoFinal?.valor ?? null : null,
          impuesto: totales.impuesto,
          impuestoTasa: config?.impuestoActivo ? config.impuestoTasa : null,
          faltante,
          // Mismo criterio (epsilon) que el resto del sistema.
          estadoPago: obtenerEstadoPagoRaw(totales.total, Number(ordenActual.abonado)),
        });
      }

      return await tx.orden.update({
        where: { id: Number(id) },
        data: datos,
        include: {
          cliente: true,
          pagos: { include: { vueltos: true } },
          detalles: { include: { servicio: true } },
          deliveredBy: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return res.json(ordenActualizada);
  } catch (error) {
    if (error instanceof ErrorHttp) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Orden no encontrada para actualizar." });
      }
    }
    console.error("Error al actualizar orden:", error);
    return res.status(500).json({ message: "Error al actualizar orden" });
  }
}

// --- DEVOLUCIÓN PARCIAL ---
// Regresa unidades de una venta: baja el total (y el IVA/descuento que le
// tocaba a esas unidades), devuelve stock y, si el cliente ya había pagado
// de más, reembolsa la diferencia como pago negativo.
export async function crearDevolucion(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const result = devolucionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validación fallida", detalles: result.error.format() });
  }
  const { items, motivo, reembolsar = true, moneda, metodoPago = "EFECTIVO" } = result.data;

  try {
    const orden = await prisma.orden.findUnique({
      where: { id },
      include: { detalles: { include: { servicio: true } } },
    });
    if (!orden) return res.status(404).json({ message: "Orden no encontrada." });
    if (orden.estado === "CANCELADO") {
      return res.status(409).json({ message: "La orden está anulada: no admite devoluciones." });
    }

    // Une renglones repetidos y valida contra lo que aún se puede devolver.
    const pedido = new Map<number, number>();
    for (const it of items) pedido.set(it.detalleId, (pedido.get(it.detalleId) ?? 0) + it.cantidad);

    const aDevolver: Array<{ detalle: (typeof orden.detalles)[number]; cantidad: number; valor: ReturnType<typeof valorDevolucion> }> = [];
    for (const [detalleId, cantidad] of pedido) {
      const detalle = orden.detalles.find((d) => d.id === detalleId);
      if (!detalle) {
        return res.status(400).json({ message: `El artículo ${detalleId} no pertenece a esta orden.` });
      }
      const disponible = r2(detalle.cantidad - detalle.cantidadDevuelta);
      if (cantidad > disponible + 1e-9) {
        return res.status(400).json({
          message: `De "${detalle.servicio.nombreServicio}" solo se pueden devolver ${disponible}.`,
        });
      }
      aDevolver.push({ detalle, cantidad, valor: valorDevolucion(detalle, cantidad) });
    }

    const totalDevuelto = r2(aDevolver.reduce((s, x) => s + x.valor.total, 0));

    // Líneas tal como quedarán, para el nuevo total de la orden.
    const cantidadNueva = new Map(aDevolver.map((x) => [x.detalle.id, x.cantidad]));
    const lineasNuevas = orden.detalles.map((d) => ({
      ...d,
      cantidadDevuelta: d.cantidadDevuelta + (cantidadNueva.get(d.id) ?? 0),
    }));
    const agregado = agregarLineas(lineasNuevas);
    const todoDevuelto = lineasNuevas.every((d) => d.cantidad - d.cantidadDevuelta < 1e-9);

    const { config, principal, tasas } = await cargarTasas();
    const excedente = reembolsar ? r2(Math.max(0, orden.abonado - agregado.total)) : 0;

    let cajaSesionId: number | null = null;
    let monedaReembolso: Moneda = (moneda ?? principal) as Moneda;
    let tasaReembolso = 1;
    let montoReembolso = 0;
    if (excedente > 0.005) {
      const conv = resolverTasa(config, monedaReembolso);
      if ("error" in conv) return res.status(400).json({ message: conv.error });
      tasaReembolso = conv.tasa;
      montoReembolso = convertirDesdePrincipal(excedente, monedaReembolso, tasas, principal);
      if (config?.moduloCaja) {
        const caja = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
        if (!caja) {
          return res.status(409).json({ message: "Hay dinero que reembolsar: abre la caja antes de registrar la devolución." });
        }
        cajaSesionId = caja.id;
      }
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      const devolucion = await tx.devolucion.create({
        data: {
          ordenId: id,
          userId: req.user?.id ?? null,
          motivo: motivo || null,
          total: totalDevuelto,
          reembolso: excedente > 0.005 ? excedente : 0,
          detalles: {
            create: aDevolver.map((x) => ({
              detalleOrdenId: x.detalle.id,
              servicioId: x.detalle.servicioId,
              cantidad: x.cantidad,
              monto: x.valor.total,
            })),
          },
        },
      });

      for (const x of aDevolver) {
        await tx.detalleOrden.update({
          where: { id: x.detalle.id },
          data: { cantidadDevuelta: { increment: x.cantidad } },
        });

        if (!x.detalle.servicio.controlaStock) continue;
        // Solo regresa al inventario lo que esta orden realmente descontó.
        const movs = await tx.inventarioMovimiento.findMany({
          where: { ordenId: id, servicioId: x.detalle.servicioId, motivo: { in: ["VENTA", "DEVOLUCION"] } },
        });
        const descontado = movs.reduce((s, m) => s + (m.tipo === "SALIDA" ? m.cantidad : -m.cantidad), 0);
        const regresa = Math.min(x.cantidad, Math.max(descontado, 0));
        if (regresa <= 0) continue;
        const srv = await tx.servicio.update({
          where: { id: x.detalle.servicioId },
          data: { stockActual: { increment: regresa } },
        });
        await tx.inventarioMovimiento.create({
          data: {
            servicioId: x.detalle.servicioId,
            tipo: "ENTRADA",
            cantidad: regresa,
            motivo: "DEVOLUCION",
            ordenId: id,
            stockResultante: srv.stockActual,
            userId: req.user?.id ?? null,
            nota: `Devolución parcial - ref. #${id}`,
          },
        });
      }

      if (excedente > 0.005) {
        await tx.pago.create({
          data: {
            ordenId: id,
            monto: -montoReembolso,
            moneda: monedaReembolso,
            metodoPago,
            tasa: tasaReembolso,
            nota: `Reembolso por devolución #${devolucion.id}`,
            cajaSesionId,
          },
        });
      }

      await tx.orden.update({
        where: { id },
        data: {
          total: agregado.total,
          subtotal: agregado.subtotal,
          descuento: agregado.descuento,
          impuesto: agregado.impuesto,
          devuelto: { increment: totalDevuelto },
          ...(todoDevuelto && { estado: "CANCELADO" }),
        },
      });
      await recalcularEstadoOrden(id, tx as any);

      if (todoDevuelto) {
        await tx.orden.update({ where: { id }, data: { faltante: 0 } });
      }

      return tx.orden.findUnique({
        where: { id },
        include: {
          cliente: true,
          pagos: { include: { vueltos: true } },
          devoluciones: { include: { detalles: true }, orderBy: { fecha: "desc" } },
          detalles: { include: { servicio: { select: SERVICIO_RESUMEN } } },
        },
      });
    });

    return res.status(201).json(actualizada);
  } catch (error) {
    console.error("Error al registrar devolución:", error);
    return res.status(500).json({ message: "Error al registrar la devolución" });
  }
}

class ErrorHttp extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function deleteOrden(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const existente = await prisma.orden.findUnique({
      where: { id: Number(id) },
    });

    if (!existente) {
      return res
        .status(404)
        .json({ message: "Orden no encontrada para eliminar." });
    }

    await prisma.$transaction(async (tx) => {
      // Si la orden había descontado stock, se devuelve antes de borrarla.
      await devolverStockDeOrden(tx, Number(id), (req as AuthRequest).user?.id, "Eliminación");

      // Primero borramos detalles y pagos asociados por integridad referencial
      await tx.devolucionDetalle.deleteMany({ where: { devolucion: { ordenId: Number(id) } } });
      await tx.devolucion.deleteMany({ where: { ordenId: Number(id) } });
      await tx.detalleOrden.deleteMany({ where: { ordenId: Number(id) } });
      await tx.pago.deleteMany({ where: { ordenId: Number(id) } });

      // Finalmente borramos la orden
      await tx.orden.delete({ where: { id: Number(id) } });
    });

    return res.status(204).send();
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Orden no encontrada para eliminar." });
      }
    }
    console.error("Error al eliminar orden:", error);
    return res.status(500).json({ message: "Error al eliminar orden" });
  }
}

export async function actualizarObservacion(req: Request, res: Response) {
  const { id } = req.params;
  const result = ObservacionUpdateSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validación fallida",
      detalles: result.error.format(),
    });
  }

  const { observaciones } = result.data;

  try {
    await prisma.orden.update({
      where: { id: Number(id) },
      data: { observaciones },
    });

    const actualizada = await prisma.orden.findUnique({
      where: { id: Number(id) },
      include: {
        cliente: true,
        pagos: { include: { vueltos: true } },
        detalles: {
          include: {
            servicio: {
              select: {
                id: true,
                nombreServicio: true,
                descripcion: true,
                precioBase: true,
                permiteDecimales: true,
                categoriaId: true,
              },
            },
          },
        },
        deliveredBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!actualizada) {
      return res.status(404).json({
        message: "Orden no encontrada después de actualizar observaciones.",
      });
    }

    return res.status(200).json(actualizada);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).json({
          message: "Orden no encontrada para actualizar observaciones.",
        });
      }
    }
    console.error("Error al actualizar observaciones:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar observaciones" });
  }
}
