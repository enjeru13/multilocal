import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, resetDb, crearAdmin, configurar, crearFixtures, crearServicio, crearOrden } from "./helpers";

describe("arqueo de caja por moneda", () => {
  let token: string;
  let servicioId: number;
  let clienteId: number;

  const pagar = (ordenId: number, data: Record<string, unknown>) =>
    api().post("/api/pagos").set(auth(token)).send({ ordenId, metodoPago: "EFECTIVO", ...data });
  const actual = async () => (await api().get("/api/caja/actual").set(auth(token))).body;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    await configurar({ moduloCaja: true, tasaVES: 500, tasaCOP: 4000 });
    const f = await crearFixtures();
    clienteId = f.cliente.id;
    servicioId = (await crearServicio(f.categoria.id, { precioBase: 10 })).id;
    await api().post("/api/caja/abrir").set(auth(token)).send({ montoInicial: 100 });
  });

  it("separa lo que hay de cada moneda: cobros, vueltos y movimientos", async () => {
    // Venta de 20: paga 30 USD y se da el vuelto (10 USD) en bolívares.
    const a = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 2 }])).body;
    const p = await pagar(a.id, { monto: 30, moneda: "USD", vueltos: [{ monto: 5000, moneda: "VES" }] });
    expect(p.status).toBe(201);
    // Venta de 10: paga 5000 VES en efectivo.
    const b = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    await pagar(b.id, { monto: 5000, moneda: "VES" });
    // Venta de 10 por transferencia: no entra al cajón.
    const c = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    await pagar(c.id, { monto: 10, moneda: "USD", metodoPago: "TRANSFERENCIA" });
    // Egreso en bolívares.
    await api().post("/api/caja/movimientos").set(auth(token)).send({ tipo: "EGRESO", monto: 1000, moneda: "VES", concepto: "Bolsas" });

    const r = await actual();
    const usd = r.porMoneda.find((m: { moneda: string }) => m.moneda === "USD");
    const ves = r.porMoneda.find((m: { moneda: string }) => m.moneda === "VES");
    expect(usd).toMatchObject({ inicial: 100, cobrado: 30, vueltos: 0, esperado: 130 });
    expect(ves).toMatchObject({ cobrado: 5000, vueltos: 5000, egresos: 1000, esperado: -1000 });
    expect(r.porMoneda.find((m: { moneda: string }) => m.moneda === "COP")).toBeUndefined();
    // El total en moneda principal sigue cuadrando con lo de siempre.
    expect(r.efectivoEsperado).toBe(128);
  });

  it("cierra con el conteo de cada moneda y guarda la diferencia por moneda", async () => {
    const cierre = await api()
      .post("/api/caja/cerrar")
      .set(auth(token))
      .send({ contadoPorMoneda: { USD: 128, VES: -1000 + 1000 } });
    expect(cierre.status).toBe(200);
    // contado total = 128 USD + 0 Bs = 128; esperado 128 -> diferencia 0
    expect(cierre.body).toMatchObject({ montoFinalContado: 128, montoFinalSistema: 128, diferencia: 0 });
    const detalle = JSON.parse(cierre.body.detalleCierre);
    expect(detalle.find((d: { moneda: string }) => d.moneda === "USD")).toMatchObject({ esperado: 130, contado: 128, diferencia: -2 });
    expect(detalle.find((d: { moneda: string }) => d.moneda === "VES")).toMatchObject({ esperado: -1000, contado: 0, diferencia: 1000 });
  });

  it("sin detalle por moneda el cierre funciona como siempre, pero exige algún conteo", async () => {
    await api().post("/api/caja/abrir").set(auth(token)).send({ montoInicial: 50 });
    expect((await api().post("/api/caja/cerrar").set(auth(token)).send({})).status).toBe(400);
    const ok = await api().post("/api/caja/cerrar").set(auth(token)).send({ montoFinalContado: 50 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ diferencia: 0, detalleCierre: null });
  });
});
