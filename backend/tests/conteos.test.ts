import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio } from "./helpers";

describe("toma de inventario físico", () => {
  let admin: string;
  let empleado: string;
  let cajero: string;
  let categoriaId: string;
  let a: number; // 10 en sistema, costo 4
  let b: number; // 5 en sistema, costo 2, admite decimales
  let c: number; // 8 en sistema, otra categoría
  let servicio: number; // no controla stock
  let otraCategoria: string;

  const crear = (body: Record<string, unknown> = {}, token = admin) => api().post("/api/conteos").set(auth(token)).send(body);
  const contar = (id: number, body: Record<string, unknown>, token = admin) => api().put(`/api/conteos/${id}/items`).set(auth(token)).send(body);
  const ver = (id: number) => api().get(`/api/conteos/${id}`).set(auth(admin));
  const aplicar = (id: number, token = admin) => api().post(`/api/conteos/${id}/aplicar`).set(auth(token));
  const cancelar = (id: number) => api().post(`/api/conteos/${id}/cancelar`).set(auth(admin));
  const stock = async (id: number) => (await prisma.servicio.findUniqueOrThrow({ where: { id } })).stockActual;

  beforeAll(async () => {
    await resetDb();
    admin = (await crearAdmin()).token;
    await configurar({ moduloInventario: true });
    const f = await crearFixtures();
    categoriaId = f.categoria.id;
    otraCategoria = (await prisma.categoria.create({ data: { nombre: "Otra" } })).id;
    a = (await crearServicio(categoriaId, { nombreServicio: "A", controlaStock: true, stockActual: 10, costoBase: 4 })).id;
    b = (await crearServicio(categoriaId, { nombreServicio: "B", controlaStock: true, stockActual: 5, costoBase: 2, permiteDecimales: true })).id;
    c = (await crearServicio(otraCategoria, { nombreServicio: "C", controlaStock: true, stockActual: 8, costoBase: 1 })).id;
    servicio = (await crearServicio(categoriaId, { nombreServicio: "Mano de obra", controlaStock: false })).id;
    for (const [email, role] of [["emp@test.com", "EMPLOYEE"], ["caj@test.com", "CAJERO"]]) {
      await api().post("/api/usuarios").set(auth(admin)).send({ email, password: "secreto1", name: role, role });
    }
    empleado = (await login("emp@test.com", "secreto1")).body.token;
    cajero = (await login("caj@test.com", "secreto1")).body.token;
  });

  it("solo con inventario activo y para administradores y empleados", async () => {
    await configurar({ moduloInventario: false });
    expect((await api().get("/api/conteos").set(auth(admin))).status).toBe(403);
    await configurar({ moduloInventario: true });
    expect((await api().get("/api/conteos").set(auth(cajero))).status).toBe(403);
    expect((await api().get("/api/conteos")).status).toBe(401);
    expect((await api().get("/api/conteos").set(auth(empleado))).status).toBe(200);
  });

  it("solo puede haber un conteo abierto a la vez", async () => {
    const primero = await crear({ nombre: "Septiembre" });
    expect(primero.status).toBe(201);
    expect(primero.body).toMatchObject({ nombre: "Septiembre", estado: "ABIERTO" });
    const segundo = await crear();
    expect(segundo.status).toBe(409);
    expect(segundo.body.conteoId).toBe(primero.body.id);
    await cancelar(primero.body.id);
    expect((await crear({}, empleado)).status).toBe(201); // el empleado también puede empezar uno
    const abierto = (await api().get("/api/conteos").set(auth(admin))).body.find((x: { estado: string }) => x.estado === "ABIERTO");
    await cancelar(abierto.id);
  });

  it("cuenta fijando o sumando lecturas del escáner, y valida", async () => {
    const id = (await crear()).body.id;
    expect((await contar(id, { servicioId: a, cantidad: 7 })).body.contado).toBe(7);
    await contar(id, { servicioId: b, cantidad: 1, modo: "sumar" });
    await contar(id, { servicioId: b, cantidad: 1, modo: "sumar" });
    expect((await contar(id, { servicioId: b, cantidad: 0.5, modo: "sumar" })).body.contado).toBe(2.5); // admite decimales
    expect((await contar(id, { servicioId: a, cantidad: 3.7 })).body.contado).toBe(4); // sin decimales: se redondea

    expect((await contar(id, { servicioId: a, cantidad: -1 })).status).toBe(400);
    expect((await contar(id, { servicioId: servicio, cantidad: 1 })).status).toBe(400); // no controla existencias
    expect((await contar(id, { servicioId: 99999, cantidad: 1 })).status).toBe(404);

    const detalle = await ver(id);
    expect(detalle.body.detalles).toHaveLength(2);
    // Aún no se aplicó: las existencias del sistema no cambian y el resumen ya anticipa las diferencias.
    expect(await stock(a)).toBe(10);
    expect(detalle.body.resumen).toMatchObject({ contados: 2, conDiferencia: 2, faltantes: 8.5, sobrantes: 0, valorFaltante: 6 * 4 + 2.5 * 2 });

    expect((await api().delete(`/api/conteos/${id}/items/${b}`).set(auth(admin))).status).toBe(200);
    expect((await ver(id)).body.detalles).toHaveLength(1);
    await cancelar(id);
  });

  it("un conteo por categoría solo admite productos de esa categoría", async () => {
    const id = (await crear({ categoriaId: otraCategoria })).body.id;
    expect((await contar(id, { servicioId: a, cantidad: 1 })).status).toBe(400);
    expect((await contar(id, { servicioId: c, cantidad: 8 })).status).toBe(200);
    expect((await ver(id)).body.categoriaNombre).toBe("Otra");
    expect((await crear({ categoriaId: "no-existe" })).status).toBe(409); // ya hay uno abierto
    await cancelar(id);
    expect((await crear({ categoriaId: "no-existe" })).status).toBe(400);
  });

  it("aplicar ajusta las existencias, deja movimientos y bloquea el conteo", async () => {
    const id = (await crear({ nombre: "Cierre" })).body.id;
    await contar(id, { servicioId: a, cantidad: 12 }); // sobran 2
    await contar(id, { servicioId: b, cantidad: 3 }); // faltan 2
    await contar(id, { servicioId: c, cantidad: 8 }); // igual

    expect((await aplicar(id, empleado)).status).toBe(403); // solo administración
    expect(await stock(a)).toBe(10);

    // Mientras se contaba se vendió algo: se compara con lo que hay ahora.
    await prisma.servicio.update({ where: { id: a }, data: { stockActual: 9 } });
    const res = await aplicar(id);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("APLICADO");
    expect(res.body.resumen).toMatchObject({ contados: 3, conDiferencia: 2, sobrantes: 3, faltantes: 2, valorSobrante: 12, valorFaltante: 4 });

    expect(await stock(a)).toBe(12);
    expect(await stock(b)).toBe(3);
    expect(await stock(c)).toBe(8);
    const movs = await prisma.inventarioMovimiento.findMany({ where: { nota: `Toma de inventario #${id}` }, orderBy: { servicioId: "asc" } });
    expect(movs.map((m) => [m.servicioId, m.tipo, m.cantidad, m.stockResultante, m.motivo])).toEqual([
      [a, "ENTRADA", 3, 12, "AJUSTE_MANUAL"],
      [b, "SALIDA", 2, 3, "AJUSTE_MANUAL"],
    ]);
    const guardado = (await ver(id)).body.detalles.find((d: { servicioId: number }) => d.servicioId === a);
    expect(guardado).toMatchObject({ contado: 12, esperado: 9, diferencia: 3, costoUnit: 4 });

    // Ya aplicado: no se puede tocar ni repetir.
    expect((await contar(id, { servicioId: a, cantidad: 1 })).status).toBe(409);
    expect((await aplicar(id)).status).toBe(409);
    expect((await cancelar(id)).status).toBe(409);
    expect(await stock(a)).toBe(12);
  });

  it("no aplica un conteo vacío, y cancelar no cambia nada", async () => {
    const id = (await crear()).body.id;
    expect((await aplicar(id)).status).toBe(400);
    await contar(id, { servicioId: a, cantidad: 1 });
    expect((await cancelar(id)).status).toBe(200);
    expect(await stock(a)).toBe(12);
    expect((await ver(id)).body.estado).toBe("CANCELADO");
    expect((await aplicar(id)).status).toBe(409);
  });
});
