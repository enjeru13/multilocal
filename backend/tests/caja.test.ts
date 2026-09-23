import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, resetDb, crearAdmin, configurar, crearFixtures, crearServicio, crearOrden } from "./helpers";

describe("caja", () => {
  let token: string;
  let clienteId: number;
  let servicioId: number;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    const { categoria, cliente } = await crearFixtures();
    clienteId = cliente.id;
    servicioId = (await crearServicio(categoria.id, { precioBase: 100 })).id;
    await configurar({ moduloCaja: true, tasaVES: 500 });
  });

  const pagar = (ordenId: number, data: Record<string, unknown>) =>
    api().post("/api/pagos").set(auth(token)).send({ ordenId, moneda: "USD", metodoPago: "EFECTIVO", ...data });

  it("con el módulo activo no se puede cobrar sin caja abierta", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    const res = await pagar(orden.id, { monto: 10 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/caja/i);
  });

  it("sin caja abierta no se pueden registrar movimientos ni cerrar", async () => {
    expect((await api().post("/api/caja/movimientos").set(auth(token)).send({ tipo: "INGRESO", monto: 5, concepto: "x" })).status).toBe(409);
    expect((await api().post("/api/caja/cerrar").set(auth(token)).send({ montoFinalContado: 0 })).status).toBe(409);
    expect((await api().get("/api/caja/actual").set(auth(token))).body.abierta).toBe(false);
  });

  it("abre la caja una sola vez", async () => {
    expect((await api().post("/api/caja/abrir").set(auth(token)).send({ montoInicial: 50 })).status).toBe(201);
    expect((await api().post("/api/caja/abrir").set(auth(token)).send({ montoInicial: 10 })).status).toBe(409);
  });

  it("calcula el efectivo esperado: inicial + efectivo (neto de vueltos) + ingresos - egresos", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    await pagar(orden.id, { monto: 20 }); // efectivo USD
    await pagar(orden.id, { monto: 5000, moneda: "VES" }); // 10 USD en bolívares (efectivo)
    await pagar(orden.id, { monto: 15, metodoPago: "TRANSFERENCIA" }); // no entra al efectivo
    await pagar(orden.id, { monto: 12, vueltos: [{ monto: 1000, moneda: "VES" }] }); // 12 - 2 = 10 netos
    await api().post("/api/caja/movimientos").set(auth(token)).send({ tipo: "INGRESO", monto: 5, concepto: "sencillo" });
    await api().post("/api/caja/movimientos").set(auth(token)).send({ tipo: "EGRESO", monto: 3, concepto: "bolsas" });

    const actual = (await api().get("/api/caja/actual").set(auth(token))).body;
    expect(actual.abierta).toBe(true);
    expect(actual.efectivoPagos).toBe(40); // 20 + 10 + 10
    expect(actual.otrosMetodos).toBe(15);
    expect(actual.ingresos).toBe(5);
    expect(actual.egresos).toBe(3);
    expect(actual.efectivoEsperado).toBe(92); // 50 + 40 + 5 - 3
    expect(actual.cantidadPagos).toBe(4);
  });

  it("rechaza movimientos inválidos", async () => {
    expect((await api().post("/api/caja/movimientos").set(auth(token)).send({ tipo: "EGRESO", monto: 0, concepto: "x" })).status).toBe(400);
    expect((await api().post("/api/caja/movimientos").set(auth(token)).send({ tipo: "EGRESO", monto: 5, concepto: "" })).status).toBe(400);
  });

  it("cierra con arqueo y guarda la diferencia", async () => {
    const res = await api().post("/api/caja/cerrar").set(auth(token)).send({ montoFinalContado: 90, observacionCierre: "faltaron 2" });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("CERRADA");
    expect(res.body.montoFinalSistema).toBe(92);
    expect(res.body.diferencia).toBe(-2);
  });

  it("cerrada la caja vuelve a exigirse una abierta para cobrar", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    expect((await pagar(orden.id, { monto: 1 })).status).toBe(409);
  });

  it("el historial de cierres es solo para ADMIN", async () => {
    const hist = await api().get("/api/caja/historial").set(auth(token));
    expect(hist.status).toBe(200);
    expect(hist.body).toHaveLength(1);

    await api().post("/api/usuarios").set(auth(token)).send({ email: "caj@test.com", password: "abc123", name: "Caj", role: "CAJERO" });
    const cajero = (await api().post("/api/auth/login").send({ email: "caj@test.com", password: "abc123" })).body.token;
    expect((await api().get("/api/caja/historial").set(auth(cajero))).status).toBe(403);
    expect((await api().get("/api/caja/actual").set(auth(cajero))).status).toBe(200);
  });

  it("con el módulo apagado se cobra sin caja (comportamiento de lavandería)", async () => {
    await configurar({ moduloCaja: false });
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    expect((await pagar(orden.id, { monto: 1 })).status).toBe(201);
  });
});
