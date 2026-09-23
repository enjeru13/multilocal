import { describe, it, expect } from "vitest";
import {
  agregarLineas,
  calcularDescuento,
  calcularTotales,
  valorDevolucion,
  valorVigente,
  type LineaVendida,
  type OpcionesTotales,
} from "../utils/totales";

const sinImpuesto: OpcionesTotales = { impuestoActivo: false, impuestoTasa: 16, preciosIncluyenImpuesto: true };
const iva16Incluido: OpcionesTotales = { impuestoActivo: true, impuestoTasa: 16, preciosIncluyenImpuesto: true };
const iva16Aparte: OpcionesTotales = { impuestoActivo: true, impuestoTasa: 16, preciosIncluyenImpuesto: false };

describe("descuento", () => {
  it("porcentaje y monto fijo, sin pasar del subtotal", () => {
    expect(calcularDescuento(200, "PORCENTAJE", 10)).toBe(20);
    expect(calcularDescuento(200, "MONTO", 35.5)).toBe(35.5);
    expect(calcularDescuento(200, "MONTO", 999)).toBe(200);
    expect(calcularDescuento(200, "PORCENTAJE", 150)).toBe(200);
  });

  it("ignora valores vacíos o negativos", () => {
    expect(calcularDescuento(100, null, 10)).toBe(0);
    expect(calcularDescuento(100, "MONTO", 0)).toBe(0);
    expect(calcularDescuento(100, "MONTO", -5)).toBe(0);
    expect(calcularDescuento(0, "PORCENTAJE", 10)).toBe(0);
  });
});

describe("calcularTotales", () => {
  it("sin impuesto ni descuento el total es el subtotal (comportamiento de siempre)", () => {
    const t = calcularTotales([{ subtotal: 20 }, { subtotal: 6.5 }], sinImpuesto);
    expect(t).toMatchObject({ subtotal: 26.5, descuento: 0, impuesto: 0, base: 26.5, total: 26.5 });
  });

  it("precios que incluyen IVA: lo extrae sin cambiar el total", () => {
    const t = calcularTotales([{ subtotal: 116 }], iva16Incluido);
    expect(t.total).toBe(116);
    expect(t.impuesto).toBe(16);
    expect(t.base).toBe(100);
  });

  it("precios sin IVA: lo suma encima", () => {
    const t = calcularTotales([{ subtotal: 100 }], iva16Aparte);
    expect(t.total).toBe(116);
    expect(t.impuesto).toBe(16);
    expect(t.base).toBe(100);
  });

  it("el descuento se aplica antes del impuesto", () => {
    const t = calcularTotales([{ subtotal: 100 }], { ...iva16Aparte, descuentoTipo: "PORCENTAJE", descuentoValor: 10 });
    expect(t.descuento).toBe(10);
    expect(t.base).toBe(90);
    expect(t.impuesto).toBe(14.4);
    expect(t.total).toBe(104.4);
  });

  it("las líneas exentas no pagan impuesto y el descuento se reparte entre todas", () => {
    const t = calcularTotales(
      [{ subtotal: 100 }, { subtotal: 100, exento: true }],
      { ...iva16Aparte, descuentoTipo: "MONTO", descuentoValor: 20 }
    );
    expect(t.lineas.map((l) => l.descuento)).toEqual([10, 10]);
    expect(t.lineas[0]).toMatchObject({ base: 90, impuesto: 14.4, total: 104.4 });
    expect(t.lineas[1]).toMatchObject({ base: 90, impuesto: 0, total: 90 });
    expect(t.total).toBe(194.4);
  });

  it("el redondeo del reparto nunca pierde ni inventa centavos", () => {
    const t = calcularTotales([{ subtotal: 10 }, { subtotal: 10 }, { subtotal: 10 }], {
      ...sinImpuesto,
      descuentoTipo: "MONTO",
      descuentoValor: 10,
    });
    expect(t.descuento).toBe(10);
    expect(t.lineas.reduce((s, l) => s + l.descuento, 0)).toBeCloseTo(10, 10);
    expect(t.total).toBe(20);
  });

  it("el total siempre es la suma de las líneas, aunque el IVA redondee raro", () => {
    const opciones: OpcionesTotales = { ...iva16Aparte };
    const t = calcularTotales([{ subtotal: 0.99 }, { subtotal: 1.99 }, { subtotal: 3.33 }], opciones);
    expect(t.total).toBeCloseTo(t.lineas.reduce((s, l) => s + l.total, 0), 10);
    for (const l of t.lineas) expect(l.total).toBeCloseTo(l.base + l.impuesto, 10);
  });

  it("descuento del 100 % deja todo en cero", () => {
    const t = calcularTotales([{ subtotal: 50 }, { subtotal: 25 }], { ...iva16Incluido, descuentoTipo: "PORCENTAJE", descuentoValor: 100 });
    expect(t.total).toBe(0);
    expect(t.impuesto).toBe(0);
  });

  it("con impuesto desactivado ignora la tasa configurada", () => {
    const t = calcularTotales([{ subtotal: 100 }], { impuestoActivo: false, impuestoTasa: 16, preciosIncluyenImpuesto: false });
    expect(t.total).toBe(100);
    expect(t.impuesto).toBe(0);
  });
});

describe("devoluciones parciales", () => {
  const linea = (o: Partial<LineaVendida> = {}): LineaVendida => ({
    cantidad: 3,
    cantidadDevuelta: 0,
    subtotal: 30,
    descuento: 0,
    impuesto: 4.14,
    base: 25.86,
    ...o,
  });

  it("devuelve la parte proporcional, con IVA y descuento", () => {
    const t = calcularTotales([{ subtotal: 30 }], { ...iva16Incluido, descuentoTipo: "PORCENTAJE", descuentoValor: 10 });
    const l = t.lineas[0];
    const vendida: LineaVendida = { cantidad: 3, cantidadDevuelta: 0, ...l };
    const d = valorDevolucion(vendida, 1);
    expect(d.total).toBeCloseTo(l.total / 3, 2);
    expect(d.impuesto + d.base).toBeCloseTo(d.total, 10);
  });

  it("devolver todo en partes suma exactamente el valor original (sin deriva por redondeo)", () => {
    const l = linea({ cantidad: 3, subtotal: 10, base: 8.62, impuesto: 1.38 });
    const original = valorVigente(l).total;
    let acumulado = 0;
    let dev = 0;
    for (let i = 0; i < 3; i++) {
      const d = valorDevolucion({ ...l, cantidadDevuelta: dev }, 1);
      acumulado += d.total;
      dev += 1;
    }
    expect(Math.round(acumulado * 100) / 100).toBe(original);
    expect(valorVigente({ ...l, cantidadDevuelta: 3 }).total).toBe(0);
  });

  it("los totales de la orden bajan al devolver", () => {
    const l1 = linea();
    const l2 = linea({ cantidad: 1, subtotal: 10, impuesto: 0, base: 10 });
    const antes = agregarLineas([l1, l2]);
    const despues = agregarLineas([{ ...l1, cantidadDevuelta: 1 }, l2]);
    expect(despues.total).toBeLessThan(antes.total);
    const d = valorDevolucion(l1, 1);
    expect(Math.round((antes.total - despues.total) * 100) / 100).toBe(d.total);
  });

  it("con decimales (kilos) también prorratea", () => {
    const l = linea({ cantidad: 2.5, subtotal: 25, impuesto: 0, base: 25 });
    expect(valorDevolucion(l, 1.25).total).toBe(12.5);
  });
});
