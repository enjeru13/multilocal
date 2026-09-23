import { Link, useLocation } from "react-router-dom";
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
} from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/configuracionCore";
import type { Role } from "@lavanderia/shared/types/types";
import type { JSX } from "react";

export default function Sidebar() {
  const location = useLocation();
  const { hasRole, isAuthenticated } = useAuth();
  const { t, config } = useConfiguracion();

  const links: {
    section: string;
    items: { to: string; label: string; icon: JSX.Element; roles: Role[]; visible?: boolean }[];
  }[] = [
      {
        section: "Gestión",
        items: [
          {
            to: "/",
            label: "Inicio",
            icon: <FaHome />,
            roles: ["ADMIN", "EMPLOYEE", "CAJERO"],
          },
          {
            to: "/venta",
            label: "Vender",
            icon: <FaBarcode />,
            roles: ["ADMIN", "EMPLOYEE", "CAJERO"],
            visible: !!config && config.moduloFechaEntrega === false,
          },
          {
            to: "/ordenes",
            label: t("orden"),
            icon: <FaClipboardList />,
            roles: ["ADMIN", "EMPLOYEE", "CAJERO"],
          },
          {
            to: "/clientes",
            label: t("cliente"),
            icon: <FaUsers />,
            roles: ["ADMIN", "EMPLOYEE", "CAJERO"],
          },
          {
            to: "/servicios",
            label: t("servicio"),
            icon: <FaTshirt />,
            roles: ["ADMIN", "EMPLOYEE"],
          },
          {
            to: "/inventario",
            label: "Inventario",
            icon: <FaBoxes />,
            roles: ["ADMIN", "EMPLOYEE"],
            visible: !!config?.moduloInventario,
          },
          {
            to: "/proveedores",
            label: "Proveedores",
            icon: <FaTruck />,
            roles: ["ADMIN", "EMPLOYEE"],
            visible: !!config?.moduloProveedores,
          },
        ],
      },
      {
        section: "Finanzas",
        items: [
          {
            to: "/caja",
            label: "Caja",
            icon: <FaCashRegister />,
            roles: ["ADMIN", "EMPLOYEE", "CAJERO"],
            visible: !!config?.moduloCaja,
          },
          {
            to: "/gastos",
            label: "Gastos",
            icon: <FaMoneyCheckAlt />,
            roles: ["ADMIN", "EMPLOYEE"],
          },
          {
            to: "/por-pagar",
            label: "Por pagar",
            icon: <FaFileInvoiceDollar />,
            roles: ["ADMIN", "EMPLOYEE"],
            visible: !!config?.moduloProveedores,
          },
          {
            to: "/reportes",
            label: "Reportes",
            icon: <FaChartLine />,
            roles: ["ADMIN"],
          },
          {
            to: "/pagos",
            label: "Pagos",
            icon: <FaMoneyBillWave />,
            roles: ["ADMIN"],
          },
          {
            to: "/estado-ordenes",
            label: `Estado de ${t("orden")}`,
            icon: <FaChartBar />,
            roles: ["ADMIN"],
          },
        ],
      },
      {
        section: "Configuración",
        items: [
          {
            to: "/configuracion",
            label: "Configuración",
            icon: <FaCog />,
            roles: ["ADMIN"],
          },
          {
            to: "/usuarios",
            label: "Usuarios",
            icon: <FaUserShield />,
            roles: ["ADMIN"],
          },
          {
            to: "/respaldos",
            label: "Respaldos",
            icon: <FaDatabase />,
            roles: ["ADMIN"],
          },
        ],
      },
    ];

  if (!isAuthenticated) {
    return null;
  }

  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 h-screen flex flex-col sticky top-0">
      <div className="h-16 flex items-center px-6 text-lg font-bold tracking-tight border-b border-slate-800">
        Menú
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5 flex flex-col gap-6">
        {links.map((grupo) => {
          const visibleItems = grupo.items.filter(
            (link) => hasRole(link.roles) && link.visible !== false
          );

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div key={grupo.section}>
              <p className="px-3 text-[11px] uppercase font-semibold text-slate-500 mb-2 tracking-wider">
                {grupo.section}
              </p>
              <ul className="flex flex-col gap-0.5">
                {visibleItems.map((link) => {
                  const isActive = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm transition-colors border-l-2 ${
                        isActive
                          ? "bg-blue-500/10 border-blue-500 text-white font-semibold"
                          : "border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      }`}
                    >
                      <span
                        className={`text-base ${
                          isActive ? "text-blue-400" : "text-slate-500"
                        }`}
                      >
                        {link.icon}
                      </span>
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
