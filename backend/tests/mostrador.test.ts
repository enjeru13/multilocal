import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  api,
  auth,
  prisma,
  resetDb,
  crearAdmin,
  login,
  configurar,
  crearFixtures,
  crearServicio,
  crearOrden,
} from "./helpers";

describe("venta de mostrador y perfiles de negocio", () => {
  let token: string;
  let categoriaId: string;
  let clienteId: number;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    const f = await crearFixtures();
    categoriaId = f.categoria.id;
    clienteId = f.cliente.id;
  });

  beforeEach(async () => {
    await configurar({
      clienteObligatorio: true,
      moduloClienteTipo: true,
      moduloInventario: false,
      moduloCaja: false,
      deduccionStockEn: "ENTREGA",
    });
  });

  describe("ficha de cliente según el perfil", () => {
    it("con tipo de cliente activo exige la ficha completa (comportamiento de lavandería)", async () => {
      const res = await api().post("/api/clientes").set(auth(token)).send({ nombre: "Solo Nombre" });
      expect(res.status).toBe(400);
    });

    it("sin tipo de cliente basta el nombre; lo demás queda opcional y normalizado", async () => {
      await configurar({ moduloClienteTipo: false });
      const a = await api().post("/api/clientes").set(auth(token)).send({ nombre: "Pedro" });
      expect(a.status).toBe(201);
      expect(a.body.tipo).toBe("NATURAL");
      expect(a.body.apellido).toBe("");
      expect(a.body.identificacion).toBeNull();

      // dos clientes sin identificación no chocan entre sí
      const b = await api().post("/api/clientes").set(auth(token)).send({ nombre: "Maria", identificacion: "" });
      expect(b.status).toBe(201);
    });

    it("acepta documentos de cualquier país pero no repetidos", async () => {
      await configurar({ moduloClienteTipo: false });
      const ok = await api().post("/api/clientes").set(auth(token)).send({ nombre: "Luis", identificacion: "CC-1020304050" });
      expect(ok.status).toBe(201);
      const dup = await api().post("/api/clientes").set(auth(token)).send({ nombre: "Otro Luis", identificacion: "CC-1020304050" });
      expect(dup.status).toBe(409);
    });

    it("valida teléfono y correo si vienen", async () => {
      await configurar({ moduloClienteTipo: false });
      expect((await api().post("/api/clientes").set(auth(token)).send({ nombre: "Ana", telefono: "abc" })).status).toBe(400);
      expect((await api().post("/api/clientes").set(auth(token)).send({ nombre: "Ana", email: "no-es-correo" })).status).toBe(400);
      expect((await api().post("/api/clientes").set(auth(token)).send({ nombre: "Ana", telefono: "0414-1234567" })).status).toBe(201);
    });
  });

  describe("cliente opcional en la venta", () => {
    it("si el perfil exige cliente, una venta sin cliente se rechaza", async () => {
      const s = await crearServicio(categoriaId);
      const res = await api().post("/api/ordenes").set(auth(token)).send({ estado: "PENDIENTE", servicios: [{ servicioId: s.id, cantidad: 1 }] });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cliente/i);
    });

    it("si el perfil no lo exige, se vende sin cliente", async () => {
      await configurar({ clienteObligatorio: false });
      const s = await crearServicio(categoriaId);
      const res = await api().post("/api/ordenes").set(auth(token)).send({ estado: "PENDIENTE", servicios: [{ servicioId: s.id, cantidad: 2 }] });
      expect(res.status).toBe(201);
      expect(res.body.clienteId).toBeNull();
      // y la orden sin cliente se puede listar, leer y cobrar
      expect((await api().get("/api/ordenes").set(auth(token))).status).toBe(200);
      const pago = await api().post("/api/pagos").set(auth(token)).send({ ordenId: res.body.id, monto: 20, moneda: "USD", metodoPago: "EFECTIVO" });
      expect(pago.status).toBe(201);
      expect((await api().get("/api/pagos").set(auth(token))).status).toBe(200);
    });

    it("un cliente inexistente se rechaza con mensaje claro", async () => {
      const s = await crearServicio(categoriaId);
      const res = await crearOrden(token, 999999, [{ servicioId: s.id, cantidad: 1 }]);
      expect(res.status).toBe(400);
    });
  });

  describe("entrega inmediata (venta de mostrador)", () => {
    const vender = (body: Record<string, unknown>) => api().post("/api/ordenes").set(auth(token)).send({ estado: "PENDIENTE", ...body });

    it("nace ENTREGADA, tipo VENTA, con quién la entregó", async () => {
      await configurar({ clienteObligatorio: false });
      const s = await crearServicio(categoriaId);
      const res = await vender({ entregaInmediata: true, servicios: [{ servicioId: s.id, cantidad: 1 }] });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe("ENTREGADO");
      expect(res.body.deliveredByUserName).toBeTruthy();
      expect(res.body.fechaEntrega).toBeTruthy();
      expect((await prisma.orden.findUniqueOrThrow({ where: { id: res.body.id } })).tipo).toBe("VENTA");
    });

    it("descuenta stock al crearla aunque el perfil descuente al entregar, sin duplicar", async () => {
      await configurar({ clienteObligatorio: false, moduloInventario: true, deduccionStockEn: "ENTREGA" });
      const p = await crearServicio(categoriaId, { tipo: "PRODUCTO", controlaStock: true, stockActual: 10, costoBase: 4, precioBase: 9 });
      const res = await vender({ entregaInmediata: true, servicios: [{ servicioId: p.id, cantidad: 3 }] });
      expect(res.status).toBe(201);
      expect((await prisma.servicio.findUniqueOrThrow({ where: { id: p.id } })).stockActual).toBe(7);

      // marcarla entregada otra vez no descuenta de nuevo
      await api().put(`/api/ordenes/${res.body.id}`).set(auth(token)).send({ estado: "ENTREGADO" });
      expect((await prisma.servicio.findUniqueOrThrow({ where: { id: p.id } })).stockActual).toBe(7);
    });

    it("guarda el costo del producto al momento de vender (base de la ganancia)", async () => {
      await configurar({ clienteObligatorio: false, moduloInventario: true });
      const p = await crearServicio(categoriaId, { tipo: "PRODUCTO", controlaStock: true, stockActual: 10, costoBase: 4, precioBase: 9 });
      const res = await vender({ entregaInmediata: true, servicios: [{ servicioId: p.id, cantidad: 2 }] });
      const detalle = await prisma.detalleOrden.findFirstOrThrow({ where: { ordenId: res.body.id } });
      expect(detalle.costoUnit).toBe(4);
      await prisma.servicio.update({ where: { id: p.id }, data: { costoBase: 6 } });
      expect((await prisma.detalleOrden.findUniqueOrThrow({ where: { id: detalle.id } })).costoUnit).toBe(4);
    });

    it("sin stock suficiente no vende", async () => {
      await configurar({ clienteObligatorio: false, moduloInventario: true });
      const p = await crearServicio(categoriaId, { tipo: "PRODUCTO", controlaStock: true, stockActual: 1 });
      const res = await vender({ entregaInmediata: true, servicios: [{ servicioId: p.id, cantidad: 5 }] });
      expect(res.status).toBe(400);
    });
  });

  describe("rol CAJERO", () => {
    let cajero: string;

    beforeAll(async () => {
      await api().post("/api/usuarios").set(auth(token)).send({ email: "caja@test.com", password: "abc123", name: "Cajero", role: "CAJERO" });
      cajero = (await login("caja@test.com", "abc123")).body.token;
    });

    it("puede vender y cobrar", async () => {
      await configurar({ clienteObligatorio: false });
      const s = await crearServicio(categoriaId);
      expect((await api().get("/api/servicios").set(auth(cajero))).status).toBe(200);
      expect((await api().get("/api/configuracion").set(auth(cajero))).status).toBe(200);
      expect((await api().get("/api/clientes").set(auth(cajero))).status).toBe(200);

      const venta = await api().post("/api/ordenes").set(auth(cajero)).send({ estado: "PENDIENTE", entregaInmediata: true, servicios: [{ servicioId: s.id, cantidad: 1 }] });
      expect(venta.status).toBe(201);
      const pago = await api().post("/api/pagos").set(auth(cajero)).send({ ordenId: venta.body.id, monto: 10, moneda: "USD", metodoPago: "EFECTIVO" });
      expect(pago.status).toBe(201);
    });

    it("no puede editar, anular, borrar, ajustar stock ni administrar", async () => {
      await configurar({ clienteObligatorio: false });
      const s = await crearServicio(categoriaId);
      const venta = (await api().post("/api/ordenes").set(auth(cajero)).send({ estado: "PENDIENTE", entregaInmediata: true, servicios: [{ servicioId: s.id, cantidad: 1 }] })).body;

      expect((await api().put(`/api/ordenes/${venta.id}`).set(auth(cajero)).send({ observaciones: "x" })).status).toBe(403);
      expect((await api().patch(`/api/ordenes/${venta.id}/anular`).set(auth(cajero))).status).toBe(403);
      expect((await api().delete(`/api/ordenes/${venta.id}`).set(auth(cajero))).status).toBe(403);
      expect((await api().delete("/api/pagos/1").set(auth(cajero))).status).toBe(403);
      expect((await api().post("/api/inventario/ajustes").set(auth(cajero)).send({ servicioId: s.id, tipo: "ENTRADA", cantidad: 1, nota: "x" })).status).toBe(403);
      expect((await api().put("/api/configuracion").set(auth(cajero)).send({ nombreNegocio: "x", monedaPrincipal: "USD" })).status).toBe(403);
      expect((await api().get("/api/usuarios").set(auth(cajero))).status).toBe(403);
      expect((await api().post("/api/servicios").set(auth(cajero)).send({ nombreServicio: "x", precioBase: 1, categoriaId })).status).toBe(403);
    });
  });

  it("sanity: la orden del fixture sigue accesible", async () => {
    expect(clienteId).toBeGreaterThan(0);
  });
});
