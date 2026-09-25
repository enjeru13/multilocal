import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/configuracionCore";
import { useNavegacion } from "../experiencia/navegacion";
import Kbd from "../atajos/Kbd";
import InsigniaNav from "./presupuesto/InsigniaNav";
import { useEsCompacto } from "../hooks/useMediaQuery";

const CLAVE = "mostrador.sidebar";

/** Menú lateral: se arma según el rubro (orden, nombres, atajos) y los módulos activos; se puede plegar. */
export default function Sidebar() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { config } = useConfiguracion();
  const { secciones, experiencia } = useNavegacion();
  const compacto = useEsCompacto();
  const [plegadoGuardado, setPlegado] = useState(() => {
    try {
      return localStorage.getItem(CLAVE) === "1";
    } catch {
      return false;
    }
  });

  // En tablets (menos de 1024 px) el menú siempre va plegado: el contenido necesita el espacio.
  const plegado = plegadoGuardado || compacto;

  if (!isAuthenticated) return null;

  const alternar = () => {
    setPlegado((p) => {
      try {
        localStorage.setItem(CLAVE, p ? "0" : "1");
      } catch {
        /* solo esta sesión */
      }
      return !p;
    });
  };

  const negocio = config?.nombreNegocio?.trim() || "Mostrador";

  return (
    <aside
      className={`hidden md:flex ${plegado ? "w-[68px]" : "w-60"} shrink-0 h-dvh sticky top-0 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-[width] duration-200`}
    >
      {/* Marca */}
      <div className={`h-14 shrink-0 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 ${plegado ? "justify-center" : "px-4"}`}>
        <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-extrabold shrink-0" aria-hidden>
          {negocio.charAt(0).toUpperCase()}
        </span>
        {!plegado && (
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{negocio}</span>
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">{experiencia.nombre}</span>
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        {secciones.map((grupo) => (
          <div key={grupo.titulo}>
            {!plegado ? (
              <p className="px-3 mb-1.5 text-[11px] uppercase font-semibold tracking-wider text-gray-400 dark:text-gray-500">{grupo.titulo}</p>
            ) : (
              <div className="mx-3 mb-2 border-t border-gray-200 dark:border-gray-800" />
            )}
            <ul className="flex flex-col gap-0.5">
              {grupo.items.map((link) => {
                const activo = location.pathname === link.to;
                return (
                  <li key={link.id}>
                    <Link
                      to={link.to}
                      title={plegado ? `${link.label}${link.atajo ? ` (${link.atajo})` : ""}` : link.descripcion}
                      aria-current={activo ? "page" : undefined}
                      className={`group flex items-center gap-3 h-9 rounded-lg text-sm transition-colors ${plegado ? "justify-center px-0" : "px-3"} ${
                        activo
                          ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                      }`}
                    >
                      <span className={`relative text-[15px] shrink-0 ${activo ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"}`}>
                        {link.icon}
                        {plegado && link.id === "presupuestos" && <InsigniaNav flotante />}
                      </span>
                      {!plegado && (
                        <>
                          <span className="flex-1 truncate">{link.label}</span>
                          {link.id === "presupuestos" && <InsigniaNav />}
                          {link.atajo && (
                            <span className="hidden group-hover:block">
                              <Kbd combo={link.atajo} className="text-gray-400 dark:text-gray-500" />
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-3">
        <button
          type="button"
          onClick={alternar}
          className={`w-full h-9 flex items-center gap-3 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${plegado ? "justify-center" : "px-3"}`}
          title={plegado ? "Expandir menú" : "Plegar menú"}
          aria-label={plegado ? "Expandir menú" : "Plegar menú"}
        >
          {plegado ? <FaAngleDoubleRight /> : <FaAngleDoubleLeft />}
          {!plegado && <span>Plegar menú</span>}
        </button>
      </div>
    </aside>
  );
}
