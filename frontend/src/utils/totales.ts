import type {
  Configuracion,
  DescuentoOrden,
  Servicio,
  ServicioSeleccionado,
} from "@lavanderia/shared/types/types";
import {
  calcularTotales,
  r2,
  type OpcionesTotales,
  type TotalesCalculados,
} from "@lavanderia/shared/utils/totales";

type ConfigImpuestos = Pick<
  Configuracion,
  "impuestoActivo" | "impuestoTasa" | "preciosIncluyenImpuesto"
>;

/** Mismas opciones que usa el servidor, para que la vista previa cuadre al centavo. */
export function opcionesDeConfig(
  config: Partial<ConfigImpuestos> | null | undefined,
  descuento?: DescuentoOrden | null
): OpcionesTotales {
  return {
    impuestoActivo: !!config?.impuestoActivo,
    impuestoTasa: config?.impuestoTasa ?? 0,
    preciosIncluyenImpuesto: config?.preciosIncluyenImpuesto ?? true,
    descuentoTipo: descuento?.tipo ?? null,
    descuentoValor: descuento?.valor ?? null,
  };
}

export function totalesDeSeleccion(
  seleccion: ServicioSeleccionado[],
  catalogo: Servicio[],
  config: Partial<ConfigImpuestos> | null | undefined,
  descuento?: DescuentoOrden | null
): TotalesCalculados {
  const lineas = seleccion.map((item) => {
    const servicio = catalogo.find((s) => s.id === item.servicioId);
    const precio = item.precio ?? servicio?.precioBase ?? 0;
    return { subtotal: r2(precio * item.cantidad), exento: servicio?.exentoImpuesto };
  });
  return calcularTotales(lineas, opcionesDeConfig(config, descuento));
}
