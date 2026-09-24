import { useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { FaKey, FaKeyboard, FaSearch, FaSignOutAlt } from "react-icons/fa";
import ModalCambiarPassword from "./modal/ModalCambiarPassword";
import SelectorTema from "./ui/SelectorTema";
import Kbd from "../atajos/Kbd";
import { useAuth } from "../hooks/useAuth";
import { useAtajosContext } from "../atajos/atajosCore";

const ROLES: Record<string, string> = { ADMIN: "Administrador", EMPLOYEE: "Empleado", CAJERO: "Cajero" };

const iniciales = (texto: string) =>
  texto
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Barra superior: en qué sección estás, buscador de comandos, tema y menú de la persona. */
export default function Header() {
  const { user, logout } = useAuth();
  const { abrirPaleta, abrirAyuda } = useAtajosContext();
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  const nombre = user?.name || user?.email || "";

  return (
    <header className="h-14 shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur px-5 flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <button
        type="button"
        onClick={() => abrirPaleta(true)}
        className="flex items-center gap-2.5 h-9 w-full max-w-sm px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer"
        title="Buscar pantalla o acción"
      >
        <FaSearch size={12} />
        <span className="flex-1 text-left">Buscar…</span>
        <Kbd combo="Ctrl+K" className="text-gray-400" />
      </button>

      <div className="flex items-center gap-1 ml-auto">
        <SelectorTema />

        {user ? (
          <Menu as="div" className="relative ml-1">
            <MenuButton
              className="flex items-center gap-2.5 h-9 pl-1 pr-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Menú de usuario"
            >
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                {iniciales(nombre) || "?"}
              </span>
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-[13px] font-medium text-gray-800 dark:text-gray-100 max-w-32 truncate">{nombre}</span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">{ROLES[user.role] ?? user.role}</span>
              </span>
            </MenuButton>
            <MenuItems
              anchor="bottom end"
              className="z-60 mt-2 w-60 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1 focus:outline-none"
            >
              <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 mb-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.name || "Sin nombre"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
              {[
                { icono: <FaKey />, texto: "Cambiar mi contraseña", accion: () => setCambiandoPassword(true) },
                { icono: <FaKeyboard />, texto: "Atajos de teclado", accion: () => abrirAyuda(true) },
              ].map((o) => (
                <MenuItem key={o.texto}>
                  <button
                    type="button"
                    onClick={o.accion}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 data-focus:bg-gray-100 dark:data-focus:bg-gray-800 cursor-pointer"
                  >
                    <span className="text-gray-400">{o.icono}</span>
                    {o.texto}
                  </button>
                </MenuItem>
              ))}
              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
              <MenuItem>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 data-focus:bg-red-50 dark:data-focus:bg-red-900/20 cursor-pointer"
                >
                  <FaSignOutAlt />
                  Cerrar sesión
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        ) : (
          <span className="text-gray-400 text-sm">No autenticado</span>
        )}
      </div>

      {cambiandoPassword && <ModalCambiarPassword onClose={() => setCambiandoPassword(false)} />}
    </header>
  );
}
