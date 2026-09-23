import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  api,
  auth,
  prisma,
  resetDb,
  crearAdmin,
  configurar,
  crearFixtures,
  crearServicio,
  crearOrden,
} from "./helpers";

describe("órdenes y pagos multi-moneda", () => {
  let token: string;
  let clienteId: number;
  let servicioId: number;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    const { categoria, cliente } = await crearFixtures();
    clienteId = cliente.id;
    servicioId = (await crearServicio(categoria.id, { precioBase: 10 })).id;
  });

  beforeEach(async () => {
    await configurar({ moduloCaja: false, moduloInventario: false, tasaVES: 500, tasaCOP: 4000 });
  });

  const pagar = (ordenId: number, data: Record<string, unknown>) =>
    api().post("/api/pagos").set(auth(token)).send({ ordenId, metodoPago: "EFECTIVO", ...data });
  const leer = async (id: number) => (await api().get(`/api/ordenes/${id}`).set(auth(token))).body;

  it("crea la orden con total por cantidad decimal y precio personalizado", async () => {
    const res = await crearOrden(token, clienteId, [
      { servicioId, cantidad: 2.5 },
      { servicioId, cantidad: 1, precio: 3 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(28);
    expect(res.body.faltante).toBe(28);
    expect(res.body.estadoPago).toBe("INCOMPLETO");
  });

  it("pago en USD queda con tasa 1 y actualiza abonado/faltante", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 2 }])).body;
    const pago = await pagar(orden.id, { monto: 5, moneda: "USD" });
    expect(pago.status).toBe(201);
    expect(pago.body.tasa).toBe(1);
    const o = await leer(orden.id);
    expect(o.abonado).toBe(5);
    expect(o.faltante).toBe(15);
  });

  it("pago en VES congela la tasa vigente y no cambia si la tasa sube después", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 2 }])).body; // total 20
    const p1 = await pagar(orden.id, { monto: 5000, moneda: "VES" }); // 10 USD a 500
    expect(p1.body.tasa).toBe(500);

    await configurar({ tasaVES: 1000 });
    await pagar(orden.id, { monto: 5000, moneda: "VES" }); // 5 USD a 1000
    const o = await leer(orden.id);
    expect(o.abonado).toBe(15);
    expect(o.faltante).toBe(5);
    expect(o.estadoPago).toBe("INCOMPLETO");
  });

  it("no permite cobrar en una moneda sin tasa configurada", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    await configurar({ tasaVES: null });
    const res = await pagar(orden.id, { monto: 100, moneda: "VES" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tasa/i);
    expect(await prisma.pago.count({ where: { ordenId: orden.id } })).toBe(0);
  });

  it("pago con vuelto: lo devuelto se descuenta de lo abonado", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body; // total 10
    // paga 12 USD, le devuelven 1000 Bs (= 2 USD a 500) => neto 10
    const pago = await pagar(orden.id, { monto: 12, moneda: "USD", vueltos: [{ monto: 1000, moneda: "VES" }] });
    expect(pago.status).toBe(201);
    const o = await leer(orden.id);
    expect(o.abonado).toBe(10);
    expect(o.faltante).toBe(0);
    expect(o.estadoPago).toBe("COMPLETO");
  });

  it("borrar un pago recalcula la orden", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    const pago = await pagar(orden.id, { monto: 10, moneda: "USD" });
    expect((await leer(orden.id)).estadoPago).toBe("COMPLETO");
    expect((await api().delete(`/api/pagos/${pago.body.id}`).set(auth(token))).status).toBe(204);
    const o = await leer(orden.id);
    expect(o.abonado).toBe(0);
    expect(o.estadoPago).toBe("INCOMPLETO");
  });

  it("rechaza pagos con monto inválido u orden inexistente", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    expect((await pagar(orden.id, { monto: 0, moneda: "USD" })).status).toBe(400);
    expect((await pagar(orden.id, { monto: -5, moneda: "USD" })).status).toBe(400);
    expect((await pagar(999999, { monto: 5, moneda: "USD" })).status).toBe(404);
  });

  it("rechaza órdenes sin servicios o con servicio inexistente", async () => {
    expect((await crearOrden(token, clienteId, [])).status).toBe(400);
    expect((await crearOrden(token, clienteId, [{ servicioId: 999999, cantidad: 1 }])).status).toBe(400);
  });

  it("marcar entregada registra quién entregó", async () => {
    const orden = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body;
    const res = await api().put(`/api/ordenes/${orden.id}`).set(auth(token)).send({ estado: "ENTREGADO" });
    expect(res.body.estado).toBe("ENTREGADO");
    expect(res.body.deliveredByUserName).toBeTruthy();
  });
});
