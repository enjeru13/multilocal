import { describe, it, expect, beforeAll } from "vitest";
import { api, auth, prisma, resetDb, crearAdmin, login, configurar, crearFixtures, crearServicio } from "./helpers";
import { parsearBooleano, parsearNumero } from "../src/lib/importarProductos";

describe("lectura de números y sí/no", () => {
  it("entiende los formatos habituales", () => {
    expect(parsearNumero(1234.5)).toBe(1234.5);
    expect(parsearNumero("12")).toBe(12);
    expect(parsearNumero("12,5")).toBe(12.5);
    expect(parsearNumero("12.5")).toBe(12.5);
    expect(parsearNumero("1.234,50")).toBe(1234.5);
    expect(parsearNumero("1,234.50")).toBe(1234.5);
    expect(parsearNumero("$ 1.250")).toBe(1250); // tres cifras tras el punto: miles
    expect(parsearNumero("Bs. 12.500,75")).toBe(12500.75);
    expect(parsearNumero("1.234.567")).toBe(1234567);
    expect(parsearNumero("0.125")).toBe(0.125);
    expect(parsearNumero("0,5")).toBe(0.5);
    expect(parsearNumero("-3")).toBe(-3);
    expect(parsearNumero("  ")).toBeUndefined();
    expect(parsearNumero(null)).toBeUndefined();
    expect(parsearNumero("abc")).toBeNaN();
    expect(parsearNumero("1.2.3.x")).not.toBeUndefined();
  });

  it("entiende sí/no en español e inglés", () => {
    for (const v of ["sí", "SI", "s", "x", "1", "true", "Exento"]) expect(parsearBooleano(v)).toBe(true);
    for (const v of ["no", "N", "0", "false"]) expect(parsearBooleano(v)).toBe(false);
    expect(parsearBooleano("quizás")).toBeUndefined();
    expect(parsearBooleano("")).toBeUndefined();
    expect(parsearBooleano(true)).toBe(true);
  });
});

describe("importar productos desde un archivo", () => {
  let admin: string;
  let empleado: string;

  const importar = (filas: Record<string, unknown>[], extra: Record<string, unknown> = {}, token = admin) =>
    api().post("/api/servicios/importar").set(auth(token)).send({ filas, simular: true, ...extra });
  const aplicar = (filas: Record<string, unknown>[], extra: Record<string, unknown> = {}, token = admin) => importar(filas, { ...extra, simular: false }, token);

  beforeAll(async () => {
    await resetDb();
    admin = (await crearAdmin()).token;
    await configurar({ moduloInventario: true, tasaVES: 100, tasaCOP: 4000, monedaPrincipal: "USD" });
    await api().post("/api/usuarios").set(auth(admin)).send({ email: "emp@test.com", password: "secreto1", name: "Emp", role: "EMPLOYEE" });
    empleado = (await login("emp@test.com", "secreto1")).body.token;
  });

  it("solo la administración puede importar", async () => {
    expect((await importar([{ fila: 2, nombre: "X", precio: 1 }], {}, empleado)).status).toBe(403);
    expect((await api().post("/api/servicios/importar").send({})).status).toBe(401);
    expect((await importar([])).status).toBe(400);
  });

  it("la vista previa no guarda nada y explica cada fila", async () => {
    const res = await importar([
      { fila: 2, nombre: "Filtro de aceite", sku: "FA-1", precio: "12,50", costo: 8, stock: 20, stockMinimo: 5, categoria: "Filtros", exento: "no" },
      { fila: 3, nombre: "Pastillas de freno", sku: "PF-1", precio: "1.250", stock: "10" },
      { fila: 4, nombre: "", precio: 5 }, // sin nombre
      { fila: 5, nombre: "Bujía", sku: "BJ-1", precio: "abc" }, // precio inválido
      { fila: 6, nombre: "Sin precio" },
      { fila: 7 }, // en blanco: se ignora
    ]);
    expect(res.status).toBe(200);
    expect(res.body.aplicado).toBe(false);
    expect(res.body.resumen).toEqual({ total: 5, crear: 2, actualizar: 0, sinCambios: 0, errores: 3 });
    const porFila = Object.fromEntries(res.body.filas.map((f: { fila: number }) => [f.fila, f]));
    expect(porFila[4].errores[0]).toMatch(/nombre/);
    expect(porFila[5].errores[0]).toMatch(/no es un número/);
    expect(porFila[6].errores.join(" ")).toMatch(/precio/);
    expect(await prisma.servicio.count()).toBe(0);
  });

  it("crea productos con categoría, existencias y movimiento de carga inicial", async () => {
    const res = await aplicar([
      { fila: 2, nombre: "Filtro de aceite", sku: "FA-1", codigoBarras: "7591234", precio: "12,50", costo: 8, stock: 20, stockMinimo: 5, categoria: "Filtros", exento: "no", unidad: "unidad" },
      { fila: 3, nombre: "Aceite 20W50", sku: "AC-1", precio: 9, stock: 12.5, unidad: "litros", categoria: "filtros" }, // misma categoría aunque cambie el caso
      { fila: 4, nombre: "Mano de obra", precio: 15 }, // sin código ni existencias: servicio
      { fila: 5, nombre: "Sin precio" }, // se omite
    ]);
    expect(res.status).toBe(200);
    expect(res.body.aplicado).toBe(true);
    expect(res.body.resumen).toMatchObject({ crear: 3, errores: 1 });

    const filtro = await prisma.servicio.findFirst({ where: { sku: "FA-1" }, include: { categoria: true } });
    expect(filtro).toMatchObject({ nombreServicio: "Filtro de aceite", precioBase: 12.5, costoBase: 8, stockActual: 20, stockMinimo: 5, controlaStock: true, tipo: "PRODUCTO", codigoBarras: "7591234", exentoImpuesto: false });
    expect(filtro!.categoria.nombre).toBe("Filtros");
    const aceite = await prisma.servicio.findFirst({ where: { sku: "AC-1" } });
    expect(aceite).toMatchObject({ permiteDecimales: true, stockActual: 12.5, unidadMedida: "litros" });
    const mano = await prisma.servicio.findFirst({ where: { nombreServicio: "Mano de obra" } });
    expect(mano).toMatchObject({ tipo: "SERVICIO", controlaStock: false, precioBase: 15 });
    expect(await prisma.categoria.count({ where: { nombre: { in: ["Filtros", "filtros"] } } })).toBe(1);
    expect(await prisma.categoria.count({ where: { nombre: "Sin categoría" } })).toBe(1);

    const mov = await prisma.inventarioMovimiento.findMany({ where: { servicioId: filtro!.id } });
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ tipo: "ENTRADA", cantidad: 20, stockResultante: 20, motivo: "AJUSTE_MANUAL", nota: "Carga inicial desde archivo" });
    expect(await prisma.servicio.count()).toBe(3);
  });

  it("al repetir el archivo actualiza por código en vez de duplicar, y ajusta existencias con movimiento", async () => {
    const preview = await importar([
      { fila: 2, sku: "fa-1", precio: 14, stock: 25 }, // el código coincide sin importar mayúsculas
      { fila: 3, nombre: "Aceite 20W50", sku: "AC-1", precio: 9, stock: 12.5 }, // igual: sin cambios
      { fila: 4, nombre: "Mano de obra", precio: 15 }, // coincide por nombre
    ]);
    expect(preview.body.resumen).toMatchObject({ crear: 0, actualizar: 1, sinCambios: 2, errores: 0 });
    const f = preview.body.filas.find((x: { fila: number }) => x.fila === 2);
    expect(f.coincide).toMatchObject({ nombre: "Filtro de aceite", por: "código" });
    expect(f.cambios).toEqual(["precio 12.5 → 14", "existencias 20 → 25"]);

    await aplicar([{ fila: 2, sku: "FA-1", precio: 14, stock: 25 }, { fila: 3, sku: "AC-1", stock: 10 }]);
    const filtro = await prisma.servicio.findFirst({ where: { sku: "FA-1" } });
    expect(filtro).toMatchObject({ precioBase: 14, stockActual: 25, costoBase: 8 }); // el costo no venía: se conserva
    const aceite = await prisma.servicio.findFirst({ where: { sku: "AC-1" } });
    expect(aceite!.stockActual).toBe(10);
    const movs = await prisma.inventarioMovimiento.findMany({ where: { servicioId: aceite!.id }, orderBy: { id: "asc" } });
    expect(movs.map((m) => [m.tipo, m.cantidad, m.stockResultante])).toEqual([["ENTRADA", 12.5, 12.5], ["SALIDA", 2.5, 10]]);
    expect(await prisma.servicio.count()).toBe(3);
  });

  it("detecta códigos repetidos, conflictos y productos con el mismo nombre", async () => {
    await prisma.servicio.create({ data: { nombreServicio: "Gemelo", precioBase: 1, categoriaId: (await prisma.categoria.findFirstOrThrow()).id } });
    await prisma.servicio.create({ data: { nombreServicio: "gemelo", precioBase: 2, categoriaId: (await prisma.categoria.findFirstOrThrow()).id } });
    const res = await importar([
      { fila: 2, nombre: "Nuevo A", sku: "NA-1", precio: 5 },
      { fila: 3, nombre: "Nuevo B", sku: "NA-1", precio: 6 }, // repetido en el archivo
      { fila: 4, nombre: "Gemelo", precio: 3 }, // dos productos con ese nombre
      { fila: 5, nombre: "Cruzado", sku: "FA-1", codigoBarras: "otro-codigo", precio: 3 },
      { fila: 6, sku: "FA-1", precio: 1 },
      { fila: 7, sku: "FA-1", precio: 2 }, // el mismo producto dos veces
    ]);
    const porFila = Object.fromEntries(res.body.filas.map((f: { fila: number }) => [f.fila, f]));
    expect(porFila[2].accion).toBe("CREAR");
    expect(porFila[3].errores[0]).toMatch(/fila 2/);
    expect(porFila[4].errores[0]).toMatch(/2 productos llamados/);
    expect(porFila[5].accion).toBe("ACTUALIZAR"); // el código ya existe: actualiza ese producto
    expect(porFila[7].errores[0]).toMatch(/fila/);
  });

  it("convierte los precios desde otra moneda con la tasa del sistema", async () => {
    const res = await aplicar([{ fila: 2, nombre: "Pieza en bolívares", sku: "VES-1", precio: "1.250,00", costo: 800 }], { moneda: "VES" });
    expect(res.status).toBe(200);
    const p = await prisma.servicio.findFirstOrThrow({ where: { sku: "VES-1" } });
    expect(p.precioBase).toBe(12.5); // 1250 Bs a 100 Bs por dólar
    expect(p.costoBase).toBe(8);

    await configurar({ tasaVES: null });
    const sinTasa = await importar([{ fila: 2, nombre: "X", precio: 5 }], { moneda: "VES" });
    expect(sinTasa.status).toBe(400);
    expect(sinTasa.body.message).toMatch(/tasa de VES/);
    await configurar({ tasaVES: 100 });
  });

  it("existencias con decimales y sin unidad permiten vender por fracciones", async () => {
    const res = await aplicar([{ fila: 2, nombre: "Cable por metro", sku: "CB-1", precio: 2, stock: "12,5" }]);
    expect(res.body.filas[0].avisos.join(" ")).toMatch(/fracciones/);
    expect(await prisma.servicio.findFirst({ where: { sku: "CB-1" } })).toMatchObject({ permiteDecimales: true, stockActual: 12.5 });
  });

  it("con el inventario apagado no carga existencias y lo avisa", async () => {
    await configurar({ moduloInventario: false });
    const res = await aplicar([{ fila: 2, nombre: "Sin inventario", sku: "SI-1", precio: 4, stock: 9 }]);
    expect(res.body.filas[0].avisos.join(" ")).toMatch(/inventario está apagado/);
    const p = await prisma.servicio.findFirstOrThrow({ where: { sku: "SI-1" } });
    expect(p).toMatchObject({ controlaStock: false, stockActual: 0 });
    await configurar({ moduloInventario: true });
  });

  it("aguanta miles de filas", async () => {
    const filas = Array.from({ length: 2000 }, (_, i) => ({ fila: i + 2, nombre: `Producto ${i}`, sku: `MASIVO-${i}`, precio: 1 + (i % 50), stock: i % 30, categoria: `Cat ${i % 12}` }));
    const t0 = Date.now();
    const res = await aplicar(filas);
    expect(res.status).toBe(200);
    expect(res.body.resumen).toMatchObject({ crear: 2000, errores: 0 });
    expect(Date.now() - t0).toBeLessThan(60_000);
    expect(await prisma.servicio.count({ where: { sku: { startsWith: "MASIVO-" } } })).toBe(2000);
  }, 90_000);
});
