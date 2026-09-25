import type { Rubro, Terminologia } from "@lavanderia/shared/types/types";

export interface RubroPreset {
  label: string;
  descripcion: string;
  moduloInventario: boolean;
  moduloProveedores: boolean;
  moduloCaja: boolean;
  moduloPresupuestos: boolean;
  moduloFechaEntrega: boolean;
  moduloClienteTipo: boolean;
  clienteObligatorio: boolean;
  terminologia: Required<Terminologia>;
}

export const RUBRO_PRESETS: Record<Rubro, RubroPreset> = {
  LAVANDERIA: {
    label: "Lavandería",
    descripcion: "Recibes la ropa, la sigues en un tablero, avisas por WhatsApp y entregas.",
    moduloInventario: false,
    moduloProveedores: false,
    moduloCaja: false,
    moduloPresupuestos: false,
    moduloFechaEntrega: true,
    moduloClienteTipo: true,
    clienteObligatorio: true,
    terminologia: {
      servicio: "Servicios",
      orden: "Órdenes",
      cliente: "Clientes",
      servicioUno: "Servicio",
      ordenUno: "Orden",
      clienteUno: "Cliente",
    },
  },
  REPUESTOS: {
    label: "Repuestos y equipos",
    descripcion: "Catálogo con códigos, facturación con precio editable, cotizaciones y proveedores.",
    moduloInventario: true,
    moduloProveedores: true,
    moduloCaja: true,
    moduloPresupuestos: true,
    moduloFechaEntrega: false,
    moduloClienteTipo: false,
    clienteObligatorio: false,
    terminologia: {
      servicio: "Productos",
      orden: "Ventas",
      cliente: "Clientes",
      servicioUno: "Producto",
      ordenUno: "Venta",
      clienteUno: "Cliente",
    },
  },
  MINIMARKET: {
    label: "Minimarket / tienda",
    descripcion: "Caja rápida con lector de códigos, teclas de función, stock y cierre de caja.",
    moduloInventario: true,
    moduloProveedores: true,
    moduloCaja: true,
    moduloPresupuestos: false,
    moduloFechaEntrega: false,
    moduloClienteTipo: false,
    clienteObligatorio: false,
    terminologia: {
      servicio: "Productos",
      orden: "Ventas",
      cliente: "Clientes",
      servicioUno: "Producto",
      ordenUno: "Venta",
      clienteUno: "Cliente",
    },
  },
  GENERICO: {
    label: "Genérico",
    descripcion: "Un punto de partida neutro: activas cada módulo a tu manera.",
    moduloInventario: false,
    moduloProveedores: false,
    moduloCaja: false,
    moduloPresupuestos: true,
    moduloFechaEntrega: true,
    moduloClienteTipo: true,
    clienteObligatorio: true,
    terminologia: {
      servicio: "Servicios",
      orden: "Órdenes",
      cliente: "Clientes",
      servicioUno: "Servicio",
      ordenUno: "Orden",
      clienteUno: "Cliente",
    },
  },
};
