import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio } from "./helpers";
import { claveDia, libroDeVentas } from "../src/lib/reportes";

describe("libro de ventas", () => {
  let admin: string;
  let hoy: string;
  let gravado: number;
  let exento: number;
  let clienteId: number;

  const libro = (query: string, token = admin) => api().get(`/api/reportes/libro-ventas?${query}`).set(auth(token));
  const vender = (servicios: { servicioId: number; cantidad: number }[], cliente: number | null = clienteId) =>
    api().post("/api/ordenes").set(auth(admin)).send({ clienteId: cliente, estado: "PENDIENTE", servicios });

  beforeAll(async () => {
    await resetDb();
    admin = (await crearAdmin()).token;
    await configurar({
      impuestoActivo: true,
      impuestoTasa: 16,
      preciosIncluyenImpuesto: false,
      moduloCaja: false,
      moduloInventario: false,
      clienteObligatorio: false,
      tasaVES: 500,
      tasaCOP: 4000,
      rif: "J-12345678-9",
      nombreNegocio: "Negocio de prueba",
    });
    const f = await crearFixtures();
    clienteId = f.cliente.id;
    await prisma.cliente.update({ where: { id: clienteId }, data: { identificacion: "V-1234567" } });
    gravado = (await crearServicio(f.categoria.id, { nombreServicio: "Gravado", precioBase: 100 })).id;
    exento = (await crearServicio(f.categoria.id, { nombreServicio: "Exento", precioBase: 50, exentoImpuesto: true })).id;
    hoy = claveDia(new Date());
  });

  it("separa exento, base imponible e IVA de cada venta", async () => {
    // 100 gravado + 16 de IVA, más 50 exento = 166
    const mixta = (await vender([{ servicioId: gravado, cantidad: 1 }, { servicioId: exento, cantidad: 1 }])).body;
    const res = await libro(`desde=${hoy}&hasta=${hoy}`);
    expect(res.status).toBe(200);
    expect(res.body.moneda).toBe("USD");
    expect(res.body.contribuyente).toMatchObject({ nombre: "Negocio de prueba", rif: "J-12345678-9" });
    const fila = res.body.filas.find((f: { id: number }) => f.id === mixta.id);
    expect(fila).toMatchObject({ identificacion: "V-1234567", total: 166, exento: 50, baseImponible: 100, iva: 16, alicuota: 16, conDevolucion: false });
    expect(res.body.totales).toMatchObject({ total: 166, exento: 50, baseImponible: 100, iva: 16 });
  });

  it("no cuenta anuladas y avisa cuántas hubo", async () => {
    const otra = (await vender([{ servicioId: exento, cantidad: 2 }], null)).body;
    await api().patch(`/api/ordenes/${otra.id}/anular`).set(auth(admin));
    const res = await libro(`desde=${hoy}&hasta=${hoy}`);
    expect(res.body.anuladas).toBe(1);
    expect(res.body.filas.some((f: { id: number }) => f.id === otra.id)).toBe(false);
  });

  it("una venta sin cliente sale como venta de mostrador", async () => {
    const m = (await vender([{ servicioId: exento, cantidad: 1 }], null)).body;
    const res = await libro(`desde=${hoy}&hasta=${hoy}`);
    const fila = res.body.filas.find((f: { id: number }) => f.id === m.id);
    expect(fila).toMatchObject({ cliente: "Venta de mostrador", identificacion: null });
  });

  it("convierte a bolívares con la tasa y las columnas suman el total", async () => {
    const res = await libro(`desde=${hoy}&hasta=${hoy}&moneda=VES`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ moneda: "VES", principal: "USD", conTasaActual: 0 });
    const f = res.body.filas[0];
    expect(f).toMatchObject({ tasa: 500, tasaDelDia: true });
    expect(f.total).toBeCloseTo(f.exento + f.baseImponible + f.iva, 2);
    expect(res.body.totales.iva).toBeCloseTo(res.body.filas.reduce((s: number, x: { iva: number }) => s + x.iva, 0), 2);
    expect(res.body.filas.find((x: { iva: number }) => x.iva > 0).iva).toBe(8000);
  });

  it("las devoluciones se descuentan y se marcan", async () => {
    const o = (await vender([{ servicioId: gravado, cantidad: 2 }])).body; // 200 + 32
    const detalleId = (await api().get(`/api/ordenes/${o.id}`).set(auth(admin))).body.detalles[0].id;
    await api().post(`/api/ordenes/${o.id}/devolucion`).set(auth(admin)).send({ items: [{ detalleId, cantidad: 1 }] });
    const res = await libro(`desde=${hoy}&hasta=${hoy}`);
    const fila = res.body.filas.find((f: { id: number }) => f.id === o.id);
    expect(fila).toMatchObject({ baseImponible: 100, iva: 16, total: 116, conDevolucion: true });
  });

  it("solo para administradores y valida las fechas y la moneda", async () => {
    await api().post("/api/usuarios").set(auth(admin)).send({ email: "emp@test.com", password: "secreto1", name: "Emp", role: "EMPLOYEE" });
    const emp = (await login("emp@test.com", "secreto1")).body.token;
    expect((await libro(`desde=${hoy}&hasta=${hoy}`, emp)).status).toBe(403);
    expect((await libro("desde=2026-13-01&hasta=2026-13-02")).status).toBe(400);
    expect((await libro(`desde=${hoy}&hasta=2020-01-01`)).status).toBe(400);
    expect((await libro(`desde=${hoy}&hasta=${hoy}&moneda=EUR`)).status).toBe(400);
  });

  it("cada venta guarda la tasa de su día y un cambio posterior no la toca", async () => {
    const antes = (await vender([{ servicioId: gravado, cantidad: 1 }])).body; // a 500
    expect(await prisma.orden.findUnique({ where: { id: antes.id }, select: { tasaVES: true, tasaCOP: true } })).toEqual({ tasaVES: 500, tasaCOP: 4000 });

    await configurar({ tasaVES: 600 });
    const despues = (await vender([{ servicioId: gravado, cantidad: 1 }])).body; // a 600
    const res = await libro(`desde=${hoy}&hasta=${hoy}&moneda=VES`);
    const fa = res.body.filas.find((x: { id: number }) => x.id === antes.id);
    const fd = res.body.filas.find((x: { id: number }) => x.id === despues.id);
    expect(fa).toMatchObject({ baseImponible: 50000, iva: 8000, tasa: 500, tasaDelDia: true });
    expect(fd).toMatchObject({ baseImponible: 60000, iva: 9600, tasa: 600, tasaDelDia: true });
    await configurar({ tasaVES: 500 });
  });

  it("una venta sin tasa guardada usa la actual y se marca", async () => {
    const vieja = (await vender([{ servicioId: gravado, cantidad: 1 }])).body;
    await prisma.orden.update({ where: { id: vieja.id }, data: { tasaVES: null, tasaCOP: null } });
    await configurar({ tasaVES: 700 });
    const res = await libro(`desde=${hoy}&hasta=${hoy}&moneda=VES`);
    expect(res.body.filas.find((x: { id: number }) => x.id === vieja.id)).toMatchObject({ baseImponible: 70000, tasa: 700, tasaDelDia: false });
    expect(res.body.conTasaActual).toBe(1);
    await configurar({ tasaVES: 500 });
  });

  it("sin ninguna tasa disponible no convierte", async () => {
    const guardadas = await prisma.orden.findMany({ select: { id: true, tasaVES: true } });
    await prisma.orden.updateMany({ data: { tasaVES: null } });
    await configurar({ tasaVES: null });
    const res = await libro(`desde=${hoy}&hasta=${hoy}&moneda=VES`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tasa de VES/);
    for (const o of guardadas) await prisma.orden.update({ where: { id: o.id }, data: { tasaVES: o.tasaVES } });
    await configurar({ tasaVES: 500 });
  });

  it("libroDeVentas ordena por fecha y trata una venta sin impuesto como exenta", () => {
    const linea = { subtotal: 10, descuento: 0, impuesto: 0, base: 10, cantidad: 1, cantidadDevuelta: 0 };
    const mk = (id: number, dia: number) => ({ id, fechaIngreso: new Date(2026, 0, dia), estado: "ENTREGADO", impuestoTasa: null, tasaVES: null, tasaCOP: null, devuelto: 0, cliente: null, detalles: [linea] });
    const r = libroDeVentas([mk(2, 5), mk(1, 3)], "USD", "USD", { VES: null, COP: null });
    expect(r.filas.map((f) => f.id)).toEqual([1, 2]);
    expect(r.totales).toEqual({ total: 20, exento: 20, baseImponible: 0, iva: 0 });
    expect(r.filas[0].alicuota).toBe(0);
  });
});
