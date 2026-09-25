import request from "supertest";
import { createApp } from "../src/app";
import prisma from "../src/lib/prisma";
import { reiniciarLimites } from "../src/lib/limiteIntentos";

export const app = createApp();
export const api = () => request(app);
export { prisma };

export async function resetDb() {
  reiniciarLimites();
  await prisma.presupuestoDetalle.deleteMany();
  await prisma.presupuesto.deleteMany();
  await prisma.pagoCompra.deleteMany();
  await prisma.gasto.deleteMany();
  await prisma.inventarioMovimiento.deleteMany();
  await prisma.compraDetalle.deleteMany();
  await prisma.compra.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.devolucionDetalle.deleteMany();
  await prisma.devolucion.deleteMany();
  await prisma.vueltoEntregado.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.detalleOrden.deleteMany();
  await prisma.orden.deleteMany();
  await prisma.cajaMovimiento.deleteMany();
  await prisma.cajaSesion.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  await prisma.configuracion.deleteMany();
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Crea el primer usuario vía setup (único camino público) y devuelve su token. */
export async function crearAdmin(email = "admin@test.com", password = "secreto1") {
  const res = await api().post("/api/auth/register").send({ email, password, name: "Admin", role: "EMPLOYEE" });
  return { token: res.body.token as string, user: res.body.user, status: res.status, password };
}

export async function login(email: string, password: string) {
  return api().post("/api/auth/login").send({ email, password });
}

export async function configurar(data: Record<string, unknown> = {}) {
  return prisma.configuracion.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, nombreNegocio: "Negocio Test", monedaPrincipal: "USD", tasaUSD: 1, tasaVES: 500, tasaCOP: 4000, ...data },
  });
}

export async function crearFixtures() {
  const categoria = await prisma.categoria.create({ data: { nombre: "General" } });
  const cliente = await prisma.cliente.create({
    data: { nombre: "Ana", apellido: "Pérez", tipo: "NATURAL", telefono: "04141234567", direccion: "Calle 1", identificacion: "V-1" },
  });
  return { categoria, cliente };
}

export async function crearServicio(categoriaId: string, data: Record<string, unknown> = {}) {
  return prisma.servicio.create({
    data: { nombreServicio: "Item", precioBase: 10, categoriaId, ...data } as never,
  });
}

export async function crearOrden(token: string, clienteId: number, items: { servicioId: number; cantidad: number; precio?: number }[]) {
  return api().post("/api/ordenes").set(auth(token)).send({ clienteId, estado: "PENDIENTE", servicios: items });
}
