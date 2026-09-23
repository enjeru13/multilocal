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

describe("inventario, compras y anulaciones", () => {
  let token: string;
  let clienteId: number;
  let categoriaId: string;
  let proveedorId: number;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    const { categoria, cliente } = await crearFixtures();
    clienteId = cliente.id;
    categoriaId = categoria.id;
    proveedorId = (await prisma.proveedor.create({ data: { nombre: "Proveedor SA" } })).id;
  });

  beforeEach(async () => {
    await configurar({ moduloInventario: true, deduccionStockEn: "CREACION", moduloCaja: false, tasaVES: 500 });
  });

  const producto = (data: Record<string, unknown> = {}) =>
    crearServicio(categoriaId, {
      nombreServicio: "Filtro",
      tipo: "PRODUCTO",
      controlaStock: true,
      stockActual: 0,
      precioBase: 8,
      ...data,
    });
  const stock = async (id: number) => (await prisma.servicio.findUniqueOrThrow({ where: { id } })).stockActual;
  const pagarTodo = (ordenId: number, monto: number) =>
    api().post("/api/pagos").set(auth(token)).send({ ordenId, monto, moneda: "USD", metodoPago: "EFECTIVO" });

  it("una compra recibida sube el stock, guarda el costo y deja movimiento", async () => {
    const p = await producto();
    const res = await api()
      .post("/api/compras")
      .set(auth(token))
      .send({ proveedorId, detalles: [{ servicioId: p.id, cantidad: 20, costoUnit: 5 }] });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("RECIBIDA");
    expect(res.body.total).toBe(100);
    expect(await stock(p.id)).toBe(20);
    expect((await prisma.servicio.findUniqueOrThrow({ where: { id: p.id } })).costoBase).toBe(5);
    expect(await prisma.inventarioMovimiento.count({ where: { servicioId: p.id, motivo: "COMPRA" } })).toBe(1);
  });

  it("una compra pendiente no toca el stock hasta recibirla, y solo se recibe una vez", async () => {
    const p = await producto();
    const c = await api()
      .post("/api/compras")
      .set(auth(token))
      .send({ proveedorId, estado: "PENDIENTE", detalles: [{ servicioId: p.id, cantidad: 10, costoUnit: 2 }] });
    expect(await stock(p.id)).toBe(0);

    expect((await api().patch(`/api/compras/${c.body.id}/recibir`).set(auth(token))).status).toBe(200);
    expect(await stock(p.id)).toBe(10);
    expect((await api().patch(`/api/compras/${c.body.id}/recibir`).set(auth(token))).status).toBe(409);
    expect(await stock(p.id)).toBe(10);
    expect((await api().patch(`/api/compras/${c.body.id}/cancelar`).set(auth(token))).status).toBe(409);
  });

  it("vender descuenta stock y bloquea la venta si no alcanza (sin crear la orden)", async () => {
    const p = await producto({ stockActual: 10 });
    const ok = await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 3 }]);
    expect(ok.status).toBe(201);
    expect(await stock(p.id)).toBe(7);

    const ordenesAntes = await prisma.orden.count();
    const mal = await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 8 }]);
    expect(mal.status).toBe(400);
    expect(mal.body.message).toMatch(/stock insuficiente/i);
    expect(await prisma.orden.count()).toBe(ordenesAntes);
    expect(await stock(p.id)).toBe(7);
  });

  it("un ítem sin control de stock (servicio) nunca descuenta", async () => {
    const s = await crearServicio(categoriaId, { nombreServicio: "Lavado", precioBase: 3 });
    expect((await crearOrden(token, clienteId, [{ servicioId: s.id, cantidad: 100 }])).status).toBe(201);
    expect((await prisma.servicio.findUniqueOrThrow({ where: { id: s.id } })).stockActual).toBe(0);
  });

  it("con el módulo apagado la venta no toca stock (comportamiento de lavandería)", async () => {
    await configurar({ moduloInventario: false });
    const p = await producto({ stockActual: 5 });
    expect((await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 2 }])).status).toBe(201);
    expect(await stock(p.id)).toBe(5);
  });

  it("modo ENTREGA: descuenta al marcar entregada, no antes, y no duplica", async () => {
    await configurar({ deduccionStockEn: "ENTREGA" });
    const p = await producto({ stockActual: 10 });
    const orden = (await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 4 }])).body;
    expect(await stock(p.id)).toBe(10);

    await api().put(`/api/ordenes/${orden.id}`).set(auth(token)).send({ estado: "ENTREGADO" });
    expect(await stock(p.id)).toBe(6);
    await api().put(`/api/ordenes/${orden.id}`).set(auth(token)).send({ estado: "ENTREGADO" });
    expect(await stock(p.id)).toBe(6);
  });

  it("ajuste manual: suma, resta, no deja stock negativo y exige motivo", async () => {
    const p = await producto({ stockActual: 5 });
    const ajustar = (data: Record<string, unknown>) =>
      api().post("/api/inventario/ajustes").set(auth(token)).send({ servicioId: p.id, ...data });

    expect((await ajustar({ tipo: "ENTRADA", cantidad: 3, nota: "conteo" })).status).toBe(201);
    expect(await stock(p.id)).toBe(8);
    expect((await ajustar({ tipo: "SALIDA", cantidad: 2, nota: "merma" })).status).toBe(201);
    expect(await stock(p.id)).toBe(6);
    expect((await ajustar({ tipo: "SALIDA", cantidad: 50, nota: "x" })).status).toBe(400);
    expect((await ajustar({ tipo: "ENTRADA", cantidad: 1, nota: "" })).status).toBe(400);
    expect((await ajustar({ tipo: "ENTRADA", cantidad: 0, nota: "x" })).status).toBe(400);
    expect(await stock(p.id)).toBe(6);
  });

  it("anular: devuelve el stock exacto una sola vez y reembolsa lo cobrado (neto cero)", async () => {
    const p = await producto({ stockActual: 10 });
    const orden = (await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 3 }])).body; // 24
    await pagarTodo(orden.id, 24);
    expect(await stock(p.id)).toBe(7);

    const res = await api().patch(`/api/ordenes/${orden.id}/anular`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("CANCELADO");
    expect(res.body.abonado).toBe(0);
    expect(res.body.faltante).toBe(0);
    expect(await stock(p.id)).toBe(10);

    const pagos = await prisma.pago.findMany({ where: { ordenId: orden.id } });
    expect(pagos.reduce((s, x) => s + x.monto, 0)).toBe(0);

    expect((await api().patch(`/api/ordenes/${orden.id}/anular`).set(auth(token))).status).toBe(409);
    expect(await stock(p.id)).toBe(10);
  });

  it("una orden anulada no admite pagos ni ediciones", async () => {
    const p = await producto({ stockActual: 10 });
    const orden = (await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 1 }])).body;
    await api().patch(`/api/ordenes/${orden.id}/anular`).set(auth(token));
    expect((await pagarTodo(orden.id, 1)).status).toBe(409);
    expect((await api().put(`/api/ordenes/${orden.id}`).set(auth(token)).send({ observaciones: "x" })).status).toBe(409);
  });

  it("anular con pagos exige caja abierta cuando el módulo Caja está activo", async () => {
    const p = await producto({ stockActual: 10 });
    await configurar({ moduloCaja: true });
    await api().post("/api/caja/abrir").set(auth(token)).send({ montoInicial: 0 });
    const orden = (await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 1 }])).body;
    await pagarTodo(orden.id, 8);
    await api().post("/api/caja/cerrar").set(auth(token)).send({ montoFinalContado: 8 });

    const res = await api().patch(`/api/ordenes/${orden.id}/anular`).set(auth(token));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/caja/i);
    expect((await prisma.orden.findUniqueOrThrow({ where: { id: orden.id } })).estado).toBe("PENDIENTE");
  });

  it("eliminar una orden también devuelve su stock", async () => {
    const p = await producto({ stockActual: 10 });
    const orden = (await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 4 }])).body;
    expect(await stock(p.id)).toBe(6);
    expect((await api().delete(`/api/ordenes/${orden.id}`).set(auth(token))).status).toBe(204);
    expect(await stock(p.id)).toBe(10);
  });

  it("el historial de movimientos refleja todo en orden", async () => {
    const p = await producto({ stockActual: 0 });
    await api().post("/api/inventario/ajustes").set(auth(token)).send({ servicioId: p.id, tipo: "ENTRADA", cantidad: 5, nota: "inicial" });
    await crearOrden(token, clienteId, [{ servicioId: p.id, cantidad: 2 }]);
    const res = await api().get(`/api/inventario/movimientos?servicioId=${p.id}`).set(auth(token));
    expect(res.body.map((m: { motivo: string }) => m.motivo)).toEqual(["VENTA", "AJUSTE_MANUAL"]);
    expect(res.body[0].stockResultante).toBe(3);
  });
});
