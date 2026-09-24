import { FaCheck, FaLock } from "react-icons/fa";
import { NOMBRE_MONEDA, MONEDAS, type Moneda } from "../../utils/monedaHelpers";
import { Campo, campo } from "./Formulario";

const SIMBOLO: Record<Moneda, string> = { USD: "$", VES: "Bs.", COP: "$" };
const PAIS: Record<Moneda, string> = { USD: "Dólar estadounidense", VES: "Bolívar venezolano", COP: "Peso colombiano" };

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

/**
 * Con qué monedas trabaja el negocio, cuál es la principal y las tasas que hacen falta.
 * Con una sola moneda no se pide ninguna tasa; con varias, solo las que el cruce necesita.
 */
export default function SelectorMonedas({ principal, activas, tasas, bloqueada = false, onPrincipal, onActivas, onTasas }: Props) {
  const alternar = (m: Moneda) => {
    if (m === principal) return; // la principal siempre está activa
    onActivas(activas.includes(m) ? activas.filter((x) => x !== m) : [...activas, m]);
  };

  const hacerPrincipal = (m: Moneda) => {
    if (bloqueada || m === principal) return;
    onPrincipal(m);
    if (!activas.includes(m)) onActivas([...activas, m]);
  };

  // Tasas (siempre contra el dólar) necesarias: las de las monedas en juego que no son el dólar.
  const varias = activas.length > 1;
  const necesarias = (["VES", "COP"] as const).filter((m) => varias && (activas.includes(m) || m === principal));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">¿Con qué monedas trabajas?</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Solo se ofrecen estas al cobrar, pagar, imprimir y en los reportes. Con una sola, el sistema no muestra conversiones.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {MONEDAS.map((m) => {
            const activa = activas.includes(m);
            const esPrincipal = m === principal;
            return (
              <div
                key={m}
                className={`rounded-xl border p-4 transition-colors ${
                  esPrincipal
                    ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10"
                    : activa
                    ? "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 opacity-80"
                }`}
              >
                <button type="button" onClick={() => alternar(m)} disabled={esPrincipal} className={`w-full flex items-start gap-3 text-left ${esPrincipal ? "cursor-default" : "cursor-pointer"}`} aria-pressed={activa}>
                  <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${activa ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 dark:border-gray-600"}`}>
                    {activa && <FaCheck size={10} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {m} <span className="font-normal text-gray-500">{SIMBOLO[m]}</span>
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{PAIS[m]}</span>
                  </span>
                </button>
                <div className="mt-3 pl-8">
                  {esPrincipal ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      {bloqueada && <FaLock size={9} />} Principal
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => hacerPrincipal(m)}
                      disabled={bloqueada}
                      title={bloqueada ? "Ya hay ventas registradas: la moneda principal no se puede cambiar" : "Usar como moneda principal"}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
                    >
                      Hacer principal
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          La <strong>principal</strong> es en la que se guardan los precios, totales y reportes.{" "}
          {bloqueada && (
            <span className="text-amber-700 dark:text-amber-400">
              Ya hay ventas registradas en {NOMBRE_MONEDA[principal].toLowerCase()}: la principal no se puede cambiar, pero puedes activar o quitar las demás.
            </span>
          )}
        </p>
      </div>

      {varias ? (
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tasas de cambio</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Se expresan siempre contra el dólar, y de ahí el sistema calcula el resto de conversiones.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {necesarias.map((m) => (
              <Campo key={m} etiqueta={`${NOMBRE_MONEDA[m]} por 1 dólar (${m})`}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={tasas[m]}
                  onChange={(e) => onTasas({ ...tasas, [m]: e.target.value.replace(".", ",") })}
                  className={`${campo} text-right tabular-nums`}
                  placeholder={m === "VES" ? "Ej. 140,00" : "Ej. 4000,00"}
                />
              </Campo>
            ))}
          </div>
          {necesarias.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Dólares y otra moneda: la tasa del dólar es 1, no hay nada que definir.</p>}
        </div>
      ) : (
        <p className="text-sm rounded-xl bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800 px-4 py-3 text-gray-600 dark:text-gray-400">
          Trabajas solo en {NOMBRE_MONEDA[principal].toLowerCase()}: no hace falta ninguna tasa de cambio.
        </p>
      )}
    </div>
  );
}
