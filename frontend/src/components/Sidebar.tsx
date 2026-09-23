import { Link, useLocation } from "react-router-dom";
import { FaKeyboard } from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";
import { useNavegacion } from "../experiencia/navegacion";
import { useAtajosContext } from "../atajos/atajosCore";
import Kbd from "../atajos/Kbd";

/** Menú lateral: se arma según el rubro (orden, nombres, atajos) y los módulos activos. */
export default function Sidebar() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { secciones, experiencia } = useNavegacion();
  const { abrirPaleta } = useAtajosContext();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 h-screen flex flex-col sticky top-0">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
        <span className="text-lg font-bold tracking-tight">Menú</span>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">
          {experiencia.nombre}
        </span>
      </div>

      <button
        type="button"
        onClick={() => abrirPaleta(true)}
        className="mx-3 mt-4 flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 cursor-pointer"
        title="Buscar pantalla o acción"
      >
        <span className="flex items-center gap-2">
          <FaKeyboard /> Buscar…
        </span>
        <Kbd combo="Ctrl+K" />
      </button>

      <nav className="flex-1 overflow-y-auto px-3 py-5 flex flex-col gap-6">
        {secciones.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="px-3 text-[11px] uppercase font-semibold text-slate-500 mb-2 tracking-wider">{grupo.titulo}</p>
            <ul className="flex flex-col gap-0.5">
              {grupo.items.map((link) => {
                const activo = location.pathname === link.to;
                return (
                  <Link
                    key={link.id}
                    to={link.to}
                    title={link.descripcion}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm transition-colors border-l-2 ${
                      activo
                        ? "bg-blue-500/10 border-blue-500 text-white font-semibold"
                        : "border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    <span className={`text-base ${activo ? "text-blue-400" : "text-slate-500"}`}>{link.icon}</span>
                    <span className="flex-1 truncate">{link.label}</span>
                    {link.atajo && <Kbd combo={link.atajo} className="text-slate-500 opacity-70" />}
                  </Link>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <p className="px-6 py-3 border-t border-slate-800 text-[11px] text-slate-500">
        Pulsa <Kbd combo="?" className="text-slate-400" /> para ver los atajos
      </p>
    </aside>
  );
}
