import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, resetDb, crearAdmin, configurar, crearFixtures, crearServicio, crearOrden } from "./helpers";

const guardarConfig = (token: string, data: Record<string, unknown>) =>
  api().put("/api/configuracion").set(auth(token)).send({ nombreNegocio: "Negocio Test", tasaVES: 500, tasaCOP: 4000, ...data });

describe("monedas activas", () => {
  let token: string;
  let clienteId: number;
  let servicioId: number;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    await configurar({ moduloCaja: false });
    const f = await crearFixtures();
    clienteId = f.cliente.id;
    servicioId = (await crearServicio(f.categoria.id, { precioBase: 10 })).id;
  });

  it("guarda las monedas elegidas y siempre incluye la principal", async () => {
    const r = await guardarConfig(token, { monedaPrincipal: "USD", monedasActivas: ["VES"] });
    expect(r.status).toBe(200);
    expect(r.body.monedasActivas).toBe("USD,VES");
  });

  it("no se puede cobrar en una moneda que el negocio no usa", async () => {
    await guardarConfig(token, { monedaPrincipal: "USD", monedasActivas: ["USD", "VES"] });
    const o = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    const p = await api().post("/api/pagos").set(auth(token)).send({ ordenId: o.id, monto: 40000, moneda: "COP", metodoPago: "EFECTIVO" });
    expect(p.status).toBe(400);
    expect(p.body.message).toMatch(/no trabaja en COP/);
    const ok = await api().post("/api/pagos").set(auth(token)).send({ ordenId: o.id, monto: 5000, moneda: "VES", metodoPago: "EFECTIVO" });
    expect(ok.status).toBe(201);
    expect(ok.body.tasa).toBe(500);
  });

  it("con ventas registradas no deja cambiar la moneda principal", async () => {
    const r = await guardarConfig(token, { monedaPrincipal: "VES", monedasActivas: ["USD", "VES"] });
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/moneda principal/);
  });
});

describe("moneda principal en bolívares", () => {
  let token: string;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    await configurar({ moduloCaja: false });
  });

  it("cobra en dólares y en pesos convirtiendo por la tasa cruzada", async () => {
    const r = await guardarConfig(token, { monedaPrincipal: "VES", monedasActivas: ["VES", "USD", "COP"] });
    expect(r.status).toBe(200);
    expect(r.body.monedasActivas).toBe("VES,USD,COP");

    const f = await crearFixtures();
    const s = await crearServicio(f.categoria.id, { precioBase: 2000 }); // 2000 Bs
    const o = (await crearOrden(token, f.cliente.id, [{ servicioId: s.id, cantidad: 1 }])).body;
    expect(o.total).toBe(2000);

    // 2 USD = 1000 Bs
    const p1 = await api().post("/api/pagos").set(auth(token)).send({ ordenId: o.id, monto: 2, moneda: "USD", metodoPago: "EFECTIVO" });
    expect(p1.status).toBe(201);
    expect(p1.body.tasa).toBeCloseTo(1 / 500, 8);
    expect(p1.body.orden.abonado).toBe(1000);

    // 8000 COP = 1000 Bs
    const p2 = await api().post("/api/pagos").set(auth(token)).send({ ordenId: o.id, monto: 8000, moneda: "COP", metodoPago: "EFECTIVO" });
    expect(p2.status).toBe(201);
    expect(p2.body.tasa).toBe(8);
    expect(p2.body.orden.abonado).toBe(2000);
    expect(p2.body.orden.estadoPago).toBe("COMPLETO");
  });
});
