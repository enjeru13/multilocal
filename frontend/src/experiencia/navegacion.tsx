import type { JSX } from "react";
import {
  FaHome,
  FaUsers,
  FaClipboardList,
  FaTshirt,
  FaCog,
  FaChartBar,
  FaChartLine,
  FaMoneyCheckAlt,
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaBoxes,
  FaTruck,
  FaCashRegister,
  FaUserShield,
  FaDatabase,
  FaBarcode,
  FaPlusCircle,
  FaColumns,
} from "react-icons/fa";
import type { Configuracion, Role } from "@lavanderia/shared/types/types";
import { ATAJO_BASE, experienciaDe, type Experiencia, type NavId } from "./experiencias";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/configuracionCore";

export interface ItemNav {
  id: NavId;
  to: string;
  label: string;
  descripcion: string;
  icon: JSX.Element;
  atajo?: string;
}

interface Def {
  to: string;
  icon: JSX.Element;
  roles: Role[];
  label: (t: (k: "orden" | "servicio" | "cliente") => string) => string;
  descripcion: string;
  visible?: (c: Configuracion | null) => boolean;
}

const TODOS: Role[] = ["ADMIN", "EMPLOYEE", "CAJERO"];
const GESTION: Role[] = ["ADMIN", "EMPLOYEE"];

const CATALOGO: Record<NavId, Def> = {
  recepcion: { to: "/", icon: <FaPlusCircle />, roles: TODOS, label: (t) => `Nueva ${t("orden").toLowerCase().replace(/s$/, "")}`, descripcion: "Registrar y cobrar" },
  vender: { to: "/venta", icon: <FaBarcode />, roles: TODOS, label: () => "Vender", descripcion: "Escanear, cobrar y entregar al momento", visible: (c) => !!c },
  resumen: { to: "/resumen", icon: <FaHome />, roles: TODOS, label: () => "Resumen", descripcion: "Cómo va el día" },
  tablero: { to: "/tablero", icon: <FaColumns />, roles: TODOS, label: () => "Tablero", descripcion: "Qué está pendiente, listo y por entregar", visible: (c) => c?.moduloFechaEntrega !== false },
  ordenes: { to: "/ordenes", icon: <FaClipboardList />, roles: TODOS, label: (t) => t("orden"), descripcion: "Historial y cobros" },
  clientes: { to: "/clientes", icon: <FaUsers />, roles: TODOS, label: (t) => t("cliente"), descripcion: "Fichas y contacto" },
  servicios: { to: "/servicios", icon: <FaTshirt />, roles: GESTION, label: (t) => t("servicio"), descripcion: "Precios, códigos y costos" },
  inventario: { to: "/inventario", icon: <FaBoxes />, roles: GESTION, label: () => "Inventario", descripcion: "Existencias y movimientos", visible: (c) => !!c?.moduloInventario },
  proveedores: { to: "/proveedores", icon: <FaTruck />, roles: GESTION, label: () => "Proveedores", descripcion: "Compras y reposición", visible: (c) => !!c?.moduloProveedores },
  porPagar: { to: "/por-pagar", icon: <FaFileInvoiceDollar />, roles: GESTION, label: () => "Por pagar", descripcion: "Deudas con proveedores", visible: (c) => !!c?.moduloProveedores },
  caja: { to: "/caja", icon: <FaCashRegister />, roles: TODOS, label: () => "Caja", descripcion: "Apertura, movimientos y cierre", visible: (c) => !!c?.moduloCaja },
  gastos: { to: "/gastos", icon: <FaMoneyCheckAlt />, roles: GESTION, label: () => "Gastos", descripcion: "Alquiler, servicios, sueldos…" },
  reportes: { to: "/reportes", icon: <FaChartLine />, roles: ["ADMIN"], label: () => "Reportes", descripcion: "Ventas, ganancia y cobros" },
  pagos: { to: "/pagos", icon: <FaMoneyBillWave />, roles: ["ADMIN"], label: () => "Pagos", descripcion: "Historial de cobros" },
  estadoOrdenes: { to: "/estado-ordenes", icon: <FaChartBar />, roles: ["ADMIN"], label: (t) => `Estado de ${t("orden")}`, descripcion: "Seguimiento detallado" },
  configuracion: { to: "/configuracion", icon: <FaCog />, roles: ["ADMIN"], label: () => "Configuración", descripcion: "Negocio, impuestos y módulos" },
  usuarios: { to: "/usuarios", icon: <FaUserShield />, roles: ["ADMIN"], label: () => "Usuarios", descripcion: "Accesos y roles" },
  respaldos: { to: "/respaldos", icon: <FaDatabase />, roles: ["ADMIN"], label: () => "Respaldos", descripcion: "Copias de seguridad" },
};

type TFn = (k: "orden" | "servicio" | "cliente") => string;

interface Contexto {
  experiencia: Experiencia;
  config: Configuracion | null;
  t: TFn;
  hasRole: (roles: Role[]) => boolean;
}

/** Un destino del menú ya resuelto para este negocio, o null si no aplica (rol o módulo apagado). */
export function construirItemNav(id: NavId, { experiencia, config, t, hasRole }: Contexto): ItemNav | null {
  const d = CATALOGO[id];
  if (!hasRole(d.roles)) return null;
  if (d.visible && !d.visible(config)) return null;
  // "Vender" solo existe donde hay venta directa; en lavandería la recepción es la venta.
  if (id === "vender" && config?.moduloFechaEntrega !== false && experiencia.rubro !== "GENERICO") return null;
  if (id === "recepcion" && config?.moduloFechaEntrega === false) return null;
  return {
    id,
    to: d.to,
    label: experiencia.etiquetas?.[id] ?? d.label(t),
    descripcion: d.descripcion,
    icon: d.icon,
    atajo: experiencia.atajos?.[id] ?? ATAJO_BASE[id],
  };
}

export interface SeccionNav {
  titulo: string;
  items: ItemNav[];
}

/** Menú, atajos y accesos directos del negocio actual, ya filtrados por rol y módulos activos. */
export function useNavegacion(): { experiencia: Experiencia; secciones: SeccionNav[]; accesos: ItemNav[]; todos: ItemNav[] } {
  const { hasRole } = useAuth();
  const { config, t } = useConfiguracion();
  const experiencia = experienciaDe(config?.rubro);

  const construir = (id: NavId) => construirItemNav(id, { experiencia, config, t, hasRole });

  const secciones = experiencia.secciones.map((s) => ({
    titulo: s.titulo,
    items: s.items.map(construir).filter((i): i is ItemNav => i !== null),
  }));

  // Si el perfil se ajustó a mano (p. ej. lavandería sin fecha de entrega), la venta
  // nunca puede quedar sin acceso: se agrega al inicio del menú.
  const presentes = new Set(secciones.flatMap((s) => s.items.map((i) => i.id)));
  const faltantes = (["vender", "recepcion"] as NavId[])
    .filter((id) => !presentes.has(id))
    .map(construir)
    .filter((i): i is ItemNav => i !== null);
  if (faltantes.length > 0 && secciones.length > 0) secciones[0].items.unshift(...faltantes);

  const visibles = secciones.filter((s) => s.items.length > 0);

  const accesos = experiencia.accesos.map(construir).filter((i): i is ItemNav => i !== null);
  const todos = visibles.flatMap((s) => s.items);
  return { experiencia, secciones: visibles, accesos: accesos.length > 0 ? accesos : todos.slice(0, 6), todos };
}
