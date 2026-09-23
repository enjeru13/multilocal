import { PRESETS_PERIODO, rangoDePreset, rangoValido, type PresetPeriodo, type RangoFechas } from "../utils/rangosFecha";

interface Props {
  preset: PresetPeriodo;
  rango: RangoFechas;
  onChange: (rango: RangoFechas, preset: PresetPeriodo) => void;
}

const fechaCls =
  "px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100";

/** Botones de periodo (hoy, 7 días, mes…) más fechas a mano. */
export default function SelectorPeriodo({ preset, rango, onChange }: Props) {
  return (
    <>
      <section className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 gap-1">
          {PRESETS_PERIODO.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(rangoDePreset(p.id), p.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                preset === p.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="date"
            value={rango.desde}
            max={rango.hasta || undefined}
            onChange={(e) => onChange({ ...rango, desde: e.target.value }, "personalizado")}
            aria-label="Desde"
            className={fechaCls}
          />
          <span>a</span>
          <input
            type="date"
            value={rango.hasta}
            min={rango.desde || undefined}
            onChange={(e) => onChange({ ...rango, hasta: e.target.value }, "personalizado")}
            aria-label="Hasta"
            className={fechaCls}
          />
        </div>
      </section>
      {!rangoValido(rango) && (
        <p className="text-sm text-amber-600 dark:text-amber-400">La fecha inicial debe ser anterior o igual a la final.</p>
      )}
    </>
  );
}
