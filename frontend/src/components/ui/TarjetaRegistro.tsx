import type { ReactNode } from "react";

interface Props {
  titulo: ReactNode;
  /** Cifra o dato principal a la derecha del título. */
  destacado?: ReactNode;
  subtitulo?: ReactNode;
  /** Etiquetas de estado. */
  chips?: ReactNode;
  /** Datos secundarios: rótulo y valor, en dos columnas. */
  datos?: { k: string; v: ReactNode }[];
  /** Botones de la tarjeta (se ponen en una fila al pie). */
  acciones?: ReactNode;
  /** Al tocar la tarjeta (abre el detalle). */
  onClick?: () => void;
  atenuada?: boolean;
}

/** Un registro de una lista, pensado para el teléfono: lo importante arriba, acciones a la vista. */
export default function TarjetaRegistro({ titulo, destacado, subtitulo, chips, datos, acciones, onClick, atenuada }: Props) {
  const cuerpo = (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate">{titulo}</div>
          {subtitulo && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitulo}</div>}
        </div>
        {destacado && <div className="text-base font-extrabold tabular-nums text-gray-900 dark:text-gray-100 shrink-0 text-right">{destacado}</div>}
      </div>
      {chips && <div className="flex flex-wrap items-center gap-1.5">{chips}</div>}
      {datos && datos.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {datos.map((d) => (
            <div key={d.k} className="min-w-0">
              <dt className="text-gray-400 dark:text-gray-500">{d.k}</dt>
              <dd className="text-gray-700 dark:text-gray-300 font-medium tabular-nums truncate">{d.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  return (
    <li className={`rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden ${atenuada ? "opacity-60" : ""}`}>
      {onClick ? (
        <button type="button" onClick={onClick} className="w-full text-left p-3.5 active:bg-gray-50 dark:active:bg-gray-800/60 cursor-pointer">
          {cuerpo}
        </button>
      ) : (
        <div className="p-3.5">{cuerpo}</div>
      )}
      {acciones && <div className="flex items-center gap-2 px-3 pb-3">{acciones}</div>}
    </li>
  );
}
