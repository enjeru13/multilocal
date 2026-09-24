import { describe, it, expect, beforeAll } from "vitest";
import { agruparPorCobrar } from "../src/lib/reportes";
import { api, auth, resetDb, crearAdmin, configurar, crearFixtures, crearServicio, crearOrden } from "./helpers";

describe("agruparPorCobrar", () => {
  const hoy = new Date(2026, 8, 23, 12);
  const cliente = (n: string) => ({ nombre: n, apellido: "X", telefono: "0412" });
  const o = (id: number, dias: number, faltante: number, clienteId: number | null) => ({
    id,
    fechaIngreso: new Date(2026, 8, 23 - dias, 9),
    total: faltante + 5,
    abonado: 5,
    faltante,
    clienteId,
    cliente: clienteId === null ? null : cliente(`C${clienteId}`),
  });

  it("agrupa por cliente, ordena por monto y reparte la antigüedad", () => {
    const r = agruparPorCobrar([o(1, 3, 10, 1), o(2, 45, 20, 2), o(3, 100, 5, 1), o(4, 2, 1, null)], "USD", hoy);
    expect(r.cantidad).toBe(4);
    expect(r.monto).toBe(36);
    expect(r.clientes.map((c) => [c.nombre, c.monto])).toEqual([
      ["C2 X", 20],
      ["C1 X", 15],
      ["Sin cliente", 1],
    ]);
    const c1 = r.clientes.find((c) => c.clienteId === 1)!;
    expect(c1.masAntigua).toBe(100);
    expect(c1.ordenes.map((x) => x.id)).toEqual([3, 1]);
    expect(r.antiguedad.map((t) => [t.id, t.monto])).toEqual([
      ["D0_30", 11],
      ["D31_60", 20],
      ["D61_90", 0],
      ["D90_MAS", 5],
    ]);
  });
});

describe("informes por API", () => {
  let token: string;
  let clienteId: number;
  let servicioId: number;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    await configurar({ moduloCaja: true });
    const f = await crearFixtures();
    clienteId = f.cliente.id;
    servicioId = (await crearServicio(f.categoria.id, { precioBase: 10 })).id;
  });

  it("cuentas por cobrar lista solo lo que se debe", async () => {
    await api().post("/api/caja/abrir").set(auth(token)).send({ montoInicial: 0 });
    const a = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 3 }])).body; // 30
    await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }]); // 10 sin pagar
    const c = (await crearOrden(token, clienteId, [{ servicioId, cantidad: 1 }])).body; // 10 pagada
    await api().post("/api/pagos").set(auth(token)).send({ ordenId: a.id, monto: 12, moneda: "USD", metodoPago: "EFECTIVO" });
    await api().post("/api/pagos").set(auth(token)).send({ ordenId: c.id, monto: 10, moneda: "USD", metodoPago: "EFECTIVO" });

    const r = await api().get("/api/reportes/por-cobrar").set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body.cantidad).toBe(2);
    expect(r.body.monto).toBe(28);
    expect(r.body.clientes).toHaveLength(1);
    expect(r.body.clientes[0].ordenes).toHaveLength(2);
    expect(r.body.antiguedad[0]).toMatchObject({ id: "D0_30", monto: 28, cantidad: 2 });
  });

  it("el comprobante de caja trae el arqueo y quién abrió", async () => {
    const cierre = await api().post("/api/caja/cerrar").set(auth(token)).send({ contadoPorMoneda: { USD: 20 } });
    expect(cierre.status).toBe(200);
    const r = await api().get(`/api/caja/${cierre.body.id}/comprobante`).set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body.sesion.usuarioApertura.email).toBeTruthy();
    expect(r.body.porMoneda[0]).toMatchObject({ moneda: "USD", cobrado: 22, esperado: 22 });
    expect(JSON.parse(r.body.sesion.detalleCierre)[0]).toMatchObject({ contado: 20, diferencia: -2 });
    expect((await api().get("/api/caja/99999/comprobante").set(auth(token))).status).toBe(404);
  });
});
