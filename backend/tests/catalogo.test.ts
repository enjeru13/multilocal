import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio } from "./helpers";

describe("catálogo: ajuste de precios, costo y permisos", () => {
  let admin: string;
  let cajero: string;
  let cat1: string;
  let cat2: string;
  let a: number;
  let b: number;
  let c: number;

  const ajustar = (body: Record<string, unknown>, token = admin) =>
    api().post("/api/servicios/ajuste-precios").set(auth(token)).send(body);
  const precio = async (id: number) => (await prisma.servicio.findUnique({ where: { id } }))!.precioBase;

  beforeAll(async () => {
    await resetDb();
    admin = (await crearAdmin()).token;
    await configurar({ moduloInventario: true, moduloFechaEntrega: false, clienteObligatorio: false });
    const f = await crearFixtures();
    cat1 = f.categoria.id;
    cat2 = (await prisma.categoria.create({ data: { nombre: "Otra" } })).id;
    a = (await crearServicio(cat1, { nombreServicio: "A", precioBase: 10, costoBase: 6 })).id;
    b = (await crearServicio(cat1, { nombreServicio: "B", precioBase: 3.33 })).id;
    c = (await crearServicio(cat2, { nombreServicio: "C", precioBase: 100 })).id;
    await api().post("/api/usuarios").set(auth(admin)).send({ email: "caj@test.com", password: "secreto1", name: "Caj", role: "CAJERO" });
    cajero = (await login("caj@test.com", "secreto1")).body.token;
  });

  describe("ajuste masivo de precios", () => {
    it("simular muestra los cambios sin guardar nada", async () => {
      const r = await ajustar({ porcentaje: 10, simular: true });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ aplicado: false, cantidad: 3 });
      expect(r.body.ejemplos.find((e: { nombre: string }) => e.nombre === "A")).toMatchObject({ antes: 10, despues: 11 });
      expect(await precio(a)).toBe(10);
    });

    it("aplica a una categoría y respeta el redondeo", async () => {
      const r = await ajustar({ porcentaje: 10, categoriaId: cat1, redondeo: "CENTAVOS" });
      expect(r.body).toMatchObject({ aplicado: true, cantidad: 2 });
      expect(await precio(a)).toBe(11);
      expect(await precio(b)).toBe(3.66); // 3.33 * 1.1 = 3.663
      expect(await precio(c)).toBe(100); // otra categoría: intacta
    });

    it("puede bajar precios y redondear al entero o al medio", async () => {
      await ajustar({ porcentaje: -50, categoriaId: cat2, redondeo: "ENTERO" });
      expect(await precio(c)).toBe(50);
      await prisma.servicio.update({ where: { id: c }, data: { precioBase: 7.3 } });
      await ajustar({ porcentaje: 10, categoriaId: cat2, redondeo: "MEDIO" }); // 8.03 -> 8
      expect(await precio(c)).toBe(8);
    });

    it("solo cambia los seleccionados si se indican", async () => {
      await prisma.servicio.update({ where: { id: a }, data: { precioBase: 20 } });
      await prisma.servicio.update({ where: { id: b }, data: { precioBase: 20 } });
      await ajustar({ porcentaje: 50, ids: [a] });
      expect(await precio(a)).toBe(30);
      expect(await precio(b)).toBe(20);
    });

    it("rechaza porcentajes absurdos y a quien no es administrador", async () => {
      expect((await ajustar({ porcentaje: -95 })).status).toBe(400);
      expect((await ajustar({ porcentaje: 1000 })).status).toBe(400);
      expect((await ajustar({ porcentaje: 10 }, cajero)).status).toBe(403);
    });

    it("no toca las ventas ya hechas", async () => {
      await prisma.servicio.update({ where: { id: a }, data: { precioBase: 10 } });
      const cliente = (await prisma.cliente.create({ data: { nombre: "X", tipo: "NATURAL" } })).id;
      const venta = await api().post("/api/ordenes").set(auth(admin)).send({ clienteId: cliente, estado: "PENDIENTE", servicios: [{ servicioId: a, cantidad: 2 }] });
      await ajustar({ porcentaje: 100, ids: [a] });
      const o = (await api().get(`/api/ordenes/${venta.body.id}`).set(auth(admin))).body;
      expect(o.total).toBe(20);
      expect(o.detalles[0].precioUnit).toBe(10);
    });
  });

  describe("costo", () => {
    it("la venta congela el costo aunque el producto no controle stock", async () => {
      await prisma.servicio.update({ where: { id: a }, data: { precioBase: 10, costoBase: 6, controlaStock: false } });
      const r = await api().post("/api/ordenes").set(auth(admin)).send({ clienteId: null, estado: "PENDIENTE", entregaInmediata: true, servicios: [{ servicioId: a, cantidad: 1 }] });
      expect(r.status).toBe(201);
      expect(r.body.detalles[0].costoUnit).toBe(6);
    });

    it("el cajero no ve el costo en el catálogo; el administrador sí", async () => {
      const paraCajero = (await api().get("/api/servicios").set(auth(cajero))).body as { id: number; costoBase: number | null }[];
      expect(paraCajero.every((s) => s.costoBase === null)).toBe(true);
      const paraAdmin = (await api().get("/api/servicios").set(auth(admin))).body as { id: number; costoBase: number | null }[];
      expect(paraAdmin.find((s) => s.id === a)!.costoBase).toBe(6);
    });
  });

  it("guarda y devuelve la marca de producto exento", async () => {
    const r = await api().post("/api/servicios").set(auth(admin)).send({ nombreServicio: "Pan", precioBase: 1, categoriaId: cat1, exentoImpuesto: true });
    expect(r.status).toBe(201);
    expect(r.body.exentoImpuesto).toBe(true);
    const u = await api().put(`/api/servicios/${r.body.id}`).set(auth(admin)).send({ nombreServicio: "Pan", precioBase: 1, categoriaId: cat1, exentoImpuesto: false });
    expect(u.body.exentoImpuesto).toBe(false);
  });
});
