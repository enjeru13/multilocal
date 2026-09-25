import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { api, resetDb, crearAdmin } from "./helpers";
import { reiniciarLimites, registrarFallo, segundosDeBloqueo } from "../src/lib/limiteIntentos";

describe("servidor en internet: seguridad básica", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => {
    delete process.env.MOSTRADOR_SETUP_CODE;
  });

  it("responde a la comprobación de salud sin sesión", async () => {
    const res = await api().get("/api/salud");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("bloquea el acceso tras varios intentos fallidos y avisa cuánto esperar", async () => {
    await crearAdmin("jefe@test.com", "secreto1");
    for (let i = 0; i < 8; i++) {
      const r = await api().post("/api/auth/login").send({ email: "jefe@test.com", password: "incorrecta" });
      expect(r.status).toBe(401);
    }
    // El noveno intento se frena, aunque la contraseña ahora sea la buena.
    const bloqueado = await api().post("/api/auth/login").send({ email: "jefe@test.com", password: "secreto1" });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.message).toMatch(/Demasiados intentos/);
    expect(Number(bloqueado.headers["retry-after"])).toBeGreaterThan(0);

    // Otro usuario desde el mismo lugar no queda bloqueado por eso.
    await crearAdmin("otro@test.com", "secreto1").catch(() => undefined);
    reiniciarLimites();
    const ok = await api().post("/api/auth/login").send({ email: "jefe@test.com", password: "secreto1" });
    expect(ok.status).toBe(200);
  });

  it("un acceso correcto borra los fallos anteriores", async () => {
    await crearAdmin("jefe@test.com", "secreto1");
    for (let i = 0; i < 5; i++) await api().post("/api/auth/login").send({ email: "jefe@test.com", password: "mal" });
    expect((await api().post("/api/auth/login").send({ email: "jefe@test.com", password: "secreto1" })).status).toBe(200);
    for (let i = 0; i < 5; i++) {
      expect((await api().post("/api/auth/login").send({ email: "jefe@test.com", password: "mal" })).status).toBe(401);
    }
  });

  it("los fallos caducan pasada la ventana", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 8; i++) registrarFallo("1.2.3.4", "a@b.com", t0);
    expect(segundosDeBloqueo("1.2.3.4", "a@b.com", t0 + 1000)).toBeGreaterThan(0);
    expect(segundosDeBloqueo("1.2.3.4", "a@b.com", t0 + 16 * 60_000)).toBeNull();
    expect(segundosDeBloqueo("5.6.7.8", "a@b.com", t0 + 1000)).toBeNull();
  });

  it("con código de instalación, solo quien lo conoce crea el administrador", async () => {
    process.env.MOSTRADOR_SETUP_CODE = "abc-123";
    const estado = await api().get("/api/auth/setup-status");
    expect(estado.body).toEqual({ needsSetup: true, requiereCodigo: true });

    const datos = { name: "Ana", email: "ana@test.com", password: "secreto1", role: "ADMIN" };
    expect((await api().post("/api/auth/register").send(datos)).status).toBe(403);
    expect((await api().post("/api/auth/register").send({ ...datos, codigoInstalacion: "otro" })).status).toBe(403);
    const ok = await api().post("/api/auth/register").send({ ...datos, codigoInstalacion: "abc-123" });
    expect(ok.status).toBe(201);

    // Ya con usuarios: no hace falta código para nada más y el estado deja de pedirlo.
    expect((await api().get("/api/auth/setup-status")).body).toEqual({ needsSetup: false, requiereCodigo: false });
  });

  it("sin código configurado (versión de escritorio) el registro inicial funciona como siempre", async () => {
    expect((await api().get("/api/auth/setup-status")).body).toEqual({ needsSetup: true, requiereCodigo: false });
    const ok = await api().post("/api/auth/register").send({ name: "Ana", email: "ana@test.com", password: "secreto1", role: "ADMIN" });
    expect(ok.status).toBe(201);
  });
});
