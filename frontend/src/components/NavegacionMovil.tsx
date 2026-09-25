import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaBars, FaDownload, FaKey, FaMoon, FaSignOutAlt, FaSun, FaDesktop, FaTimes, FaShareSquare } from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/configuracionCore";
import { useNavegacion } from "../experiencia/navegacion";
import { useTema, type PreferenciaTema } from "../tema/temaCore";
import { useInstalarApp } from "../pwa/instalar";
import Modal from "./ui/Modal";
import InsigniaNav from "./presupuesto/InsigniaNav";
import Button from "./ui/Button";
import ModalCambiarPassword from "./modal/ModalCambiarPassword";

const ROLES: Record<string, string> = { ADMIN: "Administrador", EMPLOYEE: "Empleado", CAJERO: "Cajero" };
const activa = (ruta: string, to: string) => (to === "/" ? ruta === "/" : ruta === to || ruta.startsWith(`${to}/`));

/** Barra inferior del teléfono: destinos principales y «Más». */
export function BarraInferior({ onMas }: { onMas: () => void }) {
  const { pathname } = useLocation();
  // Los cuatro destinos más usados del negocio van siempre a la vista, al alcance del pulgar.
  const principales = useNavegacion().todos.slice(0, 4);

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {principales.map((n) => {
          const on = activa(pathname, n.to);
          return (
            <li key={n.id} className="flex-1 min-w-0">
              <Link
                to={n.to}
                aria-current={on ? "page" : undefined}
                className={`h-14 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors ${
                  on ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800"
                }`}
              >
                <span className={`relative text-[19px] transition-transform ${on ? "scale-110" : ""}`}>
                  {n.icon}
                  {n.id === "presupuestos" && <InsigniaNav flotante />}
                </span>
                <span className="max-w-full truncate px-1">{n.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onMas}
            className="w-full h-14 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800 cursor-pointer"
          >
            <FaBars className="text-[19px]" />
            <span>Más</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

const TEMAS: { id: PreferenciaTema; label: string; icono: React.ReactNode }[] = [
  { id: "light", label: "Claro", icono: <FaSun /> },
  { id: "dark", label: "Oscuro", icono: <FaMoon /> },
  { id: "system", label: "Sistema", icono: <FaDesktop /> },
];

/** Hoja con todo el menú: secciones, instalar la app, tema, contraseña y cerrar sesión. */
export function MenuMovil({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { config } = useConfiguracion();
  const { secciones, experiencia } = useNavegacion();
  const { preferencia, elegir } = useTema();
  const instalacion = useInstalarApp();
  const [password, setPassword] = useState(false);
  const [guiaIOS, setGuiaIOS] = useState(false);

  const negocio = config?.nombreNegocio?.trim() || "Mostrador";

  const instalar = async () => {
    if (instalacion.hayEvento) await instalacion.instalar();
    else setGuiaIOS(true);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} maxWidth="max-w-md" className="max-sm:max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-3 pb-3 border-b border-gray-200 dark:border-gray-800">
          <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-extrabold shrink-0">{negocio.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate">{negocio}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user?.name || user?.email} · {user ? ROLES[user.role] ?? user.role : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer">
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {secciones.map((s) => (
            <section key={s.titulo}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{s.titulo}</h3>
              <div className="grid grid-cols-3 gap-2">
                {s.items.map((n) => {
                  const on = activa(pathname, n.to);
                  return (
                    <Link
                      key={n.id}
                      to={n.to}
                      onClick={onClose}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-3 min-h-[76px] text-center transition-colors ${
                        on
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300"
                          : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-800"
                      }`}
                    >
                      <span className="relative text-xl">
                        {n.icon}
                        {n.id === "presupuestos" && <InsigniaNav flotante />}
                      </span>
                      <span className="text-[11.5px] font-medium leading-tight line-clamp-2">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Apariencia</h3>
            <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
              {TEMAS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={preferencia === t.id}
                  onClick={() => elegir(t.id)}
                  className={`h-10 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer ${
                    preferencia === t.id ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs" : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {t.icono} {t.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            {instalacion.disponible && (
              <Button variant="outline" className="w-full" leftIcon={<FaDownload />} onClick={instalar}>
                Instalar la app en este teléfono
              </Button>
            )}
            <Button variant="secondary" className="w-full" leftIcon={<FaKey />} onClick={() => setPassword(true)}>
              Cambiar mi contraseña
            </Button>
            <Button variant="danger" className="w-full" leftIcon={<FaSignOutAlt />} onClick={logout}>
              Cerrar sesión
            </Button>
          </section>
          <p className="text-center text-[11px] text-gray-400">{experiencia.nombre}</p>
        </div>
      </Modal>

      {guiaIOS && (
        <Modal open onClose={() => setGuiaIOS(false)} maxWidth="max-w-sm">
          <div className="p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Instalar en tu iPhone</h2>
            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <span>
                  En Safari, toca el botón <FaShareSquare className="inline -mt-0.5 text-blue-600" /> <strong>Compartir</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <span>
                  Elige <strong>«Agregar a inicio»</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <span>Abre la app desde el icono nuevo: se ve a pantalla completa, como cualquier otra.</span>
              </li>
            </ol>
            <Button variant="primary" className="w-full" onClick={() => setGuiaIOS(false)}>
              Entendido
            </Button>
          </div>
        </Modal>
      )}

      {password && <ModalCambiarPassword onClose={() => setPassword(false)} />}
    </>
  );
}
