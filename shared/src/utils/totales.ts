// Cálculo de totales de una venta: descuento e impuesto. Es la única fuente de
// verdad: el servidor lo usa para guardar y el frontend para mostrar la vista
// previa, así que ambos siempre coinciden al centavo.
//
// Reglas:
//  - El descuento (en % o monto fijo) se aplica sobre el subtotal y se reparte
//    entre las líneas de forma proporcional; la última absorbe el redondeo.
//  - Con "precios incluyen impuesto" el impuesto ya viene dentro del precio
//    (se extrae); si no, se suma encima de lo que queda tras el descuento.
//  - Las líneas exentas no llevan impuesto.
//  - Cada línea se redondea a 2 decimales y el total es la suma de las líneas.

export type DescuentoTipo = "PORCENTAJE" | "MONTO";

export interface OpcionesTotales {
  impuestoActivo: boolean;
  /** Porcentaje (16 = 16 %). */
  impuestoTasa: number;
  preciosIncluyenImpuesto: boolean;
  descuentoTipo?: DescuentoTipo | null;
  descuentoValor?: number | null;
}

export interface LineaEntrada {
  subtotal: number;
  exento?: boolean;
}

export interface LineaCalculada {
  subtotal: number;
  descuento: number;
  impuesto: number;
  /** Importe sin impuesto (después del descuento). */
  base: number;
  /** Lo que paga el cliente por la línea (base + impuesto). */
  total: number;
}

export interface TotalesCalculados {
  lineas: LineaCalculada[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  base: number;
  total: number;
}

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcularDescuento(subtotal: number, tipo?: DescuentoTipo | null, valor?: number | null): number {
  if (!tipo || !valor || valor <= 0 || subtotal <= 0) return 0;
  const bruto = tipo === "PORCENTAJE" ? subtotal * (Math.min(valor, 100) / 100) : valor;
  return r2(Math.min(Math.max(bruto, 0), subtotal));
}

export function calcularTotales(entrada: LineaEntrada[], opciones: OpcionesTotales): TotalesCalculados {
  const subtotales = entrada.map((l) => r2(l.subtotal));
  const subtotal = r2(subtotales.reduce((s, n) => s + n, 0));
  const descuento = calcularDescuento(subtotal, opciones.descuentoTipo, opciones.descuentoValor);
  const tasa = opciones.impuestoActivo && opciones.impuestoTasa > 0 ? opciones.impuestoTasa / 100 : 0;

  let repartido = 0;
  const lineas: LineaCalculada[] = entrada.map((l, i) => {
    const esUltima = i === entrada.length - 1;
    const parte =
      subtotal > 0
        ? esUltima
          ? r2(descuento - repartido)
          : Math.min(r2((descuento * subtotales[i]) / subtotal), subtotales[i])
        : 0;
    const descLinea = Math.min(Math.max(parte, 0), subtotales[i]);
    repartido = r2(repartido + descLinea);

    const neto = r2(subtotales[i] - descLinea);
    const gravada = tasa > 0 && !l.exento;
    let impuesto = 0;
    let base = neto;
    let total = neto;
    if (gravada) {
      if (opciones.preciosIncluyenImpuesto) {
        impuesto = r2(neto - neto / (1 + tasa));
        base = r2(neto - impuesto);
        total = neto;
      } else {
        impuesto = r2(neto * tasa);
        base = neto;
        total = r2(neto + impuesto);
      }
    }
    return { subtotal: subtotales[i], descuento: descLinea, impuesto, base, total };
  });

  const suma = (campo: keyof LineaCalculada) => r2(lineas.reduce((s, l) => s + l[campo], 0));
  return {
    lineas,
    subtotal,
    descuento: suma("descuento"),
    impuesto: suma("impuesto"),
    base: suma("base"),
    total: suma("total"),
  };
}

// --- Devoluciones parciales ---

export interface LineaVendida {
  cantidad: number;
  cantidadDevuelta: number;
  subtotal: number;
  descuento: number;
  impuesto: number;
  base: number;
}

const parteDe = (valor: number, cantidad: number, unidades: number) =>
  cantidad > 0 ? r2((valor * unidades) / cantidad) : 0;

/** Lo que aún vale la línea tras lo ya devuelto (redondeo acumulado, sin deriva). */
export function valorVigente(l: LineaVendida) {
  const restante = (v: number) => r2(v - parteDe(v, l.cantidad, l.cantidadDevuelta));
  const base = restante(l.base);
  const impuesto = restante(l.impuesto);
  return {
    subtotal: restante(l.subtotal),
    descuento: restante(l.descuento),
    base,
    impuesto,
    total: r2(base + impuesto),
  };
}

/** Valor que se devuelve al regresar `unidades` más de la línea. */
export function valorDevolucion(l: LineaVendida, unidades: number) {
  const antes = valorVigente(l);
  const despues = valorVigente({ ...l, cantidadDevuelta: l.cantidadDevuelta + unidades });
  return {
    subtotal: r2(antes.subtotal - despues.subtotal),
    descuento: r2(antes.descuento - despues.descuento),
    base: r2(antes.base - despues.base),
    impuesto: r2(antes.impuesto - despues.impuesto),
    total: r2(antes.total - despues.total),
  };
}

/** Totales de la orden a partir de sus líneas (netas de devoluciones). */
export function agregarLineas(lineas: LineaVendida[]) {
  const vig = lineas.map(valorVigente);
  const suma = (campo: "subtotal" | "descuento" | "base" | "impuesto" | "total") =>
    r2(vig.reduce((s, v) => s + v[campo], 0));
  return {
    subtotal: suma("subtotal"),
    descuento: suma("descuento"),
    impuesto: suma("impuesto"),
    base: suma("base"),
    total: suma("total"),
  };
}
