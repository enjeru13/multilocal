import type { ReactNode } from "react";
import { FaTimes } from "react-icons/fa";

/** Estilo único de los campos de texto, números y listas. */
export const campo =
  "w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-60 transition-colors";

export const campoError = "border-red-400 dark:border-red-500/70 focus:ring-red-500/40 focus:border-red-500";

/** Etiqueta + campo + mensaje de ayuda o de error. */
export function Campo({
  etiqueta,
  error,
  ayuda,
  opcional,
  children,
  className = "",
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  opcional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="flex items-center justify-between text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        <span>{etiqueta}</span>
        {opcional && <span className="text-[11px] font-normal text-gray-400">Opcional</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : ayuda ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{ayuda}</p>
      ) : null}
    </div>
  );
}

/** Bloque del formulario con título pequeño; agrupa campos relacionados. */
export function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <section className="space-y-3.5">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{titulo}</h3>
        {descripcion && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{descripcion}</p>}
      </div>
      {children}
    </section>
  );
}

/** Encabezado de ventana: icono en recuadro, título, subtítulo y cierre. */
export function ModalEncabezado({
  icono,
  titulo,
  subtitulo,
  onClose,
}: {
  icono?: ReactNode;
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-3.5 px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800">
      {icono && (
        <span className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shrink-0">
          {icono}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{titulo}</h2>
        {subtitulo && <p className="text-sm text-gray-500 dark:text-gray-400 break-words">{subtitulo}</p>}
      </div>
      <button onClick={onClose} type="button" title="Cerrar" aria-label="Cerrar" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer">
        <FaTimes />
      </button>
    </div>
  );
}

/** Pie de ventana con acciones alineadas a la derecha. */
export function ModalPie({ children, izquierda }: { children: ReactNode; izquierda?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/30">
      {izquierda && <div className="text-xs text-gray-500 dark:text-gray-400">{izquierda}</div>}
      <div className="ml-auto flex items-center gap-2.5">{children}</div>
    </div>
  );
}

/** Opción de sí/no con explicación, al estilo de un interruptor de lista. */
export function Opcion({
  activo,
  onChange,
  titulo,
  detalle,
  disabled,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  detalle?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 py-1.5 cursor-pointer">
      <input type="checkbox" checked={activo} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="mt-0.5 accent-blue-600 w-4 h-4 cursor-pointer" />
      <span>
        <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">{titulo}</span>
        {detalle && <span className="block text-xs text-gray-500 dark:text-gray-400">{detalle}</span>}
      </span>
    </label>
  );
}

/** Dos o más opciones excluyentes en una fila (por ejemplo Persona / Empresa). */
export function Segmentado<T extends string>({
  valor,
  opciones,
  onChange,
  ariaLabel,
}: {
  valor: T;
  opciones: { id: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          onClick={() => onChange(o.id)}
          className={`px-4 h-8 rounded-md text-[13px] font-medium cursor-pointer transition-colors ${
            valor === o.id ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
