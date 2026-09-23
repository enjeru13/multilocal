import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio } from "./helpers";

describe("descuentos, impuestos y devoluciones", () => {
  let admin: string;
  let empleado: string;
  let categoriaId: string;
  let clienteId: number;
  let item: number; // 10 c/u, gravado, con stock y costo 4
  let exento: number; // 10 c/u, exento

  const perfilBase = {
    impuestoActivo: false,
    impuestoTasa: 16,
    preciosIncluyenImpuesto: true,
    descuentoMaxPct: 100,
    moduloInventario: false,
    moduloCaja: false,
    moduloFechaEntrega: true,
    clienteObligatorio: true,
    tasaVES: 500,
    tasaCOP: 4000,
  };

  const vender = (token: string, servicios: { servicioId: number; cantidad: number; precio?: number }[], extra: Record<string, unknown> = {}) =>
    api().post("/api/ordenes").set(auth(token)).send({ clienteId, estado: "PENDIENTE", servicios, ...extra });
  const pagar = (ordenId: number, monto: number, moneda = "USD") =>
    api().post("/api/pagos").set(auth(admin)).send({ ordenId, monto, moneda, metodoPago: "EFECTIVO" });
  const leer = async (id: number) => (await api().get(`/api/ordenes/${id}`).set(auth(admin))).body;
  const devolver = (id: number, items: { detalleId: number; cantidad: number }[], extra: Record<string, unknown> = {}) =>
    api().post(`/api/ordenes/${id}/devolucion`).set(auth(admin)).send({ items, ...extra });

  beforeAll(async () => {
    await resetDb();
    admin = (await crearAdmin()).token;
    const f = await crearFixtures();
    categoriaId = f.categoria.id;
    clienteId = f.cliente.id;
    item = (await crearServicio(categoriaId, { nombreServicio: "Gravado", precioBase: 10, controlaStock: true, costoBase: 4, stockActual: 50 })).id;
    exento = (await crearServicio(categoriaId, { nombreServicio: "Exento", precioBase: 10, exentoImpuesto: true })).id;
    await api().post("/api/usuarios").set(auth(admin)).send({ email: "emp@test.com", password: "secreto1", name: "Emp", role: "EMPLOYEE" });
    empleado = (await login("emp@test.com", "secreto1")).body.token;
  });

  beforeEach(async () => {
    await prisma.cajaMovimiento.deleteMany();
    await prisma.pago.deleteMany({ where: { cajaSesionId: { not: null } } });
    await prisma.cajaSesion.deleteMany();
    await configurar(perfilBase);
  });

  describe("sin impuesto ni descuento (lavandería de siempre)", () => {
    it("el total es la suma de las líneas y el desglose queda en cero", async () => {
      const r = await vender(admin, [{ servicioId: item, cantidad: 2 }]);
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ total: 20, subtotal: 20, descuento: 0, impuesto: 0, faltante: 20, devuelto: 0 });
      expect(r.body.detalles[0]).toMatchObject({ subtotal: 20, base: 20, impuesto: 0, descuento: 0 });
    });
  });

  describe("impuesto", () => {
    it("precios con IVA incluido: el total no cambia, se extrae el impuesto", async () => {
      await configurar({ impuestoActivo: true, preciosIncluyenImpuesto: true });
      const r = await vender(admin, [{ servicioId: item, cantidad: 2 }]);
      expect(r.body).toMatchObject({ total: 20, impuesto: 2.76, impuestoTasa: 16 });
      expect(r.body.detalles[0].base).toBe(17.24);
    });

    it("precios sin IVA: se suma encima", async () => {
      await configurar({ impuestoActivo: true, preciosIncluyenImpuesto: false });
      const r = await vender(admin, [{ servicioId: item, cantidad: 2 }]);
      expect(r.body).toMatchObject({ subtotal: 20, impuesto: 3.2, total: 23.2, faltante: 23.2 });
    });

    it("los productos exentos no llevan impuesto", async () => {
      await configurar({ impuestoActivo: true, preciosIncluyenImpuesto: false });
      const r = await vender(admin, [{ servicioId: item, cantidad: 1 }, { servicioId: exento, cantidad: 1 }]);
      expect(r.body.impuesto).toBe(1.6);
      expect(r.body.total).toBe(21.6);
    });

    it("con el impuesto desactivado se ignora la tasa configurada", async () => {
      await configurar({ impuestoActivo: false, impuestoTasa: 16 });
      const r = await vender(admin, [{ servicioId: item, cantidad: 1 }]);
      expect(r.body).toMatchObject({ total: 10, impuesto: 0, impuestoTasa: null });
    });

    it("la configuración valida la tasa", async () => {
      const res = await api().put("/api/configuracion").set(auth(admin)).send({ nombreNegocio: "X", monedaPrincipal: "USD", impuestoTasa: 150 });
      expect(res.status).toBe(400);
    });
  });

  describe("descuento", () => {
    it("porcentaje: se aplica antes del impuesto y queda registrado", async () => {
      await configurar({ impuestoActivo: true, preciosIncluyenImpuesto: false });
      const r = await vender(admin, [{ servicioId: item, cantidad: 10 }], { descuento: { tipo: "PORCENTAJE", valor: 10 } });
      expect(r.body).toMatchObject({ subtotal: 100, descuento: 10, impuesto: 14.4, total: 104.4, descuentoTipo: "PORCENTAJE", descuentoValor: 10 });
    });

    it("monto fijo y nunca supera el subtotal", async () => {
      const a = await vender(admin, [{ servicioId: item, cantidad: 2 }], { descuento: { tipo: "MONTO", valor: 5 } });
      expect(a.body).toMatchObject({ descuento: 5, total: 15 });
      const b = await vender(admin, [{ servicioId: item, cantidad: 2 }], { descuento: { tipo: "MONTO", valor: 999 } });
      expect(b.body).toMatchObject({ descuento: 20, total: 0, estadoPago: "COMPLETO", faltante: 0 });
    });

    it("un descuento inválido se rechaza", async () => {
      const r = await vender(admin, [{ servicioId: item, cantidad: 1 }], { descuento: { tipo: "MONTO", valor: -3 } });
      expect(r.status).toBe(400);
    });

    it("quien no es administrador no pasa del tope del negocio", async () => {
      await configurar({ descuentoMaxPct: 10 });
      const bloqueado = await vender(empleado, [{ servicioId: item, cantidad: 10 }], { descuento: { tipo: "PORCENTAJE", valor: 25 } });
      expect(bloqueado.status).toBe(403);
      expect(bloqueado.body.message).toContain("10%");
      const dentro = await vender(empleado, [{ servicioId: item, cantidad: 10 }], { descuento: { tipo: "PORCENTAJE", valor: 10 } });
      expect(dentro.status).toBe(201);
      const admin25 = await vender(admin, [{ servicioId: item, cantidad: 10 }], { descuento: { tipo: "PORCENTAJE", valor: 25 } });
      expect(admin25.status).toBe(201);
    });

    it("el descuento en monto también respeta el tope", async () => {
      await configurar({ descuentoMaxPct: 5 });
      const r = await vender(empleado, [{ servicioId: item, cantidad: 10 }], { descuento: { tipo: "MONTO", valor: 20 } });
      expect(r.status).toBe(403);
    });
  });

  describe("editar una orden", () => {
    it("cambiar artículos recalcula el desglose y conserva el descuento y el costo", async () => {
      await configurar({ impuestoActivo: true, preciosIncluyenImpuesto: false });
      const o = (await vender(admin, [{ servicioId: item, cantidad: 2 }], { descuento: { tipo: "PORCENTAJE", valor: 10 } })).body;
      const res = await api().put(`/api/ordenes/${o.id}`).set(auth(admin)).send({ servicios: [{ servicioId: item, cantidad: 4 }] });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ subtotal: 40, descuento: 4, impuesto: 5.76, total: 41.76 });
      expect(res.body.detalles[0].costoUnit).toBe(4);
    });

    it("quitar el descuento", async () => {
      const o = (await vender(admin, [{ servicioId: item, cantidad: 2 }], { descuento: { tipo: "MONTO", valor: 5 } })).body;
      const res = await api().put(`/api/ordenes/${o.id}`).set(auth(admin)).send({ descuento: null });
      expect(res.body).toMatchObject({ descuento: 0, total: 20, descuentoTipo: null });
    });

    it("el estado de pago usa el mismo margen que el resto (0.005)", async () => {
      const o = (await vender(admin, [{ servicioId: item, cantidad: 2 }])).body;
      await pagar(o.id, 19.996);
      const res = await api().put(`/api/ordenes/${o.id}`).set(auth(admin)).send({ servicios: [{ servicioId: item, cantidad: 2 }] });
      expect(res.body.estadoPago).toBe("COMPLETO");
    });

    it("no se pueden meter totales a mano por el cuerpo de la petición", async () => {
      const o = (await vender(admin, [{ servicioId: item, cantidad: 2 }])).body;
      const res = await api().put(`/api/ordenes/${o.id}`).set(auth(admin)).send({ observaciones: "x", total: 1, abonado: 999, estadoPago: "COMPLETO" });
      expect(res.status).toBe(200);
      const despues = await leer(o.id);
      expect(despues).toMatchObject({ total: 20, abonado: 0, estadoPago: "INCOMPLETO" });
    });
  });

  describe("devolución parcial", () => {
    beforeEach(async () => {
      await configurar({ moduloInventario: true, moduloFechaEntrega: false, clienteObligatorio: false, impuestoActivo: true, preciosIncluyenImpuesto: true });
      await prisma.servicio.update({ where: { id: item }, data: { stockActual: 50 } });
    });

    const ventaPagada = async (cantidad = 4) => {
      const o = (await vender(admin, [{ servicioId: item, cantidad }], { entregaInmediata: true, clienteId: null })).body;
      await pagar(o.id, o.total);
      return leer(o.id);
    };

    it("baja el total con su parte de IVA, devuelve stock y reembolsa lo pagado de más", async () => {
      const o = await ventaPagada(4); // total 40, IVA incluido 5.52
      expect(o.abonado).toBe(40);
      const res = await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ total: 30, devuelto: 10, impuesto: 4.14, abonado: 30, faltante: 0, estadoPago: "COMPLETO", estado: "ENTREGADO" });
      expect(res.body.detalles[0].cantidadDevuelta).toBe(1);
      expect(res.body.pagos.find((p: { monto: number }) => p.monto < 0).monto).toBe(-10);
      expect(res.body.devoluciones).toHaveLength(1);
      expect((await prisma.servicio.findUnique({ where: { id: item } }))!.stockActual).toBe(47); // 50 - 4 + 1
      const mov = await prisma.inventarioMovimiento.findFirst({ where: { ordenId: o.id, motivo: "DEVOLUCION" } });
      expect(mov).toMatchObject({ tipo: "ENTRADA", cantidad: 1, stockResultante: 47 });
    });

    it("sin reembolso el cliente queda con saldo a favor y no se crea pago negativo", async () => {
      const o = await ventaPagada(2);
      const res = await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }], { reembolsar: false });
      expect(res.body.pagos.filter((p: { monto: number }) => p.monto < 0)).toHaveLength(0);
      expect(res.body).toMatchObject({ total: 10, abonado: 20, faltante: 0 });
    });

    it("si el cliente no había pagado, solo baja lo que debe", async () => {
      const o = (await vender(admin, [{ servicioId: item, cantidad: 3 }], { entregaInmediata: true, clienteId: null })).body;
      const res = await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);
      expect(res.body).toMatchObject({ total: 20, abonado: 0, faltante: 20, estadoPago: "INCOMPLETO" });
      expect(res.body.pagos).toHaveLength(0);
    });

    it("reembolsa en la moneda pedida con la tasa vigente", async () => {
      const o = await ventaPagada(2); // pagó 20 USD
      const res = await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }], { moneda: "VES" });
      const neg = res.body.pagos.find((p: { monto: number }) => p.monto < 0);
      expect(neg).toMatchObject({ moneda: "VES", monto: -5000, tasa: 500 });
      expect(res.body.abonado).toBe(10);
    });

    it("no permite devolver más de lo vendido ni de otra orden", async () => {
      const o = await ventaPagada(2);
      const otra = await ventaPagada(1);
      expect((await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 3 }])).status).toBe(400);
      expect((await devolver(o.id, [{ detalleId: otra.detalles[0].id, cantidad: 1 }])).status).toBe(400);
      await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 2 }]);
      expect((await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }])).status).toBe(409); // ya cancelada
    });

    it("devolver todo cancela la orden, deja todo en cero y devuelve el dinero", async () => {
      const o = await ventaPagada(2);
      await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);
      const res = await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);
      expect(res.body).toMatchObject({ estado: "CANCELADO", total: 0, abonado: 0, faltante: 0, devuelto: 20 });
      expect((await prisma.servicio.findUnique({ where: { id: item } }))!.stockActual).toBe(50);
    });

    it("dos devoluciones parciales suman exactamente el valor original (sin deriva de centavos)", async () => {
      const o = (await vender(admin, [{ servicioId: item, cantidad: 3, precio: 3.33 }], { entregaInmediata: true, clienteId: null })).body;
      await pagar(o.id, o.total);
      const actual = await leer(o.id);
      const d = actual.detalles[0].id;
      const a = await devolver(o.id, [{ detalleId: d, cantidad: 1 }]);
      const b = await devolver(o.id, [{ detalleId: d, cantidad: 1 }]);
      const c = await devolver(o.id, [{ detalleId: d, cantidad: 1 }]);
      expect(Math.round((a.body.devuelto + 0) * 100) / 100).toBeGreaterThan(0);
      expect(c.body.total).toBe(0);
      expect(c.body.devuelto).toBe(actual.total);
      expect(b.body.total).toBeGreaterThan(0);
    });

    it("una orden con devoluciones ya no permite cambiar artículos ni descuento", async () => {
      const o = await ventaPagada(3);
      await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);
      const res = await api().put(`/api/ordenes/${o.id}`).set(auth(admin)).send({ servicios: [{ servicioId: item, cantidad: 1 }] });
      expect(res.status).toBe(409);
    });

    it("anular después de una devolución parcial reembolsa solo el neto (sin duplicar)", async () => {
      const o = await ventaPagada(4);
      await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);
      const res = await api().patch(`/api/ordenes/${o.id}/anular`).set(auth(admin));
      expect(res.status).toBe(200);
      const pagos = (await leer(o.id)).pagos as { monto: number }[];
      expect(Math.round(pagos.reduce((s, p) => s + p.monto, 0) * 100) / 100).toBe(0);
      expect((await prisma.servicio.findUnique({ where: { id: item } }))!.stockActual).toBe(50);
    });

    it("solo administradores y empleados pueden devolver; el cajero no", async () => {
      await api().post("/api/usuarios").set(auth(admin)).send({ email: "caj@test.com", password: "secreto1", name: "Caj", role: "CAJERO" });
      const cajero = (await login("caj@test.com", "secreto1")).body.token;
      const o = await ventaPagada(2);
      const res = await api().post(`/api/ordenes/${o.id}/devolucion`).set(auth(cajero)).send({ items: [{ detalleId: o.detalles[0].id, cantidad: 1 }] });
      expect(res.status).toBe(403);
    });

    it("con caja activa exige caja abierta para reembolsar y registra el egreso en ella", async () => {
      const o = await ventaPagada(2);
      await configurar({ moduloCaja: true });
      const cerrada = await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);
      expect(cerrada.status).toBe(409);

      const caja = await api().post("/api/caja/abrir").set(auth(admin)).send({ montoInicial: 0 });
      expect(caja.status).toBe(201);
      const ok = await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);
      expect(ok.status).toBe(201);
      expect(ok.body.pagos.find((p: { monto: number }) => p.monto < 0).cajaSesionId).toBe(caja.body.id);
    });
  });

  describe("reportes con devoluciones e impuestos", () => {
    it("la ganancia y el top salen netos de lo devuelto y sin impuesto", async () => {
      await resetDb();
      admin = (await crearAdmin()).token;
      const f = await crearFixtures();
      categoriaId = f.categoria.id;
      item = (await crearServicio(categoriaId, { nombreServicio: "Gravado", precioBase: 10, controlaStock: true, costoBase: 4, stockActual: 50 })).id;
      await configurar({ ...perfilBase, moduloInventario: true, moduloFechaEntrega: false, clienteObligatorio: false, impuestoActivo: true, preciosIncluyenImpuesto: false });

      const o = (await vender(admin, [{ servicioId: item, cantidad: 4 }], { entregaInmediata: true, clienteId: null, descuento: { tipo: "PORCENTAJE", valor: 10 } })).body;
      // subtotal 40, desc 4, base 36, IVA 5.76, total 41.76
      expect(o.total).toBe(41.76);
      await pagar(o.id, o.total);
      await devolver(o.id, [{ detalleId: o.detalles[0].id, cantidad: 1 }]);

      const hoy = new Date();
      const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
      const r = (await api().get(`/api/reportes/resumen?desde=${dia}&hasta=${dia}`).set(auth(admin))).body;

      // quedan 3 u.: base 27, IVA 4.32, total 31.32, costo 12, ganancia 15
      expect(r.ventas).toMatchObject({ total: 31.32, impuestos: 4.32, descuentos: 3 });
      expect(r.ganancia).toMatchObject({ ventaConCosto: 27, costo: 12, ganancia: 15 });
      expect(r.topItems[0]).toMatchObject({ cantidad: 3, total: 31.32, ganancia: 15 });
      expect(r.devoluciones).toMatchObject({ cantidad: 1, total: 10.44 });
      expect(r.cobros.total).toBe(31.32); // pagó 41.76 y le devolvieron 10.44
    });
  });
});
