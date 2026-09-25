import { FaPlay, FaVolumeUp } from "react-icons/fa";
import { EVENTOS_SONIDO, reproducir, usePreferenciasSonido } from "../../sonidos/sonidos";
import Interruptor from "../ui/Interruptor";

/** Controles de sonido de este equipo: interruptor general, volumen y qué eventos suenan. Se guarda al cambiar. */
export default function PanelSonidos() {
  const [prefs, guardar] = usePreferenciasSonido();

  return (
    <div className="space-y-5">
      <Interruptor variante="tarjeta" activo={prefs.activo} onChange={(v) => guardar({ activo: v })} icono={<FaVolumeUp />} titulo="Sonidos activados" detalle="Apágalo para silenciar todo el sistema en este equipo." />

      <div className={`space-y-4 ${prefs.activo ? "" : "opacity-50 pointer-events-none"}`} aria-disabled={!prefs.activo}>
        <label className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 shrink-0">Volumen</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(prefs.volumen * 100)}
            onChange={(e) => guardar({ volumen: Number(e.target.value) / 100 })}
            onPointerUp={() => reproducir("cobro", { forzar: true })}
            onKeyUp={() => reproducir("cobro", { forzar: true })}
            className="flex-1 accent-blue-600 h-2 cursor-pointer"
            aria-label="Volumen"
          />
          <span className="w-10 text-right text-sm tabular-nums text-gray-600 dark:text-gray-400">{Math.round(prefs.volumen * 100)}%</span>
        </label>

        <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 px-4">
          {EVENTOS_SONIDO.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Interruptor activo={prefs.eventos[e.id]} onChange={(v) => guardar({ eventos: { [e.id]: v } })} titulo={e.titulo} detalle={e.detalle} />
              </div>
              <button
                type="button"
                onClick={() => reproducir(e.id, { forzar: true })}
                className="shrink-0 h-9 px-3 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5 cursor-pointer"
                aria-label={`Probar el sonido de ${e.titulo}`}
              >
                <FaPlay size={9} /> Probar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
