import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import AtajosGlobales from "../atajos/AtajosGlobales";
import { useConfiguracion } from "../context/configuracionCore";
import { experienciaDe } from "../experiencia/experiencias";

export default function DashboardLayout() {
  const location = useLocation();
  const { config } = useConfiguracion();
  const acento = experienciaDe(config?.rubro).acento;

  // El color de acento cambia con el rubro (ver index.css).
  useEffect(() => {
    document.documentElement.dataset.acento = acento;
    return () => {
      delete document.documentElement.dataset.acento;
    };
  }, [acento]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <AtajosGlobales />
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main key={location.pathname} className="flex-1 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
