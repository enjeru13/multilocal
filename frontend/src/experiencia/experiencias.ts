import type { Rubro } from "@lavanderia/shared/types/types";

/**
 * Cada rubro tiene su propia "experiencia": qué pantalla abre primero, cómo se
 * ordena el menú, cómo se llaman las cosas, su color y qué atajos de teclado
 * tiene a mano. La lógica de negocio es la misma; lo que cambia es cómo se
 * siente trabajar con ella.
 */

export type NavId =
  | "recepcion"
  | "vender"
  | "resumen"
  | "tablero"
  | "ordenes"
  | "presupuestos"
  | "clientes"
  | "servicios"
  | "inventario"
  | "conteos"
  | "proveedores"
  | "porPagar"
  | "caja"
  | "gastos"
  | "reportes"
  | "pagos"
  | "estadoOrdenes"
  | "configuracion"
  | "usuarios"
  | "respaldos";

export type Acento = "blue" | "emerald" | "orange" | "indigo";

/** Cómo se atiende a un cliente: cobro inmediato en caja, factura en mostrador o recepción con entrega. */
export type ModoVenta = "CAJA" | "FACTURA" | "RECEPCION";

export interface Experiencia {
  rubro: Rubro;
  nombre: string;
  acento: Acento;
  modoVenta: ModoVenta;
  /** Pantalla a la que se entra al iniciar sesión. */
  inicio: string;
  secciones: { titulo: string; items: NavId[] }[];
  /** Tarjetas de accesos directos del inicio, en orden. */
  accesos: NavId[];
  etiquetas?: Partial<Record<NavId, string>>;
  atajos?: Partial<Record<NavId, string>>;
}

const FINANZAS: NavId[] = ["caja", "gastos", "reportes", "pagos"];

export const EXPERIENCIAS: Record<Rubro, Experiencia> = {
  MINIMARKET: {
    rubro: "MINIMARKET",
    nombre: "Minimarket",
    acento: "emerald",
    modoVenta: "CAJA",
    inicio: "/venta",
    secciones: [
      { titulo: "Venta", items: ["vender", "ordenes", "presupuestos", "resumen"] },
      { titulo: "Productos", items: ["servicios", "inventario", "conteos", "proveedores", "porPagar", "clientes"] },
      { titulo: "Finanzas", items: FINANZAS },
      { titulo: "Sistema", items: ["configuracion", "usuarios", "respaldos"] },
    ],
    accesos: ["vender", "ordenes", "inventario", "caja", "gastos", "reportes"],
    etiquetas: { vender: "Punto de venta", caja: "Cierre de caja", resumen: "Resumen" },
    atajos: { vender: "Alt+V", resumen: "Alt+H" },
  },
  REPUESTOS: {
    rubro: "REPUESTOS",
    nombre: "Repuestos y equipos",
    acento: "orange",
    modoVenta: "FACTURA",
    inicio: "/venta",
    secciones: [
      { titulo: "Mostrador", items: ["vender", "presupuestos", "ordenes", "clientes", "resumen"] },
      { titulo: "Almacén", items: ["servicios", "inventario", "conteos", "proveedores", "porPagar"] },
      { titulo: "Finanzas", items: FINANZAS },
      { titulo: "Sistema", items: ["configuracion", "usuarios", "respaldos"] },
    ],
    accesos: ["vender", "servicios", "clientes", "inventario", "porPagar", "reportes"],
    etiquetas: { vender: "Facturar", servicios: "Catálogo", resumen: "Resumen" },
    atajos: { vender: "Alt+F", servicios: "Alt+P", resumen: "Alt+H" },
  },
  LAVANDERIA: {
    rubro: "LAVANDERIA",
    nombre: "Lavandería",
    acento: "blue",
    modoVenta: "RECEPCION",
    inicio: "/",
    secciones: [
      { titulo: "Operación", items: ["recepcion", "tablero", "ordenes", "presupuestos", "clientes", "servicios"] },
      { titulo: "Finanzas", items: ["pagos", "caja", "gastos", "reportes", "estadoOrdenes"] },
      { titulo: "Sistema", items: ["configuracion", "usuarios", "respaldos"] },
    ],
    accesos: ["recepcion", "tablero", "ordenes", "clientes", "pagos", "reportes"],
    etiquetas: { recepcion: "Recepción", tablero: "Tablero" },
    atajos: { recepcion: "Alt+N", tablero: "Alt+T" },
  },
  GENERICO: {
    rubro: "GENERICO",
    nombre: "Negocio",
    acento: "indigo",
    modoVenta: "RECEPCION",
    inicio: "/",
    secciones: [
      { titulo: "Gestión", items: ["recepcion", "vender", "ordenes", "presupuestos", "clientes", "servicios", "inventario", "conteos", "proveedores", "porPagar"] },
      { titulo: "Finanzas", items: ["caja", "gastos", "reportes", "pagos", "estadoOrdenes"] },
      { titulo: "Sistema", items: ["configuracion", "usuarios", "respaldos"] },
    ],
    accesos: ["recepcion", "vender", "ordenes", "clientes", "servicios", "reportes"],
    etiquetas: { recepcion: "Inicio" },
  },
};

export const experienciaDe = (rubro: Rubro | undefined | null): Experiencia =>
  EXPERIENCIAS[rubro ?? "GENERICO"] ?? EXPERIENCIAS.GENERICO;

/** Atajo por defecto de cada destino, si la experiencia no define otro. */
export const ATAJO_BASE: Partial<Record<NavId, string>> = {
  recepcion: "Alt+N",
  vender: "Alt+V",
  resumen: "Alt+H",
  tablero: "Alt+T",
  ordenes: "Alt+O",
  presupuestos: "Alt+U",
  clientes: "Alt+C",
  servicios: "Alt+P",
  inventario: "Alt+I",
  proveedores: "Alt+R",
  porPagar: "Alt+D",
  caja: "Alt+A",
  gastos: "Alt+G",
  reportes: "Alt+E",
};
