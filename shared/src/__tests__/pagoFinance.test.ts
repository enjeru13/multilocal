import { describe, it, expect } from "vitest";
import {
  calcularTotalAbonado,
  calcularResumenPago,
  obtenerEstadoPagoRaw,
  obtenerEstadoPagoTexto,
} from "../utils/pagoFinance";

const tasas = { VES: 500, COP: 4000 };

describe("calcularTotalAbonado", () => {
  it("suma pagos en USD", () => {
    expect(calcularTotalAbonado([{ monto: 5, moneda: "USD" }, { monto: 3.5, moneda: "USD" }], tasas)).toBe(8.5);
  });

  it("convierte VES usando la tasa CONGELADA del pago, no la actual", () => {
    // pago hecho cuando el dólar valía 400 Bs; hoy vale 500
    const pagos = [{ monto: 800, moneda: "VES" as const, tasa: 400 }];
    expect(calcularTotalAbonado(pagos, { VES: 500 })).toBe(2);
  });

  it("si la tasa guardada es 1 en moneda no-USD (bug histórico 1:1) usa la tasa actual", () => {
    const pagos = [{ monto: 1000, moneda: "VES" as const, tasa: 1 }];
    expect(calcularTotalAbonado(pagos, { VES: 500 })).toBe(2);
  });

  it("si la tasa guardada es 0 o null usa la tasa actual", () => {
    expect(calcularTotalAbonado([{ monto: 1000, moneda: "VES", tasa: 0 }], tasas)).toBe(2);
    expect(calcularTotalAbonado([{ monto: 1000, moneda: "VES", tasa: null }], tasas)).toBe(2);
  });

  it("resta los vueltos usando la MISMA tasa del pago", () => {
    // paga 10 USD, le devuelven 300 Bs a tasa 500 (=0.6 USD)
    const pagos = [{ monto: 10, moneda: "USD" as const, vueltos: [{ monto: 300, moneda: "VES" }] }];
    expect(calcularTotalAbonado(pagos, tasas)).toBe(9.4);
  });

  it("un reembolso (pago negativo con vueltos negativos) anula exactamente el cobro original", () => {
    const original = { monto: 10, moneda: "USD" as const, tasa: 1, vueltos: [{ monto: 300, moneda: "VES" }] };
    const reembolso = { monto: -10, moneda: "USD" as const, tasa: 1, vueltos: [{ monto: -300, moneda: "VES" }] };
    expect(calcularTotalAbonado([original, reembolso], tasas)).toBe(0);
  });

  it("sin pagos es 0", () => {
    expect(calcularTotalAbonado([], tasas)).toBe(0);
    expect(calcularTotalAbonado(undefined, tasas)).toBe(0);
  });

  it("mezcla monedas", () => {
    const pagos = [
      { monto: 4, moneda: "USD" as const },
      { monto: 1000, moneda: "VES" as const, tasa: 500 },
      { monto: 8000, moneda: "COP" as const, tasa: 4000 },
    ];
    expect(calcularTotalAbonado(pagos, tasas)).toBe(8);
  });
});

describe("estado de pago (umbral 0.005)", () => {
  it("COMPLETO cuando abonado >= total - 0.005", () => {
    expect(obtenerEstadoPagoRaw(10, 10)).toBe("COMPLETO");
    expect(obtenerEstadoPagoRaw(10, 9.996)).toBe("COMPLETO");
    expect(obtenerEstadoPagoRaw(10, 9.99)).toBe("INCOMPLETO");
    expect(obtenerEstadoPagoRaw(10, 12)).toBe("COMPLETO");
  });
  it("texto: sin pagos / parcial / pagado", () => {
    expect(obtenerEstadoPagoTexto(10, 0)).toBe("Sin pagos");
    expect(obtenerEstadoPagoTexto(10, 4)).toBe("Parcial");
    expect(obtenerEstadoPagoTexto(10, 10)).toBe("Pagado");
  });
});

describe("calcularResumenPago", () => {
  it("calcula abonado, faltante y estado", () => {
    const r = calcularResumenPago({ total: 20, pagos: [{ monto: 8, moneda: "USD" }] }, tasas);
    expect(r).toMatchObject({ abonado: 8, faltante: 12, estadoRaw: "INCOMPLETO", estadoTexto: "Parcial" });
  });
  it("el faltante nunca es negativo si se paga de más", () => {
    const r = calcularResumenPago({ total: 20, pagos: [{ monto: 25, moneda: "USD" }] }, tasas);
    expect(r.faltante).toBe(0);
    expect(r.estadoRaw).toBe("COMPLETO");
  });
  it("orden sin pagos", () => {
    const r = calcularResumenPago({ total: 20 }, tasas);
    expect(r).toMatchObject({ abonado: 0, faltante: 20, estadoTexto: "Sin pagos" });
  });
  it("pago mixto USD + VES completa la orden", () => {
    const r = calcularResumenPago(
      { total: 12, pagos: [{ monto: 10, moneda: "USD" }, { monto: 1000, moneda: "VES", tasa: 500 }] },
      tasas
    );
    expect(r.estadoRaw).toBe("COMPLETO");
    expect(r.faltante).toBe(0);
  });
});
