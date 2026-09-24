import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";

interface Props {
  total: number;
  abonado: number;
  saldo: number;
  moneda: Moneda;
}

/** Total / abonado / saldo con el mismo aspecto en el detalle de la orden y en el cobro. */
export default function ResumenCobro({ total, abonado, saldo, moneda }: Props) {
  const saldado = saldo <= 0.005;
  const fmt = (n: number) => formatearMoneda(n, moneda);

  const tile = "rounded-xl border p-3.5";
  const etiqueta = "text-[11px] font-semibold uppercase tracking-wider";

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className={`${tile} border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40`}>
        <p className={`${etiqueta} text-gray-500 dark:text-gray-400`}>Total</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmt(total)}</p>
      </div>
      <div className={`${tile} border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40`}>
        <p className={`${etiqueta} text-gray-500 dark:text-gray-400`}>Abonado</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(abonado)}</p>
      </div>
      <div
        className={`${tile} ${
          saldado
            ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10"
            : "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10"
        }`}
      >
        <p className={`${etiqueta} ${saldado ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
          {saldado ? "Saldado" : "Saldo"}
        </p>
        <p className={`mt-1 text-lg font-semibold tabular-nums ${saldado ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-200"}`}>
          {fmt(saldo)}
        </p>
      </div>
    </div>
  );
}
