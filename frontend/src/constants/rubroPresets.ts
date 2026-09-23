import type { Rubro, Terminologia } from "@lavanderia/shared/types/types";

export interface RubroPreset {
  label: string;
  descripcion: string;
  moduloInventario: boolean;
  moduloProveedores: boolean;
  moduloCaja: boolean;
  moduloFechaEntrega: boolean;
  moduloClienteTipo: boolean;
  clienteObligatorio: boolean;
  terminologia: Required<Terminologia>;
}

export const RUBRO_PRESETS: Record<Rubro, RubroPreset> = {
  LAVANDERIA: {
    label: "Lavandería",
    descripcion: "Servicios con fecha de entrega, sin control de stock.",
    moduloInventario: false,
    moduloProveedores: false,
    moduloCaja: false,
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
    label: "Venta de repuestos",
    descripcion: "Productos con stock, proveedores y compras.",
    moduloInventario: true,
    moduloProveedores: true,
    moduloCaja: true,
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
    descripcion: "Venta rápida de productos, con caja y stock.",
    moduloInventario: true,
    moduloProveedores: true,
    moduloCaja: true,
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
    descripcion: "Configura cada módulo manualmente.",
    moduloInventario: false,
    moduloProveedores: false,
    moduloCaja: false,
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
