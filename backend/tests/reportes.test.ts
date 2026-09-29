import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio, crearOrden } from "./helpers";
import { claveDia, clavesDelRango, elegirAgrupacion, parseFechaLocal } from "../src/lib/reportes";

describe("reportes y dashboard", () => {
  let token: string;
  let hoy: string;
  let itemCosto: number;
  let itemSinCosto: number;
  let ordenAntigua: number;

  const resumen = (desde: string, hasta: string, t = token) =>
    api().get(`/api/reportes/resumen?desde=${desde}&hasta=${hasta}`).set(auth(t));
  const pagar = (ordenId: number, data: Record<string, unknown>) =>
    api().post("/api/pagos").set(auth(token)).send({ ordenId, metodoPago: "EFECTIVO", ...data });

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    await configurar({ moduloCaja: false, moduloInventario: false, tasaVES: 500, tasaCOP: 4000 });
    const { categoria, cliente } = await crearFixtures();
    hoy = claveDia(new Date());

    itemCosto = (
      await crearServicio(categoria.id, { nombreServicio: "Con costo", precioBase: 10, controlaStock: true, costoBase: 4, stockActual: 100 })
    ).id;
    itemSinCosto = (await crearServicio(categoria.id, { nombreServicio: "Sin costo", precioBase: 6 })).id;

    // A: 2 x 10 = 20, paga 5000 VES (=10 USD)
    const a = (await crearOrden(token, cliente.id, [{ servicioId: itemCosto, cantidad: 2 }])).body;
    await pagar(a.id, { monto: 5000, moneda: "VES" });
    // B: 6, paga 6 USD
    const b = (await crearOrden(token, cliente.id, [{ servicioId: itemSinCosto, cantidad: 1 }])).body;
    await pagar(b.id, { monto: 6, moneda: "USD" });
    // C: anulada; no debe contar en ventas ni en cobros
    const c = (await crearOrden(token, cliente.id, [{ servicioId: itemSinCosto, cantidad: 1 }])).body;
    await pagar(c.id, { monto: 6, moneda: "USD" });
    await api().patch(`/api/ordenes/${c.id}/anular`).set(auth(token));
    // D: enero, fuera del rango de hoy
    const d = (await crearOrden(token, cliente.id, [{ servicioId: itemSinCosto, cantidad: 5 }])).body;
    ordenAntigua = d.id;
    await prisma.orden.update({ where: { id: d.id }, data: { fechaIngreso: new Date(2026, 0, 15, 10, 0, 0) } });
  });

  describe("resumen del periodo", () => {
    it("suma ventas y cobros del rango sin contar anuladas ni otras fechas", async () => {
      const res = await resumen(hoy, hoy);
      expect(res.status).toBe(200);
      expect(res.body.moneda).toBe("USD");
      expect(res.body.ventas).toMatchObject({ cantidad: 2, canceladas: 1, total: 26, ticketPromedio: 13 });
      expect(res.body.cobros.total).toBe(16);
      expect(res.body.cobros.porMetodo).toEqual([{ metodo: "EFECTIVO", monto: 16 }]);
    });

    it("informa lo recibido por moneda con su valor original", async () => {
      const res = await resumen(hoy, hoy);
      const ves = res.body.cobros.porMoneda.find((m: { moneda: string }) => m.moneda === "VES");
      expect(ves).toMatchObject({ recibido: 5000, vueltos: 0, neto: 5000 });
    });

    it("calcula la ganancia solo sobre líneas con costo y reporta las demás", async () => {
      const { ganancia } = (await resumen(hoy, hoy)).body;
      expect(ganancia).toMatchObject({ ventaConCosto: 20, costo: 8, ganancia: 12, margen: 60, ventaSinCosto: 6, lineasSinCosto: 1 });
    });

    it("ordena los productos por venta e incluye su ganancia", async () => {
      const { topItems } = (await resumen(hoy, hoy)).body;
      expect(topItems.map((i: { nombre: string }) => i.nombre)).toEqual(["Con costo", "Sin costo"]);
      expect(topItems[0]).toMatchObject({ cantidad: 2, total: 20, ganancia: 12 });
      expect(topItems[1].ganancia).toBeNull();
    });

    it("la serie diaria trae un punto por día, sin huecos", async () => {
      const res = await resumen("2026-01-14", "2026-01-16");
      expect(res.body.rango.agrupar).toBe("dia");
      expect(res.body.serie.map((s: { fecha: string }) => s.fecha)).toEqual(["2026-01-14", "2026-01-15", "2026-01-16"]);
      expect(res.body.serie[1]).toMatchObject({ ventas: 30, cantidad: 1 });
      expect(res.body.serie[0].ventas).toBe(0);
    });

    it("agrupa por mes cuando el rango es largo", async () => {
      const res = await resumen("2026-01-01", "2026-12-31");
      expect(res.body.rango.agrupar).toBe("mes");
      expect(res.body.serie).toHaveLength(12);
      expect(res.body.serie[0]).toMatchObject({ fecha: "2026-01", ventas: 30 });
    });

    it("cuentas por cobrar cuenta todo lo pendiente, sin importar el rango, y no las anuladas", async () => {
      const { porCobrar } = (await resumen(hoy, hoy)).body;
      // A debe 10, D debe 30 (B pagada, C anulada)
      expect(porCobrar).toEqual({ cantidad: 2, monto: 40 });
    });

    it("compara con el periodo anterior de igual duración", async () => {
      const res = await resumen("2026-02-01", "2026-02-14");
      expect(res.body.ventas.total).toBe(0);
      const enero = await resumen("2026-01-15", "2026-01-15");
      expect(enero.body.comparacion.variacionVentas).toBeNull(); // sin ventas previas no hay %
      const siguiente = await resumen("2026-01-16", "2026-01-16");
      expect(siguiente.body.comparacion.ventasPrevias).toBe(30);
    });

    it("valida el rango de fechas", async () => {
      expect((await resumen("2026-13-01", hoy)).status).toBe(400);
      expect((await resumen("2026-02-31", hoy)).status).toBe(400);
      expect((await resumen("2026-05-10", "2026-05-01")).status).toBe(400);
      expect((await resumen("2000-01-01", "2026-01-01")).status).toBe(400);
      expect((await api().get("/api/reportes/resumen?desde=hola&hasta=x").set(auth(token))).status).toBe(400);
    });

    it("por defecto muestra el mes en curso", async () => {
      const res = await api().get("/api/reportes/resumen").set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.rango.desde.endsWith("-01")).toBe(true);
      expect(res.body.rango.hasta).toBe(hoy);
    });

    it("solo el administrador ve el reporte; quien no está autenticado no ve nada", async () => {
      await api().post("/api/usuarios").set(auth(token)).send({ email: "caja@test.com", password: "secreto1", name: "Caja", role: "CAJERO" });
      const cajero = (await login("caja@test.com", "secreto1")).body.token;
      expect((await resumen(hoy, hoy, cajero)).status).toBe(403);
      expect((await api().get("/api/reportes/resumen")).status).toBe(401);
    });
  });

  describe("dashboard", () => {
    it("entrega las cifras de hoy y tendencia de 7 días al administrador", async () => {
      const res = await api().get("/api/reportes/dashboard").set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ moneda: "USD", ventasHoy: 26, cobradoHoy: 16, totalOrdenes: 3, pendientes: 3 });
      expect(res.body.ultimos7).toHaveLength(7);
      expect(res.body.ultimos7[6]).toMatchObject({ fecha: hoy, ventas: 26, cobrado: 16 });
      expect(res.body.porCobrar).toEqual({ cantidad: 2, monto: 40 });
    });

    it("al cajero solo le da lo operativo: nada de dinero", async () => {
      const cajero = (await login("caja@test.com", "secreto1")).body.token;
      const res = await api().get("/api/reportes/dashboard").set(auth(cajero));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ moneda: "USD", totalOrdenes: 3, pendientes: 3 });
      expect(res.body.ventasHoy).toBeUndefined();
      expect(res.body.cobradoHoy).toBeUndefined();
      expect(res.body.ultimos7).toBeUndefined();
      expect(res.body.porCobrar).toBeUndefined();
    });

    it("a un empleado (no admin) tampoco le llega el dinero", async () => {
      await api().post("/api/usuarios").set(auth(token)).send({ email: "empleado@test.com", password: "secreto1", name: "Empleado", role: "EMPLOYEE" });
      const empleado = (await login("empleado@test.com", "secreto1")).body.token;
      const res = await api().get("/api/reportes/dashboard").set(auth(empleado));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ moneda: "USD", totalOrdenes: 3, pendientes: 3 });
      expect(res.body.ventasHoy).toBeUndefined();
      expect(res.body.porCobrar).toBeUndefined();
      expect(res.body.ultimos7).toBeUndefined();
    });

    it("avisa del stock bajo", async () => {
      await prisma.servicio.update({ where: { id: itemCosto }, data: { stockActual: 1, stockMinimo: 3 } });
      const res = await api().get("/api/reportes/dashboard").set(auth(token));
      expect(res.body.stockBajo.cantidad).toBe(1);
      expect(res.body.stockBajo.items[0]).toMatchObject({ nombreServicio: "Con costo", stockActual: 1, stockMinimo: 3 });
    });
  });

  describe("utilidades de fechas", () => {
    it("rechaza fechas imposibles y acepta las válidas", () => {
      expect(parseFechaLocal("2026-02-29", false)).toBeNull();
      expect(parseFechaLocal("2028-02-29", false)).not.toBeNull();
      expect(parseFechaLocal("26-1-1", false)).toBeNull();
    });

    it("el fin de día incluye hasta el último milisegundo", () => {
      const fin = parseFechaLocal("2026-03-10", true)!;
      expect(fin.getHours()).toBe(23);
      expect(fin.getMilliseconds()).toBe(999);
    });

    it("cruza cambios de mes y años bisiestos sin saltarse días", () => {
      const claves = clavesDelRango(parseFechaLocal("2028-02-27", false)!, parseFechaLocal("2028-03-02", true)!, "dia");
      expect(claves).toEqual(["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01", "2028-03-02"]);
      const meses = clavesDelRango(parseFechaLocal("2026-11-15", false)!, parseFechaLocal("2027-02-01", true)!, "mes");
      expect(meses).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    });

    it("elige agrupación por mes pasados 92 días", () => {
      expect(elegirAgrupacion(parseFechaLocal("2026-01-01", false)!, parseFechaLocal("2026-04-02", true)!)).toBe("dia"); // 92 días
      expect(elegirAgrupacion(parseFechaLocal("2026-01-01", false)!, parseFechaLocal("2026-04-03", true)!)).toBe("mes");
    });
  });

  it("no toca la orden antigua al consultar (solo lectura)", async () => {
    const o = await prisma.orden.findUnique({ where: { id: ordenAntigua } });
    expect(o?.total).toBe(30);
  });
});
