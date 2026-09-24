import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { FaWifi } from "react-icons/fa";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { BarraInferior, MenuMovil } from "../components/NavegacionMovil";
import AtajosGlobales from "../atajos/AtajosGlobales";
import { useConfiguracion } from "../context/configuracionCore";
import { experienciaDe } from "../experiencia/experiencias";
import { useSinConexion } from "../pwa/useSinConexion";

export default function DashboardLayout() {
  const location = useLocation();
  const { config } = useConfiguracion();
  const acento = experienciaDe(config?.rubro).acento;
  const sinConexion = useSinConexion();
  const [menu, setMenu] = useState(false);

  // El color de acento cambia con el rubro (ver index.css).
  useEffect(() => {
    document.documentElement.dataset.acento = acento;
    return () => {
      delete document.documentElement.dataset.acento;
    };
  }, [acento]);

  return (
    <div className="flex h-dvh bg-gray-50 dark:bg-gray-950">
      <AtajosGlobales />
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {sinConexion && (
          <div role="status" className="shrink-0 flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-medium px-3 py-1.5">
            <FaWifi /> Sin conexión: lo que hagas ahora no se guardará hasta que vuelva.
          </div>
        )}

        {/* En teléfono deja espacio para la barra inferior y respeta el área segura. */}
        <main key={location.pathname} className="flex-1 overflow-auto overscroll-contain animate-fade-in max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
          <Outlet />
        </main>
      </div>

      <BarraInferior onMas={() => setMenu(true)} />
      <MenuMovil open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}
