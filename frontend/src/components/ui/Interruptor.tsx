import type { ReactNode } from "react";

interface Props {
  activo: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  detalle?: string;
  icono?: ReactNode;
  disabled?: boolean;
  /** "fila": renglón de lista; "tarjeta": recuadro con borde (para cuadrículas). */
  variante?: "fila" | "tarjeta";
}

/** Interruptor con título y explicación: toda la fila o tarjeta se puede tocar. */
export default function Interruptor({ activo, onChange, titulo, detalle, icono, disabled, variante = "fila" }: Props) {
  const caja =
    variante === "tarjeta"
      ? `rounded-xl border p-3.5 h-full ${activo ? "border-blue-500/60 bg-blue-50/50 dark:bg-blue-500/5" : "border-gray-200 dark:border-gray-800"}`
      : "py-2.5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={`w-full flex items-center gap-3 text-left transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${caja}`}
    >
      {icono && (
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-[15px] shrink-0 ${activo ? "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
          {icono}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{titulo}</span>
        {detalle && <span className="block text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5">{detalle}</span>}
      </span>
      <span className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${activo ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`} aria-hidden>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
