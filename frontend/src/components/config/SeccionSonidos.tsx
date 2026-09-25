import { FaVolumeUp } from "react-icons/fa";
import PanelSonidos from "./PanelSonidos";

/** Sonidos en Configuración: valen solo para este equipo y se guardan al elegirlos. */
export default function SeccionSonidos() {
  return (
    <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-3 text-gray-900 dark:text-gray-100">
          <FaVolumeUp size={26} className="text-blue-500 dark:text-blue-400" />
          Sonidos
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Valen solo para este equipo y se guardan al elegirlos. En el teléfono empiezan a sonar después del primer toque en la pantalla.</p>
      </div>
      <PanelSonidos />
    </section>
  );
}
