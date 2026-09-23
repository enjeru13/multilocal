import { Request, Response } from "express";
import prisma from "../lib/prisma";
import {
  ordenSchema,
  ordenUpdateSchema,
  ObservacionUpdateSchema,
} from "../schemas/orden.schema";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import dayjs from "dayjs";
import { Role } from "@prisma/client";

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
    const cobrados = orden.pagos.filter((p) => p.monto > 0);
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
            moneda: p.moneda,
            metodoPago: p.metodoPago,
            tasa: p.tasa,
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
        include: { cliente: true, pagos: true, detalles: { include: { servicio: true } } },
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
        pagos: true,
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
        pagos: true,
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

    let total = 0;
    const detalleData: Array<{
      servicioId: number;
      cantidad: number;
      precioUnit: number;
      costoUnit: number | null;
      subtotal: number;
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

      // CAMBIO CLAVE: Priorizamos el precio personalizado enviado desde el frontend (item.precio)
      // Usamos cast (item as any) por si el schema de Zod aún no incluye 'precio' explícitamente
      const precioInput = (item as any).precio;
      const precioUnit =
        precioInput !== undefined
          ? Number(precioInput)
          : Number(servicio.precioBase);

      const subtotal = precioUnit * item.cantidad;

      detalleData.push({
        servicioId: item.servicioId,
        cantidad: item.cantidad,
        precioUnit: parseFloat(precioUnit.toFixed(2)),
        // Costo congelado al vender: base para reportes de ganancia.
        costoUnit: servicio.controlaStock ? servicio.costoBase : null,
        subtotal: parseFloat(subtotal.toFixed(2)),
      });
      total += subtotal;
    }

    const orden = await prisma.$transaction(async (tx) => {
      const nuevaOrden = await tx.orden.create({
        data: {
          clienteId: clienteId ?? null,
          tipo: tipoDocumento,
          estado: estadoFinal,
          total: parseFloat(total.toFixed(2)),
          observaciones,
          fechaEntrega: entregaInmediata
            ? new Date()
            : fechaEntrega
            ? dayjs(fechaEntrega).toDate()
            : null,
          ...(entregaInmediata && req.user
            ? {
                deliveredByUserId: req.user.id,
                deliveredByUserName: req.user.name || req.user.email,
              }
            : {}),
          abonado: 0,
          faltante: parseFloat(total.toFixed(2)),
          estadoPago: "INCOMPLETO",
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
        },
      });
    });

    return res.status(201).json(orden);
  } catch (error) {
    console.error("Error al crear orden:", error);
    return res.status(500).json({ message: "Error al crear orden" });
  }
}

// --- FUNCIÓN UPDATE ORDEN MEJORADA ---
export async function updateOrden(req: AuthRequest, res: Response) {
  const { id } = req.params;

  // Validamos con Zod.
  const result = ordenUpdateSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Validación fallida",
      detalles: result.error.format(),
    });
  }

  // Extraemos los datos del body.
  const {
    fechaEntrega,
    estado,
    deliveredByUserId,
    deliveredByUserName,
    servicios, // Array de { servicioId, cantidad, precio? } para reemplazo total
    observaciones,
    ...rest
  } = req.body as any;

  try {
    // 1. Buscar la orden actual para tener referencias
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

    const config = await prisma.configuracion.findFirst();
    const deducirAlEntregar =
      !!config?.moduloInventario && config?.deduccionStockEn === "ENTREGA";

    // 2. Usamos una transacción para asegurar la integridad de los datos
    const ordenActualizada = await prisma.$transaction(async (tx) => {
      // Preparar objeto de actualización básico
      let datosActualizados: any = {
        ...rest,
        ...(estado !== undefined && { estado }),
        ...(observaciones !== undefined && { observaciones }),
      };

      // Lógica para fecha de entrega
      if (fechaEntrega !== undefined) {
        datosActualizados.fechaEntrega =
          fechaEntrega === null ? null : dayjs(fechaEntrega).toDate();
      }

      // Lógica automática para "Entregado Por"
      if (
        estado === "ENTREGADO" &&
        ordenActual.estado !== "ENTREGADO" &&
        req.user &&
        !ordenActual.deliveredByUserId
      ) {
        datosActualizados.fechaEntrega = dayjs().toDate();
        datosActualizados.deliveredByUserId = req.user.id;
        datosActualizados.deliveredByUserName = req.user.name || req.user.email;

        // Descuento de stock al momento de entrega (si el perfil está
        // configurado así), usando las prendas/items actuales de la orden.
        if (deducirAlEntregar && !(servicios && Array.isArray(servicios) && servicios.length > 0)) {
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

      // 3. LÓGICA DE REEMPLAZO DE PRENDAS (Si se envía array de servicios)
      if (servicios && Array.isArray(servicios) && servicios.length > 0) {
        let nuevoTotal = 0;
        const nuevosDetallesData = [];

        // Calcular nuevos montos iterando los servicios enviados
        for (const item of servicios) {
          const servicioDb = await tx.servicio.findUnique({
            where: { id: item.servicioId },
          });

          if (!servicioDb) {
            throw new Error(`Servicio ID ${item.servicioId} no encontrado`);
          }

          // CAMBIO CLAVE: Usar precio personalizado si existe
          const precioInput = item.precio;
          const precioUnit =
            precioInput !== undefined
              ? Number(precioInput)
              : Number(servicioDb.precioBase);

          const subtotal = precioUnit * item.cantidad;

          nuevosDetallesData.push({
            servicioId: item.servicioId,
            cantidad: item.cantidad,
            precioUnit: parseFloat(precioUnit.toFixed(2)),
            subtotal: parseFloat(subtotal.toFixed(2)),
          });

          nuevoTotal += subtotal;
        }

        // A. Borrar detalles viejos de esta orden
        await tx.detalleOrden.deleteMany({
          where: { ordenId: Number(id) },
        });

        // B. Insertar los nuevos detalles
        await tx.detalleOrden.createMany({
          data: nuevosDetallesData.map((d) => ({ ...d, ordenId: Number(id) })),
        });

        // C. Recalcular Faltante y Estado de Pago
        const abonadoActual = Number(ordenActual.abonado);
        const nuevoFaltante = Math.max(0, nuevoTotal - abonadoActual);

        let nuevoEstadoPago = "INCOMPLETO";
        // Margen de error mínimo para flotantes
        if (nuevoFaltante <= 0.01) {
          nuevoEstadoPago = "COMPLETO";
        }

        // Agregamos los valores recalculados al update de la orden
        datosActualizados = {
          ...datosActualizados,
          total: parseFloat(nuevoTotal.toFixed(2)),
          faltante: parseFloat(nuevoFaltante.toFixed(2)),
          estadoPago: nuevoEstadoPago,
        };
      }

      // 4. Ejecutar la actualización de la orden maestra
      return await tx.orden.update({
        where: { id: Number(id) },
        data: datosActualizados,
        include: {
          cliente: true,
          pagos: true,
          detalles: {
            include: { servicio: true },
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
    });

    return res.json(ordenActualizada);
  } catch (error) {
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
        pagos: true,
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
