import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { createApp } from "../src/app";

describe("app instalada: el servidor entrega la interfaz", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "web-"));
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    fs.writeFileSync(path.join(dir, "index.html"), "<html><body>INICIO</body></html>");
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "assets", "app.js"), "console.log(1)");
    process.env.FRONTEND_DIR = dir;
    app = createApp();
  });
  afterAll(() => {
    delete process.env.FRONTEND_DIR;
  });

  it("sirve el índice y los archivos estáticos", async () => {
    expect((await request(app).get("/")).text).toContain("INICIO");
    const js = await request(app).get("/assets/app.js");
    expect(js.status).toBe(200);
    expect(js.headers["content-type"]).toMatch(/javascript/);
  });

  it("las rutas de la interfaz caen en el índice (React Router)", async () => {
    const r = await request(app).get("/clientes/12/editar");
    expect(r.status).toBe(200);
    expect(r.text).toContain("INICIO");
  });

  it("la API sigue protegida y no se confunde con la interfaz", async () => {
    expect((await request(app).get("/api/clientes")).status).toBe(401);
    const publico = await request(app).get("/api/auth/setup-status");
    expect(publico.status).toBe(200);
    expect(publico.headers["content-type"]).toMatch(/json/);
  });
});
