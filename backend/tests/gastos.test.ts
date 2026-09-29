import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio } from "./helpers";

describe("gastos y cuentas por pagar", () => {
  let admin: string;
  let cajero: string;
  let proveedorId: number;
  let servicioId: number;

  const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const gasto = (data: Record<string, unknown>, token = admin) =>
    api().post("/api/gastos").set(auth(token)).send({ concepto: "Luz", categoria: "Servicios", monto: 10, ...data });
  const compra = (data: Record<string, unknown> = {}) =>
    api()
      .post("/api/compras")
      .set(auth(admin))
      .send({ proveedorId, detalles: [{ servicioId, cantidad: 10, costoUnit: 5 }], ...data }); // total 50
  const pagar = (id: number, data: Record<string, unknown>) =>
    api().post(`/api/compras/${id}/pagos`).set(auth(admin)).send({ metodoPago: "TRANSFERENCIA", ...data });
  const porPagar = async () => (await api().get("/api/compras/por-pagar").set(auth(admin))).body;

  beforeAll(async () => {
    await resetDb();
    admin = (await crearAdmin()).token;
    const f = await crearFixtures();
    servicioId = (await crearServicio(f.categoria.id, { nombreServicio: "Filtro", precioBase: 10, controlaStock: true, stockActual: 0 })).id;
    proveedorId = (await prisma.proveedor.create({ data: { nombre: "Distribuidora Sol" } })).id;
    await api().post("/api/usuarios").set(auth(admin)).send({ email: "caj@test.com", password: "secreto1", name: "Caj", role: "CAJERO" });
    cajero = (await login("caj@test.com", "secreto1")).body.token;
  });

  beforeEach(async () => {
    await prisma.gasto.deleteMany();
    await prisma.pagoCompra.deleteMany();
    await prisma.inventarioMovimiento.deleteMany();
    await prisma.compraDetalle.deleteMany();
    await prisma.compra.deleteMany();
    await prisma.cajaMovimiento.deleteMany();
    await prisma.cajaSesion.deleteMany();
    await configurar({ moduloCaja: false, moduloInventario: true, moduloProveedores: true, tasaVES: 500 });
  });

  describe("gastos", () => {
    it("registra un gasto en moneda principal", async () => {
      const r = await gasto({ monto: 25.5, categoria: "Alquiler", concepto: "Local" });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ monto: 25.5, moneda: "USD", tasa: 1, categoria: "Alquiler" });
    });

    it("un gasto en bolívares se convierte con la tasa y la congela", async () => {
      const r = await gasto({ monto: 5000, moneda: "VES" });
      expect(r.body).toMatchObject({ monto: 10, montoMoneda: 5000, moneda: "VES", tasa: 500 });
      await configurar({ tasaVES: 1000 });
      const lista = (await api().get(`/api/gastos?desde=${hoy()}&hasta=${hoy()}`).set(auth(admin))).body;
      expect(lista.total).toBe(10); // la tasa nueva no reescribe el pasado
    });

    it("sin tasa configurada no acepta esa moneda", async () => {
      await configurar({ tasaVES: null });
      expect((await gasto({ monto: 100, moneda: "VES" })).status).toBe(400);
    });

    it("valida los datos", async () => {
      expect((await gasto({ monto: 0 })).status).toBe(400);
      expect((await gasto({ monto: -3 })).status).toBe(400);
      expect((await gasto({ concepto: "" })).status).toBe(400);
      expect((await gasto({ fecha: "no-es-fecha" })).status).toBe(400);
    });

    it("el listado agrupa por categoría y filtra por fechas", async () => {
      await gasto({ monto: 30, categoria: "Alquiler" });
      await gasto({ monto: 10, categoria: "Alquiler" });
      await gasto({ monto: 5, categoria: "Transporte" });
      await gasto({ monto: 99, categoria: "Otros", fecha: "2025-01-10T12:00:00" });
      const r = (await api().get(`/api/gastos?desde=${hoy()}&hasta=${hoy()}`).set(auth(admin))).body;
      expect(r.total).toBe(45);
      expect(r.porCategoria).toEqual([
        { categoria: "Alquiler", monto: 40 },
        { categoria: "Transporte", monto: 5 },
      ]);
      const viejo = (await api().get("/api/gastos?desde=2025-01-01&hasta=2025-01-31").set(auth(admin))).body;
      expect(viejo.total).toBe(99);
    });

    it("el cajero no ve ni registra gastos", async () => {
      expect((await gasto({}, cajero)).status).toBe(403);
      expect((await api().get("/api/gastos").set(auth(cajero))).status).toBe(403);
    });

    it("con caja activa, el efectivo sale de la caja como egreso", async () => {
      await configurar({ moduloCaja: true });
      expect((await gasto({ monto: 8 })).status).toBe(409); // sin caja abierta
      const caja = (await api().post("/api/caja/abrir").set(auth(admin)).send({ montoInicial: 100 })).body;
      const g = await gasto({ monto: 8, concepto: "Agua" });
      expect(g.status).toBe(201);
      const resumen = (await api().get("/api/caja/actual").set(auth(admin))).body;
      expect(resumen.egresos).toBe(8);
      expect(resumen.efectivoEsperado).toBe(92);
      expect(g.body.cajaMovimientoId).not.toBeNull();
      expect(caja.id).toBeGreaterThan(0);
    });

    it("una transferencia no toca la caja", async () => {
      await configurar({ moduloCaja: true });
      const g = await gasto({ monto: 8, metodoPago: "TRANSFERENCIA" });
      expect(g.status).toBe(201);
      expect(g.body.cajaMovimientoId).toBeNull();
    });

    it("borrar un gasto de caja abierta quita también el egreso; con caja cerrada no deja", async () => {
      await configurar({ moduloCaja: true });
      const caja = (await api().post("/api/caja/abrir").set(auth(admin)).send({ montoInicial: 50 })).body;
      const g = (await gasto({ monto: 8 })).body;
      expect((await api().delete(`/api/gastos/${g.id}`).set(auth(admin))).status).toBe(204);
      expect(await prisma.cajaMovimiento.count()).toBe(0);

      const g2 = (await gasto({ monto: 4 })).body;
      await api().post("/api/caja/cerrar").set(auth(admin)).send({ montoFinalContado: 46 });
      expect((await api().delete(`/api/gastos/${g2.id}`).set(auth(admin))).status).toBe(409);
      expect(caja.id).toBeGreaterThan(0);
    });

    it("los gastos son solo del administrador: un empleado normal no los ve, registra ni borra", async () => {
      const g = (await gasto({})).body;
      const emp = await api().post("/api/usuarios").set(auth(admin)).send({ email: "emp@test.com", password: "secreto1", name: "E", role: "EMPLOYEE" });
      expect(emp.status).toBe(201);
      const tokenEmp = (await login("emp@test.com", "secreto1")).body.token;
      expect((await gasto({}, tokenEmp)).status).toBe(403);
      expect((await api().get("/api/gastos").set(auth(tokenEmp))).status).toBe(403);
      expect((await api().delete(`/api/gastos/${g.id}`).set(auth(tokenEmp))).status).toBe(403);
    });
  });

  describe("cuentas por pagar", () => {
    it("una compra recibida se considera pagada por completo (como siempre)", async () => {
      const r = await compra();
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ total: 50, montoPagado: 50, saldo: 0 });
      expect((await porPagar()).total).toBe(0);
    });

    it("a crédito: queda el saldo, con vencimiento y proveedor", async () => {
      const r = await compra({ pagoInicial: 0, fechaVencimiento: "2020-01-01" });
      expect(r.body).toMatchObject({ montoPagado: 0, saldo: 50 });
      const lista = await porPagar();
      expect(lista).toMatchObject({ total: 50, vencido: 50 });
      expect(lista.proveedores[0]).toMatchObject({ nombre: "Distribuidora Sol", saldo: 50, vencido: 50, compras: 1 });
      expect(lista.compras[0].vencida).toBe(true);
    });

    it("pago inicial parcial y pagos posteriores bajan el saldo hasta saldarla", async () => {
      const c = (await compra({ pagoInicial: 20 })).body;
      expect(c.saldo).toBe(30);
      const p1 = await pagar(c.id, { monto: 10 });
      expect(p1.status).toBe(201);
      expect(p1.body).toMatchObject({ montoPagado: 30, saldo: 20 });
      const p2 = await pagar(c.id, { monto: 20 });
      expect(p2.body.saldo).toBe(0);
      expect((await porPagar()).compras).toHaveLength(0);
      expect((await pagar(c.id, { monto: 1 })).status).toBe(409); // ya saldada
    });

    it("no permite pagar más de lo que se debe ni un pago inicial mayor al total", async () => {
      const c = (await compra({ pagoInicial: 0 })).body;
      expect((await pagar(c.id, { monto: 51 })).status).toBe(400);
      expect((await compra({ pagoInicial: 999 })).status).toBe(400);
    });

    it("un pago en bolívares se convierte con la tasa del día", async () => {
      const c = (await compra({ pagoInicial: 0 })).body;
      const r = await pagar(c.id, { monto: 5000, moneda: "VES" }); // 10 USD
      expect(r.body).toMatchObject({ montoPagado: 10, saldo: 40 });
      expect(r.body.pagos[0]).toMatchObject({ moneda: "VES", montoMoneda: 5000, monto: 10, tasa: 500 });
    });

    it("un pedido pendiente nace sin pagar; una compra con pagos no se puede cancelar", async () => {
      const pendiente = (await compra({ estado: "PENDIENTE" })).body;
      expect(pendiente).toMatchObject({ montoPagado: 0, saldo: 50 });
      await pagar(pendiente.id, { monto: 5 });
      const cancel = await api().patch(`/api/compras/${pendiente.id}/cancelar`).set(auth(admin));
      expect(cancel.status).toBe(409);

      const sinPagos = (await compra({ estado: "PENDIENTE" })).body;
      expect((await api().patch(`/api/compras/${sinPagos.id}/cancelar`).set(auth(admin))).status).toBe(200);
      expect((await porPagar()).compras.map((x: { id: number }) => x.id)).toEqual([pendiente.id]);
    });

    it("con caja activa, pagar en efectivo saca el dinero de la caja", async () => {
      await configurar({ moduloCaja: true });
      const c = (await compra({ pagoInicial: 0 })).body;
      expect((await pagar(c.id, { monto: 10, metodoPago: "EFECTIVO" })).status).toBe(409); // sin caja
      await api().post("/api/caja/abrir").set(auth(admin)).send({ montoInicial: 100 });
      expect((await pagar(c.id, { monto: 10, metodoPago: "EFECTIVO" })).status).toBe(201);
      const resumen = (await api().get("/api/caja/actual").set(auth(admin))).body;
      expect(resumen.egresos).toBe(10);
      // fuera de caja (p. ej. lo pagó el dueño de su bolsillo)
      expect((await pagar(c.id, { monto: 5, metodoPago: "EFECTIVO", desdeCaja: false })).status).toBe(201);
      expect((await api().get("/api/caja/actual").set(auth(admin))).body.egresos).toBe(10);
    });

    it("el cajero no ve las cuentas por pagar", async () => {
      expect((await api().get("/api/compras/por-pagar").set(auth(cajero))).status).toBe(403);
    });
  });

  describe("en los reportes", () => {
    it("muestra gastos por categoría, lo que se debe y la ganancia neta", async () => {
      await configurar({ moduloFechaEntrega: false, clienteObligatorio: false });
      await prisma.servicio.update({ where: { id: servicioId }, data: { stockActual: 100, costoBase: 4 } });
      const venta = await api().post("/api/ordenes").set(auth(admin)).send({ clienteId: null, estado: "PENDIENTE", entregaInmediata: true, servicios: [{ servicioId, cantidad: 5 }] });
      expect(venta.status).toBe(201); // total 50, costo 20 -> ganancia 30
      await gasto({ monto: 12, categoria: "Alquiler" });
      await gasto({ monto: 3, categoria: "Transporte" });
      await compra({ pagoInicial: 0 });

      const r = (await api().get(`/api/reportes/resumen?desde=${hoy()}&hasta=${hoy()}`).set(auth(admin))).body;
      expect(r.gastos.total).toBe(15);
      expect(r.gastos.porCategoria[0]).toEqual({ categoria: "Alquiler", monto: 12 });
      expect(r.ganancia.ganancia).toBe(30);
      expect(r.gastos.gananciaNeta).toBe(15);
      expect(r.porPagar).toEqual({ cantidad: 1, monto: 50 });
    });
  });
});
