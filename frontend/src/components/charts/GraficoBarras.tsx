import { useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import type { Moneda, SerieReportePunto } from "@lavanderia/shared/types/types";
import { formatearMoneda } from "../../utils/monedaHelpers";
import { numeroCorto } from "../../utils/formatoCorto";
import { useEtiquetas } from "../../context/configuracionCore";

interface Props {
  datos: SerieReportePunto[];
  moneda: Moneda;
  agrupar: "dia" | "mes";
  alto?: number;
  /** Muestra la serie de cobrado junto a la de ventas. */
  mostrarCobrado?: boolean;
}

const ANCHO = 720;
const MARGEN = { izq: 46, der: 8, arriba: 10, abajo: 26 };

/** Paso "redondo" (1, 2, 5 × 10ⁿ) para que el eje no muestre cifras raras. */
function pasoBonito(max: number, marcas: number) {
  if (max <= 0) return 1;
  const bruto = max / marcas;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / pot;
  const base = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return base * pot;
}

const etiquetaFecha = (fecha: string, agrupar: "dia" | "mes") =>
  agrupar === "mes" ? dayjs(`${fecha}-01`).locale("es").format("MMM YY") : dayjs(fecha).locale("es").format("DD/MM");

export default function GraficoBarras({ datos, moneda, agrupar, alto = 220, mostrarCobrado = true }: Props) {
  const et = useEtiquetas();
  const [activo, setActivo] = useState<number | null>(null);

  const maxDato = Math.max(0, ...datos.map((d) => Math.max(d.ventas, mostrarCobrado ? d.cobrado : 0)));
  const paso = pasoBonito(maxDato, 4);
  const tope = Math.max(paso, Math.ceil(maxDato / paso) * paso);
  const marcas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);

  const areaAncho = ANCHO - MARGEN.izq - MARGEN.der;
  const areaAlto = alto - MARGEN.arriba - MARGEN.abajo;
  const bandaAncho = datos.length ? areaAncho / datos.length : areaAncho;
  const series = mostrarCobrado ? 2 : 1;
  const barraAncho = Math.max(2, Math.min(28, (bandaAncho * 0.72) / series));
  const y = (v: number) => MARGEN.arriba + areaAlto - (v / tope) * areaAlto;
  const cadaCuanto = Math.max(1, Math.ceil(datos.length / 8));

  if (datos.length === 0) return null;

  const punto = activo !== null ? datos[activo] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        className="w-full h-auto text-gray-500 dark:text-gray-400"
        role="img"
        aria-label="Gráfico de ventas y cobros"
      >
        {marcas.map((m) => (
          <g key={m}>
            <line
              x1={MARGEN.izq}
              x2={ANCHO - MARGEN.der}
              y1={y(m)}
              y2={y(m)}
              className="stroke-gray-200 dark:stroke-gray-800"
              strokeWidth={1}
            />
            <text x={MARGEN.izq - 6} y={y(m) + 3} textAnchor="end" fontSize={10} fill="currentColor">
              {numeroCorto(m)}
            </text>
          </g>
        ))}

        {datos.map((d, i) => {
          const x0 = MARGEN.izq + i * bandaAncho + (bandaAncho - barraAncho * series - (series - 1) * 2) / 2;
          return (
            <g
              key={d.fecha}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              className="cursor-default"
            >
              <rect
                x={MARGEN.izq + i * bandaAncho}
                y={MARGEN.arriba}
                width={bandaAncho}
                height={areaAlto}
                fill={activo === i ? "currentColor" : "transparent"}
                opacity={0.06}
              />
              <rect
                x={x0}
                y={y(d.ventas)}
                width={barraAncho}
                height={Math.max(0, MARGEN.arriba + areaAlto - y(d.ventas))}
                rx={2}
                className="fill-blue-500"
              />
              {mostrarCobrado && (
                <rect
                  x={x0 + barraAncho + 2}
                  y={y(Math.max(d.cobrado, 0))}
                  width={barraAncho}
                  height={Math.max(0, MARGEN.arriba + areaAlto - y(Math.max(d.cobrado, 0)))}
                  rx={2}
                  className="fill-emerald-500"
                />
              )}
              {i % cadaCuanto === 0 && (
                <text
                  x={MARGEN.izq + i * bandaAncho + bandaAncho / 2}
                  y={alto - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                >
                  {etiquetaFecha(d.fecha, agrupar)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-between gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400 min-h-5">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Facturado
          </span>
          {mostrarCobrado && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Cobrado
            </span>
          )}
        </div>
        {punto && (
          <span className="text-gray-700 dark:text-gray-200 font-medium">
            {etiquetaFecha(punto.fecha, agrupar)} · {formatearMoneda(punto.ventas, moneda)}
            {mostrarCobrado && ` · cobrado ${formatearMoneda(punto.cobrado, moneda)}`} · {punto.cantidad}{" "}
            {punto.cantidad === 1 ? et.ordenMin : et.ordenesMin}
          </span>
        )}
      </div>
    </div>
  );
}
