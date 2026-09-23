import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, resetDb } from "./helpers";

// Es la misma secuencia que sigue el asistente de configuración inicial.
describe("asistente de configuración inicial", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("al inicio pide configurar y la marca pública está vacía", async () => {
    expect((await api().get("/api/auth/setup-status")).body.needsSetup).toBe(true);
    expect((await api().get("/api/auth/branding")).body).toEqual({ nombreNegocio: null, rubro: null });
  });

  it("crea la cuenta, entra y deja el negocio configurado con todo lo del asistente", async () => {
    const reg = await api().post("/api/auth/register").send({ name: "María", email: "maria@test.com", password: "secreto1", role: "ADMIN" });
    expect(reg.status).toBe(201);
    const login = await api().post("/api/auth/login").send({ email: "maria@test.com", password: "secreto1" });
    expect(login.status).toBe(200);
    const token = login.body.token as string;

    // La configuración no existe aún: el primer GET la crea con valores por defecto.
    const inicial = await api().get("/api/configuracion").set(auth(token));
    expect(inicial.status).toBe(200);

    const cfg = await api()
      .put("/api/configuracion")
      .set(auth(token))
      .send({
        nombreNegocio: "Bodega La Esquina",
        monedaPrincipal: "USD",
        tasaVES: 38.5,
        tasaCOP: null,
        rif: "J-123",
        direccion: null,
        telefonoPrincipal: "0414-1234567",
        rubro: "MINIMARKET",
        moduloInventario: true,
        moduloProveedores: true,
        moduloCaja: true,
        moduloFechaEntrega: false,
        moduloClienteTipo: false,
        clienteObligatorio: false,
        terminologia: { servicio: "Productos", orden: "Ventas", cliente: "Clientes", servicioUno: "Producto", ordenUno: "Venta", clienteUno: "Cliente" },
        impuestoActivo: true,
        impuestoNombre: "IVA",
        impuestoTasa: 16,
        preciosIncluyenImpuesto: true,
      });
    expect(cfg.status).toBe(200);
    expect(cfg.body).toMatchObject({
      nombreNegocio: "Bodega La Esquina",
      rubro: "MINIMARKET",
      moduloCaja: true,
      moduloFechaEntrega: false,
      impuestoActivo: true,
      impuestoTasa: 16,
      tasaVES: 38.5,
    });
    expect(cfg.body.terminologia.ordenUno).toBe("Venta");
  });

  it("después del asistente el login ya muestra el negocio y el registro público se cierra", async () => {
    expect((await api().get("/api/auth/setup-status")).body.needsSetup).toBe(false);
    expect((await api().get("/api/auth/branding")).body).toEqual({ nombreNegocio: "Bodega La Esquina", rubro: "MINIMARKET" });
    const otra = await api().post("/api/auth/register").send({ name: "X", email: "otra@test.com", password: "secreto1" });
    expect(otra.status).toBe(403);
  });
});
