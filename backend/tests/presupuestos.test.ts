import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio } from "./helpers";

describe("presupuestos", () => {
  let admin: string;
  let empleado: string;
  let cajero: string;
  let clienteId: number;
  let producto: number; // 100, con stock, gravado
  let exento: number; // 50, exento

  const crear = (body: Record<string, unknown>, token = admin) => api().post("/api/presupuestos").set(auth(token)).send(body);
  const leer = (id: number) => api().get(`/api/presupuestos/${id}`).set(auth(admin));
  const estado = (id: number, e: string) => api().patch(`/api/presupuestos/${id}/estado`).set(auth(admin)).send({ estado: e });
  const convertir = (id: number, body: Record<string, unknown> = {}) => api().post(`/api/presupuestos/${id}/convertir`).set(auth(admin)).send(body);

  beforeAll(async () => {
    await resetDb();
    admin = (await crearAdmin()).token;
    await configurar({
      moduloPresupuestos: true,
      presupuestoValidezDias: 10,
      presupuestoCondiciones: "Precios sujetos a disponibilidad.",
      impuestoActivo: true,
      impuestoTasa: 16,
      preciosIncluyenImpuesto: false,
      moduloCaja: false,
      moduloInventario: true,
      moduloFechaEntrega: true,
      clienteObligatorio: true,
      descuentoMaxPct: 10,
    });
    const f = await crearFixtures();
    clienteId = f.cliente.id;
    producto = (await crearServicio(f.categoria.id, { nombreServicio: "Aire acondicionado", precioBase: 100, controlaStock: true, stockActual: 5, costoBase: 60 })).id;
    exento = (await crearServicio(f.categoria.id, { nombreServicio: "Exento", precioBase: 50, exentoImpuesto: true })).id;
    for (const [email, role] of [["emp@test.com", "EMPLOYEE"], ["caj@test.com", "CAJERO"]]) {
      await api().post("/api/usuarios").set(auth(admin)).send({ email, password: "secreto1", name: role, role });
    }
    empleado = (await login("emp@test.com", "secreto1")).body.token;
    cajero = (await login("caj@test.com", "secreto1")).body.token;
  });

  it("con el módulo apagado no se puede usar", async () => {
    await configurar({ moduloPresupuestos: false });
    expect((await api().get("/api/presupuestos").set(auth(admin))).status).toBe(403);
    await configurar({ moduloPresupuestos: true });
    expect((await api().get("/api/presupuestos").set(auth(admin))).status).toBe(200);
  });

  it("solo administradores y empleados", async () => {
    expect((await api().get("/api/presupuestos").set(auth(cajero))).status).toBe(403);
    expect((await api().get("/api/presupuestos")).status).toBe(401);
  });

  it("calcula totales con líneas del catálogo y líneas libres, y no toca stock", async () => {
    const res = await crear({
      clienteId,
      lineas: [
        { servicioId: producto, cantidad: 2, precio: 100 },
        { descripcion: "Instalación", cantidad: 1, precio: 40 },
        { servicioId: exento, cantidad: 1, precio: 50 },
      ],
      observaciones: "Incluye traslado",
    });
    expect(res.status).toBe(201);
    // gravado: 200 + 40 = 240 (+16% = 38,40); exento 50
    expect(res.body).toMatchObject({ subtotal: 290, impuesto: 38.4, total: 328.4, estado: "BORRADOR", estadoVisible: "BORRADOR", impuestoTasa: 16 });
    expect(res.body.condiciones).toBe("Precios sujetos a disponibilidad.");
    expect(res.body.detalles).toHaveLength(3);
    expect(res.body.detalles[1]).toMatchObject({ servicioId: null, descripcion: "Instalación", exento: false });
    expect(res.body.detalles[0].descripcion).toBe("Aire acondicionado");
    // La validez por defecto sale de la configuración (10 días).
    const dias = Math.round((new Date(res.body.validoHasta).getTime() - Date.now()) / 86_400_000);
    expect(dias).toBeGreaterThanOrEqual(9);
    expect(dias).toBeLessThanOrEqual(10);

    expect((await prisma.servicio.findUnique({ where: { id: producto } }))!.stockActual).toBe(5);
    expect(await prisma.inventarioMovimiento.count()).toBe(0);
  });

  it("pide cliente o nombre de contacto, y líneas válidas", async () => {
    expect((await crear({ lineas: [{ servicioId: producto, cantidad: 1, precio: 10 }] })).status).toBe(400);
    expect((await crear({ contactoNombre: "Pedro", lineas: [] })).status).toBe(400);
    expect((await crear({ contactoNombre: "Pedro", lineas: [{ cantidad: 1, precio: 10 }] })).status).toBe(400);
    expect((await crear({ contactoNombre: "Pedro", lineas: [{ servicioId: 99999, cantidad: 1, precio: 10 }] })).status).toBe(400);
    expect((await crear({ contactoNombre: "Pedro", lineas: [{ descripcion: "X", cantidad: 0, precio: 10 }] })).status).toBe(400);
    const ok = await crear({ contactoNombre: "Pedro", contactoTelefono: "0414", lineas: [{ descripcion: "Visita técnica", cantidad: 1, precio: 20 }] });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ clienteId: null, contactoNombre: "Pedro", contactoTelefono: "0414" });
  });

  it("respeta el tope de descuento de quien no es administrador", async () => {
    const lineas = [{ servicioId: producto, cantidad: 1, precio: 100 }];
    const alto = await crear({ clienteId, lineas, descuento: { tipo: "PORCENTAJE", valor: 30 } }, empleado);
    expect(alto.status).toBe(403);
    expect(alto.body.message).toMatch(/10%/);
    expect((await crear({ clienteId, lineas, descuento: { tipo: "PORCENTAJE", valor: 30 } })).status).toBe(201);
    expect((await crear({ clienteId, lineas, descuento: { tipo: "PORCENTAJE", valor: 10 } }, empleado)).status).toBe(201);
  });

  it("edita y recalcula; cambia de estado; se marca vencido pasada la fecha", async () => {
    const p = (await crear({ clienteId, lineas: [{ servicioId: producto, cantidad: 1, precio: 100 }] })).body;
    const editado = await api()
      .put(`/api/presupuestos/${p.id}`)
      .set(auth(admin))
      .send({ clienteId, lineas: [{ servicioId: producto, cantidad: 3, precio: 90 }], validoHasta: "2020-01-31" });
    expect(editado.status).toBe(200);
    expect(editado.body).toMatchObject({ subtotal: 270, impuesto: 43.2, total: 313.2, estadoVisible: "VENCIDO", estado: "BORRADOR" });
    expect(editado.body.detalles).toHaveLength(1);

    const vencidos = await api().get("/api/presupuestos?estado=VENCIDO").set(auth(admin));
    expect(vencidos.body.map((x: { id: number }) => x.id)).toContain(p.id);

    // Un presupuesto ya aceptado no figura como vencido aunque pase la fecha.
    expect((await estado(p.id, "ACEPTADO")).body).toMatchObject({ estado: "ACEPTADO", estadoVisible: "ACEPTADO" });
    expect((await estado(p.id, "CONVERTIDO")).status).toBe(400);
    expect((await estado(p.id, "ENVIADO")).body.estado).toBe("ENVIADO");
  });

  it("busca por número y por cliente", async () => {
    const p = (await crear({ contactoNombre: "Zoila Buscada", lineas: [{ descripcion: "Cosa", cantidad: 1, precio: 5 }] })).body;
    const porNombre = await api().get("/api/presupuestos?q=zoila").set(auth(admin));
    expect(porNombre.body.map((x: { id: number }) => x.id)).toEqual([p.id]);
    const porNumero = await api().get(`/api/presupuestos?q=%23${p.id}`).set(auth(admin));
    expect(porNumero.body.map((x: { id: number }) => x.id)).toContain(p.id);
  });

  it("al convertir crea la venta (con stock y líneas libres como servicios) y se bloquea", async () => {
    const p = (
      await crear({
        clienteId,
        lineas: [
          { servicioId: producto, cantidad: 2, precio: 100 },
          { descripcion: "Instalación de equipo", cantidad: 1, precio: 40 },
        ],
      })
    ).body;
    await estado(p.id, "ACEPTADO");

    const res = await convertir(p.id);
    expect(res.status).toBe(200);
    expect(res.body.presupuesto).toMatchObject({ estado: "CONVERTIDO", estadoVisible: "CONVERTIDO", ordenId: res.body.ordenId });

    const orden = (await api().get(`/api/ordenes/${res.body.ordenId}`).set(auth(admin))).body;
    expect(orden).toMatchObject({ clienteId, subtotal: 240, impuesto: 38.4, total: 278.4 });
    expect(orden.observaciones).toContain(`presupuesto N.º ${p.id}`);
    expect(orden.detalles).toHaveLength(2);

    // La línea libre pasó a ser un servicio del catálogo.
    const servicio = await prisma.servicio.findFirst({ where: { nombreServicio: "Instalación de equipo" }, include: { categoria: true } });
    expect(servicio).toMatchObject({ precioBase: 40, tipo: "SERVICIO", controlaStock: false });
    expect(servicio!.categoria.nombre).toBe("Servicios varios");

    // Otro presupuesto con la misma descripción reutiliza el servicio.
    const otro = (await crear({ clienteId, lineas: [{ descripcion: "Instalación de equipo", cantidad: 1, precio: 45 }] })).body;
    expect((await convertir(otro.id)).status).toBe(200);
    expect(await prisma.servicio.count({ where: { nombreServicio: "Instalación de equipo" } })).toBe(1);

    // Ya convertido: no se edita, no se elimina, no se vuelve a convertir.
    expect((await api().put(`/api/presupuestos/${p.id}`).set(auth(admin)).send({ clienteId, lineas: [{ servicioId: producto, cantidad: 1, precio: 1 }] })).status).toBe(409);
    expect((await api().delete(`/api/presupuestos/${p.id}`).set(auth(admin))).status).toBe(409);
    expect((await convertir(p.id)).status).toBe(409);
    expect((await estado(p.id, "RECHAZADO")).status).toBe(409);
  });

  it("no convierte si está rechazado o si falta el cliente", async () => {
    const rechazado = (await crear({ clienteId, lineas: [{ descripcion: "Algo", cantidad: 1, precio: 10 }] })).body;
    await estado(rechazado.id, "RECHAZADO");
    expect((await convertir(rechazado.id)).status).toBe(409);

    const prospecto = (await crear({ contactoNombre: "Sin ficha", lineas: [{ descripcion: "Trabajo", cantidad: 1, precio: 10 }] })).body;
    const r2 = await convertir(prospecto.id);
    expect(r2.status).toBe(400);
    expect(r2.body.message).toMatch(/cliente/i);
    const r3 = await convertir(prospecto.id, { clienteId });
    expect(r3.status).toBe(200);
    expect(r3.body.presupuesto.clienteId).toBe(clienteId);
  });

  it("lista solo los presupuestos de un cliente", async () => {
    const otro = await prisma.cliente.create({ data: { nombre: "Otro", direccion: "X", identificacion: "V-999" } });
    const mio = (await crear({ clienteId: otro.id, lineas: [{ descripcion: "Solo mío", cantidad: 1, precio: 5 }] })).body;
    const res = await api().get(`/api/presupuestos?clienteId=${otro.id}`).set(auth(admin));
    expect(res.body.map((x: { id: number }) => x.id)).toEqual([mio.id]);
    const todos = await api().get("/api/presupuestos").set(auth(admin));
    expect(todos.body.length).toBeGreaterThan(1);
  });

  it("avisa de los presupuestos vencidos y por vencer, en su ruta y en el dashboard", async () => {
    await prisma.presupuestoDetalle.deleteMany();
    await prisma.presupuesto.deleteMany();
    const dia = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const linea = [{ descripcion: "Algo", cantidad: 1, precio: 10 }];
    const ayer = (await crear({ clienteId, lineas: linea, validoHasta: dia(-1) })).body;
    await crear({ clienteId, lineas: linea, validoHasta: dia(-20) }); // vencido
    await crear({ clienteId, lineas: linea, validoHasta: dia(0) }); // vence hoy
    await crear({ clienteId, lineas: linea, validoHasta: dia(3) }); // dentro del aviso
    await crear({ clienteId, lineas: linea, validoHasta: dia(4) }); // todavía lejos
    const aceptado = (await crear({ clienteId, lineas: linea, validoHasta: dia(-5) })).body;
    await estado(aceptado.id, "ACEPTADO"); // resuelto: no cuenta

    const res = await api().get("/api/presupuestos/alertas").set(auth(admin));
    expect(res.body).toEqual({ vencidos: 2, porVencer: 2, diasAviso: 3 });

    const dash = await api().get("/api/reportes/dashboard").set(auth(admin));
    expect(dash.body.presupuestos).toEqual({ vencidos: 2, porVencer: 2, diasAviso: 3 });

    // Al ampliar la fecha deja de estar vencido.
    await api().put(`/api/presupuestos/${ayer.id}`).set(auth(admin)).send({ clienteId, lineas: linea, validoHasta: dia(10) });
    expect((await api().get("/api/presupuestos/alertas").set(auth(admin))).body.vencidos).toBe(1);

    // Con el módulo apagado no hay alertas en el dashboard.
    await configurar({ moduloPresupuestos: false });
    expect((await api().get("/api/reportes/dashboard").set(auth(admin))).body.presupuestos).toBeUndefined();
    await configurar({ moduloPresupuestos: true });
  });

  it("elimina un presupuesto no convertido", async () => {
    const p = (await crear({ clienteId, lineas: [{ descripcion: "Borrar", cantidad: 1, precio: 1 }] })).body;
    expect((await api().delete(`/api/presupuestos/${p.id}`).set(auth(admin))).status).toBe(200);
    expect((await leer(p.id)).status).toBe(404);
  });
});
