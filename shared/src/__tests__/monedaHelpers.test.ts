import { describe, it, expect } from "vitest";
import {
  convertirAmonedaPrincipal,
  convertirDesdePrincipal,
  parsearTasa,
  parsearMonto,
  formatearTasa,
  normalizarMoneda,
  formatearMoneda,
} from "../utils/monedaHelpers";

const tasas = { VES: 500, COP: 4000 };

describe("convertirAmonedaPrincipal", () => {
  it("no convierte si la moneda ya es la principal", () => {
    expect(convertirAmonedaPrincipal(12.5, "USD", tasas, "USD")).toBe(12.5);
  });
  it("convierte VES y COP a USD dividiendo por la tasa", () => {
    expect(convertirAmonedaPrincipal(1000, "VES", tasas)).toBe(2);
    expect(convertirAmonedaPrincipal(8000, "COP", tasas)).toBe(2);
  });
  it("devuelve 0 si no hay tasa válida (nunca convierte 1:1)", () => {
    expect(convertirAmonedaPrincipal(1000, "VES", {})).toBe(0);
    expect(convertirAmonedaPrincipal(1000, "VES", { VES: 0 })).toBe(0);
    expect(convertirAmonedaPrincipal(1000, "VES", { VES: null })).toBe(0);
  });
  it("ignora montos inválidos", () => {
    expect(convertirAmonedaPrincipal(NaN, "VES", tasas)).toBe(0);
  });
  it("redondea a 2 decimales", () => {
    expect(convertirAmonedaPrincipal(100, "VES", { VES: 3 })).toBe(33.33);
  });
});

describe("convertirDesdePrincipal", () => {
  it("multiplica por la tasa y respeta la moneda principal", () => {
    expect(convertirDesdePrincipal(2, "VES", tasas)).toBe(1000);
    expect(convertirDesdePrincipal(2, "USD", tasas)).toBe(2);
    expect(convertirDesdePrincipal(2, "COP", {})).toBe(0);
  });
  it("ida y vuelta no pierde más de un centavo", () => {
    const bs = convertirDesdePrincipal(19.99, "VES", tasas);
    expect(Math.abs(convertirAmonedaPrincipal(bs, "VES", tasas) - 19.99)).toBeLessThanOrEqual(0.01);
  });
});

describe("parseo de números", () => {
  it("parsearTasa acepta coma decimal y separador de miles", () => {
    expect(parsearTasa("535")).toBe(535);
    expect(parsearTasa("535,50")).toBe(535.5);
    expect(parsearTasa("2,500.00")).toBe(2500);
    expect(parsearTasa("")).toBeUndefined();
    expect(parsearTasa("abc")).toBeUndefined();
  });
  it("parsearMonto respeta la convención de cada moneda e ignora símbolos", () => {
    expect(parsearMonto("Bs. 12,5", "VES")).toBe(12.5);
    expect(parsearMonto("1.234,50", "VES")).toBe(1234.5);
    expect(parsearMonto("15.840", "COP")).toBe(15840);
    expect(parsearMonto("$1,234.50", "USD")).toBe(1234.5);
    expect(parsearMonto("12.5", "USD")).toBe(12.5);
    expect(parsearMonto("", "USD")).toBe(0);
    expect(parsearMonto("abc", "USD")).toBe(0);
  });
  it("normalizarMoneda cae a USD ante valores raros", () => {
    expect(normalizarMoneda("ves")).toBe("VES");
    expect(normalizarMoneda("cop")).toBe("COP");
    expect(normalizarMoneda(undefined)).toBe("USD");
    expect(normalizarMoneda("EUR")).toBe("USD");
  });
  it("formatearMoneda: COP entero sin decimales, USD con dos", () => {
    expect(formatearMoneda(12.5, "USD")).toBe("$12.50");
    expect(formatearMoneda(4000, "COP")).toMatch(/4\.000$/);
  });
  it("formatearTasa devuelve dos decimales", () => {
    expect(formatearTasa(535)).toBe("535.00");
    expect(formatearTasa("535,5")).toBe("535.50");
    expect(formatearTasa("x")).toBe("");
  });
});
