import { Link, useLocation } from "react-router-dom";
import {
  FaHome,
  FaUsers,
  FaClipboardList,
  FaTshirt,
  FaCog,
  FaChartBar,
  FaMoneyBillWave,
} from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/ConfiguracionContext";
import type { Role } from "@lavanderia/shared/types/types";
import type { JSX } from "react";

export default function Sidebar() {
  const location = useLocation();
  const { hasRole, isAuthenticated } = useAuth();
  const { t } = useConfiguracion();

  const links: {
    section: string;
    items: { to: string; label: string; icon: JSX.Element; roles: Role[] }[];
  }[] = [
      {
        section: "Gestión",
        items: [
          {
            to: "/",
            label: "Inicio",
            icon: <FaHome />,
            roles: ["ADMIN", "EMPLOYEE"],
          },
          {
            to: "/ordenes",
            label: t("orden"),
            icon: <FaClipboardList />,
            roles: ["ADMIN", "EMPLOYEE"],
          },
          {
            to: "/clientes",
            label: t("cliente"),
            icon: <FaUsers />,
            roles: ["ADMIN", "EMPLOYEE"],
          },
          {
            to: "/servicios",
            label: t("servicio"),
            icon: <FaTshirt />,
            roles: ["ADMIN", "EMPLOYEE"],
          },
        ],
      },
      {
        section: "Finanzas",
        items: [
          {
            to: "/pagos",
            label: "Pagos",
            icon: <FaMoneyBillWave />,
            roles: ["ADMIN"],
          },
          {
            to: "/estado-ordenes",
            label: "Estado de Órdenes",
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
          const visibleItems = grupo.items.filter((link) =>
            hasRole(link.roles)
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
