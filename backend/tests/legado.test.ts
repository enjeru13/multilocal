import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { api, auth, resetDb, crearAdmin, prisma } from "./helpers";

/** Crea un respaldo con la forma del sistema anterior (sin las tablas nuevas). */
function crearLegado(): string {
  const ruta = path.join(os.tmpdir(), `legado-test-${Date.now()}.db`);
  const db = new DatabaseSync(ruta);
  const ahora = Date.now();
  db.exec(`
    CREATE TABLE User (id INTEGER PRIMARY KEY, email TEXT, password TEXT, name TEXT, role TEXT, createdAt INTEGER, updatedAt INTEGER);
    CREATE TABLE Categoria (id TEXT PRIMARY KEY, nombre TEXT, createdAt INTEGER, updatedAt INTEGER);
    CREATE TABLE Cliente (id INTEGER PRIMARY KEY, nombre TEXT, apellido TEXT, tipo TEXT, telefono TEXT, telefono_secundario TEXT, direccion TEXT, identificacion TEXT, email TEXT, fechaRegistro INTEGER);
    CREATE TABLE Servicio (id INTEGER PRIMARY KEY, nombreServicio TEXT, descripcion TEXT, precioBase REAL, permiteDecimales INTEGER, categoriaId TEXT);
    CREATE TABLE Orden (id INTEGER PRIMARY KEY, clienteId INTEGER, estado TEXT, fechaIngreso INTEGER, fechaEntrega INTEGER, observaciones TEXT, total REAL, abonado REAL, faltante REAL, estadoPago TEXT, deliveredByUserId INTEGER, deliveredByUserName TEXT);
    CREATE TABLE DetalleOrden (id INTEGER PRIMARY KEY, ordenId INTEGER, servicioId INTEGER, cantidad REAL, precioUnit REAL, subtotal REAL);
    CREATE TABLE Pago (id INTEGER PRIMARY KEY, ordenId INTEGER, monto REAL, moneda TEXT, metodoPago TEXT, tasa REAL, nota TEXT, fechaPago INTEGER);
    CREATE TABLE VueltoEntregado (id INTEGER PRIMARY KEY, pagoId INTEGER, monto REAL, moneda TEXT);
    CREATE TABLE Configuracion (id INTEGER PRIMARY KEY, nombreNegocio TEXT, monedaPrincipal TEXT, tasaUSD REAL, tasaVES REAL, tasaCOP REAL, rif TEXT, direccion TEXT, telefonoPrincipal TEXT, telefonoSecundario TEXT, mensajePieRecibo TEXT);
  `);
  const hash = bcrypt.hashSync("clave-vieja", 4);
  db.prepare("INSERT INTO User VALUES (?,?,?,?,?,?,?)").run(7, "duena@lavanderia.com", hash, "Gisselle", "ADMIN", ahora, ahora);
  db.prepare("INSERT INTO Categoria VALUES (?,?,?,?)").run("cat-1", "Ropa", ahora, ahora);
  db.prepare("INSERT INTO Cliente VALUES (?,?,?,?,?,?,?,?,?,?)").run(3, "Luis", "Mora", "NATURAL", "0414", null, "Calle 1", "V-1", null, ahora);
  db.prepare("INSERT INTO Servicio VALUES (?,?,?,?,?,?)").run(5, "Lavado por kilo", null, 4, 1, "cat-1");
  db.prepare("INSERT INTO Orden VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(40, 3, "ENTREGADO", ahora, null, null, 8, 8, 0, "COMPLETO", 7, "Gisselle");
  db.prepare("INSERT INTO DetalleOrden VALUES (?,?,?,?,?,?)").run(90, 40, 5, 2, 4, 8);
  db.prepare("INSERT INTO Pago VALUES (?,?,?,?,?,?,?,?)").run(11, 40, 8, "USD", "EFECTIVO", 1, null, ahora);
  db.prepare("INSERT INTO Configuracion VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(1, "Lavandería Gisselle", "USD", 1, 800, 4000, "J-1", "San Cristóbal", "0276", null, "Gracias");
  db.close();
  return ruta;
}

describe("importar datos del sistema anterior", () => {
  let token: string;
  let legado: string;
  const subir = (q = "") =>
    api().post(`/api/respaldos/importar-legado${q}`).set(auth(token)).set("Content-Type", "application/octet-stream").send(fs.readFileSync(legado));

  beforeAll(async () => {
    await resetDb();
    token = (await crearAdmin()).token;
    legado = crearLegado();
  });

  it("la simulación cuenta lo que trae sin tocar nada", async () => {
    const r = await subir("?simular=1");
    expect(r.status).toBe(200);
    expect(r.body.resumen).toMatchObject({ clientes: 1, servicios: 1, ordenes: 1, pagos: 1, usuarios: 1, negocio: "Lavandería Gisselle" });
    expect(await prisma.orden.count()).toBe(0);
  });

  it("importa conservando IDs y contraseñas, y deja los contadores al día", async () => {
    const r = await subir();
    expect(r.status).toBe(200);
    expect(r.body.respaldoPrevio).toMatch(/^previo-/);

    expect(await prisma.orden.findUnique({ where: { id: 40 } })).toMatchObject({ total: 8, estadoPago: "COMPLETO" });
    expect(await prisma.user.count()).toBe(1);
    const login = await api().post("/api/auth/login").send({ email: "duena@lavanderia.com", password: "clave-vieja" });
    expect(login.status).toBe(200);
    token = login.body.token; // el usuario anterior ya no existe: se entra con el importado

    const nuevo = await prisma.cliente.create({ data: { nombre: "Nuevo", telefono: "1", direccion: "x", identificacion: "V-2" } });
    expect(nuevo.id).toBe(4);
  });

  it("rechaza archivos que no son del sistema anterior", async () => {
    const basura = await api().post("/api/respaldos/importar-legado").set(auth(token)).set("Content-Type", "application/octet-stream").send(Buffer.from("no soy una base"));
    expect(basura.status).toBe(400);
  });
});
