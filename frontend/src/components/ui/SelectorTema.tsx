import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { FaMoon, FaSun, FaDesktop, FaCheck } from "react-icons/fa";
import { useTema, type PreferenciaTema } from "../../tema/temaCore";

const OPCIONES: { id: PreferenciaTema; label: string; icono: React.ReactNode }[] = [
  { id: "light", label: "Claro", icono: <FaSun /> },
  { id: "dark", label: "Oscuro", icono: <FaMoon /> },
  { id: "system", label: "Como el sistema", icono: <FaDesktop /> },
];

/** Menú para elegir el tema; el icono del botón muestra el que está activo. */
export default function SelectorTema({ className = "" }: { className?: string }) {
  const { preferencia, oscuro, elegir } = useTema();

  return (
    <Menu as="div" className={`relative ${className}`}>
      <MenuButton
        className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
        aria-label="Cambiar tema"
        title="Tema"
      >
        {oscuro ? <FaMoon /> : <FaSun />}
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-60 mt-2 w-48 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1 focus:outline-none"
      >
        {OPCIONES.map((o) => (
          <MenuItem key={o.id}>
            <button
              type="button"
              onClick={() => elegir(o.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 data-focus:bg-gray-100 dark:data-focus:bg-gray-800 cursor-pointer"
            >
              <span className="text-gray-400">{o.icono}</span>
              <span className="flex-1 text-left">{o.label}</span>
              {preferencia === o.id && <FaCheck size={11} className="text-blue-600 dark:text-blue-400" />}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
