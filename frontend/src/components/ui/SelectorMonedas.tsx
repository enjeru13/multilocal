import { FaCheck, FaLock } from "react-icons/fa";
import { MONEDAS, type Moneda } from "../../utils/monedaHelpers";
import { NOMBRE_MONEDA } from "../../impresion/etiquetas";
import { campo } from "./Formulario";

const SIMBOLO: Record<Moneda, string> = { USD: "$", VES: "Bs", COP: "$" };
const CORTO: Record<Moneda, string> = { USD: "Dólar", VES: "Bolívar", COP: "Peso col." };
const PAIS: Record<Moneda, string> = { USD: "Estados Unidos", VES: "Venezuela", COP: "Colombia" };

export interface TasasTexto {
  VES: string;
  COP: string;
}

interface Props {
  principal: Moneda;
  activas: Moneda[];
  tasas: TasasTexto;
  /** Ya hay ventas o pagos: la moneda principal no se puede cambiar. */
  bloqueada?: boolean;
  onPrincipal: (m: Moneda) => void;
  onActivas: (m: Moneda[]) => void;
  onTasas: (t: TasasTexto) => void;
}

function Titulo({ children, ayuda }: { children: string; ayuda?: string }) {
  return (
    <div className="mb-2.5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{children}</h3>
      {ayuda && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ayuda}</p>}
    </div>
  );
}

/**
 * Con qué monedas trabaja el negocio, cuál es la principal y las tasas que hacen falta,
 * en tres bloques: monedas (se tocan para activar), principal y tasas de cambio.
 */
export default function SelectorMonedas({ principal, activas, tasas, bloqueada = false, onPrincipal, onActivas, onTasas }: Props) {
  const alternar = (m: Moneda) => {
    if (m === principal) return; // la principal siempre está activa
    onActivas(activas.includes(m) ? activas.filter((x) => x !== m) : [...activas, m]);
  };

  const elegirPrincipal = (m: Moneda) => {
    if (bloqueada || m === principal) return;
    onPrincipal(m);
  };

  const varias = activas.length > 1;
  // Tasas (siempre contra el dólar) necesarias: las de las monedas en juego que no son el dólar.
  const necesarias = (["VES", "COP"] as const).filter((m) => varias && (activas.includes(m) || m === principal));

  return (
    <div className="space-y-6">
      <section>
        <Titulo ayuda="Toca para activar o quitar. Solo se ofrecen estas al cobrar, pagar, imprimir y en los reportes.">Monedas con las que trabajas</Titulo>
        <div className="grid grid-cols-3 gap-2.5">
          {MONEDAS.map((m) => {
            const activa = activas.includes(m);
            const esPrincipal = m === principal;
            return (
              <button
                key={m}
                type="button"
                onClick={() => alternar(m)}
                disabled={esPrincipal}
                aria-pressed={activa}
                className={`relative rounded-xl border p-3 text-left transition-colors min-w-0 ${esPrincipal ? "cursor-default" : "cursor-pointer"} ${
                  activa ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10" : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                }`}
              >
                <span className={`absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full flex items-center justify-center ${activa ? "bg-blue-600 text-white" : "border border-gray-300 dark:border-gray-600"}`} style={{ width: 18, height: 18 }}>
                  {activa && <FaCheck size={8} />}
                </span>
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${activa ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>{SIMBOLO[m]}</span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{m}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{CORTO[m]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <Titulo ayuda="En esta se guardan los precios, totales y reportes.">Moneda principal</Titulo>
        <div role="radiogroup" aria-label="Moneda principal" className="grid rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1" style={{ gridTemplateColumns: `repeat(${activas.length}, minmax(0, 1fr))` }}>
          {activas.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === principal}
              disabled={bloqueada && m !== principal}
              onClick={() => elegirPrincipal(m)}
              className={`h-10 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                m === principal ? "bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-xs" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
              }`}
            >
              {m === principal && bloqueada && <FaLock size={9} className="inline mr-1.5 -mt-0.5" />}
              {m} <span className="font-normal opacity-70 max-sm:hidden">· {PAIS[m]}</span>
            </button>
          ))}
        </div>
        {bloqueada && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Ya hay ventas registradas en {NOMBRE_MONEDA[principal].toLowerCase()}: la principal no se puede cambiar, pero sí activar o quitar las demás.</p>
        )}
      </section>

      <section>
        <Titulo ayuda={varias ? "Siempre contra el dólar; de ahí el sistema calcula el resto de conversiones." : undefined}>Tasas de cambio</Titulo>
        {varias ? (
          necesarias.length > 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {necesarias.map((m) => (
                <label key={m} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{NOMBRE_MONEDA[m]}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">1 dólar = ? {m}</span>
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tasas[m]}
                    onChange={(e) => onTasas({ ...tasas, [m]: e.target.value.replace(".", ",") })}
                    className={`${campo} w-32! text-right tabular-nums`}
                    placeholder={m === "VES" ? "140,00" : "4000,00"}
                    aria-label={`Tasa ${m} por 1 dólar`}
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Dólares y otra moneda: la tasa del dólar es 1, no hay nada que definir.</p>
          )
        ) : (
          <p className="text-sm rounded-xl bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800 px-4 py-3 text-gray-600 dark:text-gray-400">
            Trabajas solo en {NOMBRE_MONEDA[principal].toLowerCase()}: no hace falta ninguna tasa de cambio.
          </p>
        )}
      </section>
    </div>
  );
}
