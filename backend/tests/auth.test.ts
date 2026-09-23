import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, resetDb, crearAdmin, login } from "./helpers";

describe("autenticación y usuarios", () => {
  let admin: Awaited<ReturnType<typeof crearAdmin>>;

  beforeAll(async () => {
    await resetDb();
  });

  it("instalación nueva: pide setup", async () => {
    const res = await api().get("/api/auth/setup-status");
    expect(res.body.needsSetup).toBe(true);
  });

  it("el primer registro crea un ADMIN aunque pida otro rol", async () => {
    admin = await crearAdmin();
    expect(admin.status).toBe(201);
    expect(admin.user.role).toBe("ADMIN");
    expect((await api().get("/api/auth/setup-status")).body.needsSetup).toBe(false);
  });

  it("el registro público queda cerrado después del primero", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ email: "hacker@x.com", password: "123456", name: "h", role: "ADMIN" });
    expect(res.status).toBe(403);
  });

  it("login correcto e incorrecto", async () => {
    expect((await login("admin@test.com", "secreto1")).status).toBe(200);
    expect((await login("admin@test.com", "mala")).status).toBe(401);
    expect((await login("nadie@test.com", "secreto1")).status).toBe(401);
  });

  it("rutas protegidas exigen token", async () => {
    expect((await api().get("/api/clientes")).status).toBe(401);
    expect((await api().get("/api/clientes").set(auth("token-falso"))).status).toBe(401);
  });

  it("un ADMIN crea usuarios; un EMPLOYEE no puede administrarlos", async () => {
    const creado = await api()
      .post("/api/usuarios")
      .set(auth(admin.token))
      .send({ email: "emp@test.com", password: "abc123", name: "Emp", role: "EMPLOYEE" });
    expect(creado.status).toBe(201);
    expect(creado.body.password).toBeUndefined();

    const empToken = (await login("emp@test.com", "abc123")).body.token;
    expect((await api().get("/api/usuarios").set(auth(empToken))).status).toBe(403);
    expect(
      (
        await api()
          .post("/api/usuarios")
          .set(auth(empToken))
          .send({ email: "x@test.com", password: "abc123", name: "X", role: "ADMIN" })
      ).status
    ).toBe(403);
  });

  it("no permite correos repetidos", async () => {
    const res = await api()
      .post("/api/usuarios")
      .set(auth(admin.token))
      .send({ email: "emp@test.com", password: "abc123", name: "Otro", role: "EMPLOYEE" });
    expect(res.status).toBe(409);
  });

  it("desactivar: no puede iniciar sesión y su token deja de servir al instante", async () => {
    const empToken = (await login("emp@test.com", "abc123")).body.token;
    const lista = await api().get("/api/usuarios").set(auth(admin.token));
    const emp = lista.body.find((u: { email: string }) => u.email === "emp@test.com");

    const res = await api().put(`/api/usuarios/${emp.id}`).set(auth(admin.token)).send({ activo: false });
    expect(res.body.activo).toBe(false);
    expect((await login("emp@test.com", "abc123")).status).toBe(403);
    expect((await api().get("/api/clientes").set(auth(empToken))).status).toBe(401);
  });

  it("no deja al sistema sin administrador activo", async () => {
    const yo = admin.user.id;
    expect((await api().put(`/api/usuarios/${yo}`).set(auth(admin.token)).send({ role: "EMPLOYEE" })).status).toBe(409);
    expect((await api().put(`/api/usuarios/${yo}`).set(auth(admin.token)).send({ activo: false })).status).toBe(409);
  });

  it("con un segundo admin sí se puede degradar al primero, pero nunca desactivarse a sí mismo", async () => {
    const seg = await api()
      .post("/api/usuarios")
      .set(auth(admin.token))
      .send({ email: "admin2@test.com", password: "abc123", name: "A2", role: "ADMIN" });
    expect(seg.status).toBe(201);
    const t2 = (await login("admin2@test.com", "abc123")).body.token;

    expect((await api().put(`/api/usuarios/${seg.body.id}`).set(auth(t2)).send({ activo: false })).status).toBe(409);
    expect(
      (await api().put(`/api/usuarios/${admin.user.id}`).set(auth(t2)).send({ role: "EMPLOYEE" })).status
    ).toBe(200);
  });

  it("cambio de contraseña propia", async () => {
    const t2 = (await login("admin2@test.com", "abc123")).body.token;
    const cambiar = (passwordActual: string, passwordNueva: string) =>
      api().post("/api/auth/change-password").set(auth(t2)).send({ passwordActual, passwordNueva });

    expect((await cambiar("mala", "nueva123")).status).toBe(400);
    expect((await cambiar("abc123", "123")).status).toBe(400);
    expect((await cambiar("abc123", "nueva123")).status).toBe(200);
    expect((await login("admin2@test.com", "abc123")).status).toBe(401);
    expect((await login("admin2@test.com", "nueva123")).status).toBe(200);
  });
});
