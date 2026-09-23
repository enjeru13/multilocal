import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio } from "./helpers";

describe("tablero de órdenes (lavandería)", () => {
  let admin: string;
  let clienteId: number;
  let servicioId: number;

  const nueva = async () =>
    (await api().post("/api/ordenes").set(auth(admin)).send({ clienteId, estado: "PENDIENTE", servicios: [{ servicioId, cantidad: 2 }] })).body;
  const estado = (id: number, e: string) => api().put(`/api/ordenes/${id}`).set(auth(admin)).send({ estado: e });
  const tablero = async (token = admin) => (await api().get("/api/ordenes/tablero").set(auth(token))).body as { id: number; estado: string }[];

  beforeAll(async () => {
    await resetDb();
    admin = (await crearAdmin()).token;
    await configurar({ moduloFechaEntrega: true, clienteObligatorio: true });
    const f = await crearFixtures();
    clienteId = f.cliente.id;
    servicioId = (await crearServicio(f.categoria.id, { precioBase: 10 })).id;
  });

  it("una orden puede pasar de pendiente a lista y luego a entregada", async () => {
    const o = await nueva();
    expect((await estado(o.id, "LISTO")).body.estado).toBe("LISTO");
    const entregada = await estado(o.id, "ENTREGADO");
    expect(entregada.body.estado).toBe("ENTREGADO");
    expect(entregada.body.deliveredByUserId).not.toBeNull();
  });

  it("rechaza estados inválidos", async () => {
    const o = await nueva();
    expect((await estado(o.id, "CANCELADO")).status).toBe(400);
    expect((await estado(o.id, "EN_PROCESO")).status).toBe(400);
  });

  it("el tablero trae pendientes, listas y lo entregado hoy; no lo anulado ni lo entregado antes", async () => {
    await prisma.detalleOrden.deleteMany();
    await prisma.pago.deleteMany();
    await prisma.orden.deleteMany();

    const pendiente = await nueva();
    const lista = await nueva();
    await estado(lista.id, "LISTO");
    const entregadaHoy = await nueva();
    await estado(entregadaHoy.id, "ENTREGADO");
    const entregadaAyer = await nueva();
    await estado(entregadaAyer.id, "ENTREGADO");
    await prisma.orden.update({ where: { id: entregadaAyer.id }, data: { fechaEntrega: new Date(Date.now() - 2 * 86_400_000) } });
    const anulada = await nueva();
    await api().patch(`/api/ordenes/${anulada.id}/anular`).set(auth(admin));

    const ids = (await tablero()).map((o) => o.id).sort((a, b) => a - b);
    expect(ids).toEqual([pendiente.id, lista.id, entregadaHoy.id].sort((a, b) => a - b));
  });

  it("incluye cliente, artículos y saldo para pintar las tarjetas", async () => {
    const [o] = await tablero();
    expect(o).toMatchObject({ cliente: { nombre: "Ana" } });
    const conDetalle = o as unknown as { detalles: { servicio: { nombreServicio: string } }[]; faltante: number };
    expect(conDetalle.detalles[0].servicio.nombreServicio).toBeDefined();
    expect(typeof conDetalle.faltante).toBe("number");
  });

  it("el cajero también ve el tablero", async () => {
    await api().post("/api/usuarios").set(auth(admin)).send({ email: "caj@test.com", password: "secreto1", name: "Caj", role: "CAJERO" });
    const cajero = (await login("caj@test.com", "secreto1")).body.token;
    expect((await api().get("/api/ordenes/tablero").set(auth(cajero))).status).toBe(200);
  });

  it("el resumen cuenta las listas por separado", async () => {
    const r = (await api().get("/api/reportes/dashboard").set(auth(admin))).body;
    expect(r.listas).toBe(1);
    expect(r.pendientes).toBe(1);
  });
});
