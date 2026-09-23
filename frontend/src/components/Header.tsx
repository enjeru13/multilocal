import { useState } from "react";
import { FaUserCircle, FaSignOutAlt, FaKey } from "react-icons/fa";
import ModalCambiarPassword from "./modal/ModalCambiarPassword";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";

interface HeaderProps {
  nombreNegocio: string;
}

export default function Header({
  nombreNegocio,
}: HeaderProps) {
  const { user, logout } = useAuth();
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  return (
    <header className="h-16 shrink-0 bg-white dark:bg-gray-900 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
        {nombreNegocio}
      </h1>

      {user ? (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <FaUserCircle className="text-gray-400 dark:text-gray-500 text-xl" />
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {user.name || user.email}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full font-semibold">
              {user.role.toLowerCase()}
            </span>
          </div>

          <Button
            onClick={() => setCambiandoPassword(true)}
            variant="ghost"
            size="sm"
            leftIcon={<FaKey size={12} />}
            title="Cambiar mi contraseña"
            aria-label="Cambiar mi contraseña"
          >
            <span className="hidden lg:inline">Contraseña</span>
          </Button>

          <Button
            onClick={logout}
            variant="ghost"
            size="sm"
            leftIcon={<FaSignOutAlt size={14} />}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <span className="hidden md:inline">Cerrar Sesión</span>
          </Button>
        </div>
      ) : (
        <span className="text-gray-400 text-sm">No autenticado</span>
      )}
      {cambiandoPassword && (
        <ModalCambiarPassword onClose={() => setCambiandoPassword(false)} />
      )}
    </header>
  );
}