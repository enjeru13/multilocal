import { forwardRef } from "react";
import type { ReactNode } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useConfiguracion } from "../context/configuracionCore";
import { useAuth } from "../hooks/useAuth";

dayjs.locale("es");

/**
 * Piezas para los reportes en hoja (carta / A4 / oficio). Se diseñan para papel: blanco y
 * negro legible, un solo acento, cifras alineadas y filas que no se parten entre páginas.
 */

interface HojaProps {
  titulo: string;
  /** Línea bajo el título: periodo, corte al día, etc. */
  subtitulo?: string;
  /** Filtros aplicados, para que quien lea el papel sepa qué está viendo. */
  filtros?: string[];
  children: ReactNode;
}

export const HojaReporte = forwardRef<HTMLDivElement, HojaProps>(({ titulo, subtitulo, filtros, children }, ref) => {
  const { config } = useConfiguracion();
  const { user } = useAuth();
  const negocio = config?.nombreNegocio || "Mi negocio";
  const contacto = [config?.rif ? `RIF ${config.rif.replace(/^RIF:?\s*/i, "")}` : null, config?.telefonoPrincipal].filter(Boolean).join("  ·  ");

  return (
    <div ref={ref} className="hoja-reporte w-full bg-white text-neutral-900 font-sans text-[10.5pt] leading-snug">
      <header className="pb-4 mb-5 border-b-2 border-neutral-900">
        <div className="flex justify-between items-start gap-8">
          <div className="min-w-0">
            <h1 className="text-[20pt] font-extrabold leading-tight tracking-tight">{titulo}</h1>
            {subtitulo && <p className="text-[11pt] text-neutral-600 mt-0.5">{subtitulo}</p>}
          </div>
          <div className="text-right shrink-0 max-w-[42%]">
            <p className="text-[12pt] font-bold leading-tight">{negocio}</p>
            {contacto && <p className="text-[9pt] text-neutral-600 mt-0.5">{contacto}</p>}
            {config?.direccion && <p className="text-[9pt] text-neutral-600 leading-tight">{config.direccion}</p>}
          </div>
        </div>
        {filtros && filtros.length > 0 && (
          <p className="mt-3 text-[9pt] text-neutral-600">
            <span className="font-bold uppercase tracking-wider text-neutral-500">Filtros · </span>
            {filtros.join("  ·  ")}
          </p>
        )}
      </header>

      <main className="space-y-6">{children}</main>

      <footer className="mt-8 pt-2 border-t border-neutral-300 flex justify-between gap-6 text-[8.5pt] text-neutral-500">
        <span>
          Generado el {dayjs().format("D [de] MMMM [de] YYYY, h:mm A")}
          {user?.name ? ` por ${user.name}` : ""}
        </span>
      </footer>
    </div>
  );
});
HojaReporte.displayName = "HojaReporte";

/** Cifra destacada con su rótulo. */
export function KpiImpreso({ titulo, valor, nota, tono = "normal" }: { titulo: string; valor: string; nota?: ReactNode; tono?: "normal" | "bueno" | "malo" }) {
  const color = tono === "bueno" ? "text-emerald-800" : tono === "malo" ? "text-red-700" : "text-neutral-900";
  return (
    <div className="kpi border border-neutral-300 rounded-md px-4 py-3 break-inside-avoid">
      <p className="text-[8pt] font-bold uppercase tracking-wider text-neutral-500">{titulo}</p>
      <p className={`text-[17pt] font-extrabold leading-tight tabular-nums mt-0.5 ${color}`}>{valor}</p>
      {nota && <p className="text-[8.5pt] text-neutral-500 mt-0.5">{nota}</p>}
    </div>
  );
}

export function FilaKpis({ children, columnas = 4 }: { children: ReactNode; columnas?: 2 | 3 | 4 }) {
  const cls = columnas === 2 ? "grid-cols-2" : columnas === 3 ? "grid-cols-3" : "grid-cols-4";
  return <div className={`grid ${cls} gap-3`}>{children}</div>;
}

export function SeccionImpresa({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-2 break-after-avoid">
        <h2 className="text-[11.5pt] font-bold uppercase tracking-wider text-neutral-800">{titulo}</h2>
        {nota && <span className="text-[8.5pt] text-neutral-500">{nota}</span>}
      </div>
      {children}
    </section>
  );
}

export interface ColumnaImpresa<T> {
  titulo: string;
  alinear?: "left" | "right" | "center";
  /** Ancho CSS opcional (p. ej. "14%" o "22mm"). */
  ancho?: string;
  celda: (fila: T, indice: number) => ReactNode;
  /** Contenido de la fila final de totales, si la hay. */
  total?: ReactNode;
  /** Sin salto de línea (fechas, montos). */
  nowrap?: boolean;
}

/**
 * Tabla de reporte. La cabecera se repite en cada página, las filas no se parten y la
 * fila de totales (si alguna columna define `total`) sale una sola vez al final.
 */
export function TablaImpresa<T>({ columnas, filas, vacio = "Sin registros.", clave }: { columnas: ColumnaImpresa<T>[]; filas: T[]; vacio?: string; clave: (fila: T, i: number) => string | number }) {
  const alinear = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  const hayTotales = columnas.some((c) => c.total !== undefined);
  return (
    <table className="w-full border-collapse text-[9.5pt]">
      <thead className="[display:table-header-group]">
        <tr className="border-y border-neutral-800 bg-neutral-100">
          {columnas.map((c, i) => (
            <th key={i} style={{ width: c.ancho }} className={`py-1.5 px-2 text-[8pt] font-bold uppercase tracking-wider text-neutral-700 ${alinear(c.alinear)}`}>
              {c.titulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.length === 0 ? (
          <tr>
            <td colSpan={columnas.length} className="py-6 text-center italic text-neutral-500">
              {vacio}
            </td>
          </tr>
        ) : (
          filas.map((f, i) => (
            <tr key={clave(f, i)} className="border-b border-neutral-200 break-inside-avoid">
              {columnas.map((c, j) => (
                <td key={j} className={`py-1.5 px-2 align-top tabular-nums ${alinear(c.alinear)} ${c.nowrap ? "whitespace-nowrap" : ""}`}>
                  {c.celda(f, i)}
                </td>
              ))}
            </tr>
          ))
        )}
        {hayTotales && filas.length > 0 && (
          <tr className="border-t-2 border-neutral-800 font-bold bg-neutral-50 break-inside-avoid">
            {columnas.map((c, j) => (
              <td key={j} className={`py-2 px-2 tabular-nums ${alinear(c.alinear)} ${c.nowrap ? "whitespace-nowrap" : ""}`}>
                {c.total ?? ""}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Barras horizontales para comparar cifras (métodos de pago, categorías) sin depender de colores. */
export function BarrasImpresas({ datos, formato }: { datos: { etiqueta: string; valor: number; nota?: string }[]; formato: (n: number) => string }) {
  const max = Math.max(...datos.map((d) => d.valor), 0);
  return (
    <ul className="space-y-1.5">
      {datos.map((d) => (
        <li key={d.etiqueta} className="break-inside-avoid">
          <div className="flex justify-between gap-3 text-[9.5pt]">
            <span className="truncate">
              {d.etiqueta}
              {d.nota && <span className="text-neutral-500"> · {d.nota}</span>}
            </span>
            <span className="font-semibold tabular-nums shrink-0">{formato(d.valor)}</span>
          </div>
          <div className="h-1.5 rounded-sm bg-neutral-200 overflow-hidden">
            <div className="h-full bg-neutral-700" style={{ width: max > 0 ? `${Math.max(2, (d.valor / max) * 100)}%` : "0%", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Columnas de barras verticales (evolución en el tiempo) en SVG, legibles en blanco y negro. */
export function EvolucionImpresa({ puntos, formato }: { puntos: { etiqueta: string; valor: number }[]; formato: (n: number) => string }) {
  const max = Math.max(...puntos.map((p) => p.valor), 0);
  const W = 640;
  const H = 130;
  const base = H - 18;
  const ancho = puntos.length > 0 ? W / puntos.length : W;
  const cada = Math.max(1, Math.ceil(puntos.length / 12));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolución en el tiempo">
      <line x1="0" y1={base} x2={W} y2={base} stroke="#a3a3a3" strokeWidth="1" />
      {puntos.map((p, i) => {
        const h = max > 0 ? (p.valor / max) * (base - 14) : 0;
        const x = i * ancho + ancho * 0.18;
        const w = ancho * 0.64;
        return (
          <g key={p.etiqueta + i}>
            <rect x={x} y={base - h} width={w} height={Math.max(h, p.valor > 0 ? 1 : 0)} fill="#404040" />
            {i % cada === 0 && (
              <text x={i * ancho + ancho / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#525252">
                {p.etiqueta}
              </text>
            )}
          </g>
        );
      })}
      {max > 0 && (
        <text x="0" y="9" fontSize="9" fill="#525252">
          máx. {formato(max)}
        </text>
      )}
    </svg>
  );
}

export function NotaImpresa({ children }: { children: ReactNode }) {
  return <p className="text-[8.5pt] text-neutral-500 leading-snug">{children}</p>;
}

/** Espacio para firmas (cierres de caja, entregas). */
export function FirmasImpresas({ firmas }: { firmas: string[] }) {
  return (
    <div className="grid gap-10 pt-12 break-inside-avoid" style={{ gridTemplateColumns: `repeat(${firmas.length}, minmax(0, 1fr))` }}>
      {firmas.map((f) => (
        <div key={f} className="border-t border-neutral-800 pt-1 text-center text-[9pt] text-neutral-600">
          {f}
        </div>
      ))}
    </div>
  );
}
