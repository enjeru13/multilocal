import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { api, auth, prisma, resetDb, crearAdmin } from "./helpers";
import { validarRespaldo } from "../src/lib/respaldos";

describe("respaldos", () => {
  let token: string;

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
  });

  it("crea un respaldo manual y lo lista", async () => {
    const res = await api().post("/api/respaldos/crear").set(auth(token));
    expect(res.status).toBe(201);
    const lista = await api().get("/api/respaldos").set(auth(token));
    expect(lista.body.some((r: { nombre: string; tipo: string }) => r.nombre === res.body.nombre && r.tipo === "manual")).toBe(true);
  });

  it("dos respaldos seguidos (doble clic) no se pisan el nombre", async () => {
    const [a, b] = await Promise.all([
      api().post("/api/respaldos/crear").set(auth(token)),
      api().post("/api/respaldos/crear").set(auth(token)),
    ]);
    const c = await api().post("/api/respaldos/crear").set(auth(token));
    expect([a.status, b.status, c.status]).toEqual([201, 201, 201]);
    expect(new Set([a.body.nombre, b.body.nombre, c.body.nombre]).size).toBe(3);
  });

  it("solo un ADMIN puede usar respaldos", async () => {
    await api().post("/api/usuarios").set(auth(token)).send({ email: "e@test.com", password: "abc123", name: "E", role: "EMPLOYEE" });
    const emp = (await api().post("/api/auth/login").send({ email: "e@test.com", password: "abc123" })).body.token;
    expect((await api().get("/api/respaldos").set(auth(emp))).status).toBe(403);
    expect((await api().post("/api/respaldos/crear").set(auth(emp))).status).toBe(403);
  });

  it("no permite escapar de la carpeta de respaldos", async () => {
    for (const nombre of ["..%2F..%2Fsecreto.db", "%2E%2E%2Ftest.db", "no-existe.db"]) {
      expect((await api().get(`/api/respaldos/${nombre}/descargar`).set(auth(token))).status).toBe(404);
    }
  });

  it("rechaza archivos que no son un respaldo válido", async () => {
    const basura = await api()
      .post("/api/respaldos/restaurar-archivo")
      .set(auth(token))
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("esto no es sqlite"));
    expect(basura.status).toBe(400);

    const tmp = path.join(os.tmpdir(), `vacio-${Date.now()}.db`);
    const db = new DatabaseSync(tmp);
    db.exec("CREATE TABLE Otra (id INTEGER)");
    db.close();
    expect(validarRespaldo(tmp)).toMatchObject({ ok: false });
    fs.rmSync(tmp, { force: true });
  });

  it("restaurar devuelve el sistema al estado del respaldo y guarda una copia previa", async () => {
    const nombre = (await api().post("/api/respaldos/crear").set(auth(token))).body.nombre;
    await prisma.proveedor.create({ data: { nombre: "Creado después del respaldo" } });
    expect(await prisma.proveedor.count()).toBe(1);

    const res = await api().post(`/api/respaldos/restaurar/${nombre}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.respaldoPrevio).toMatch(/^previo-/);
    expect(await prisma.proveedor.count()).toBe(0);
    // el sistema sigue funcionando tras cambiar el archivo por debajo
    expect((await api().get("/api/auth/setup-status")).status).toBe(200);
  });
});
