import { FaSearch, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import { useMonedas } from "../../context/useMonedas";
import { formatearMoneda } from "../../utils/monedaHelpers";
import type {
  Moneda,
  Pago,
  Orden,
  MetodoPago,
} from "@lavanderia/shared/types/types";
import dayjs from "dayjs";
import "dayjs/locale/es";
import Button from "../ui/Button";
import TarjetaRegistro from "../ui/TarjetaRegistro";
import { nombreCliente } from "../../utils/clienteHelpers";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";
import { calcularTotalAbonado } from "@lavanderia/shared/utils/pagoFinance";

dayjs.locale("es");

// 1. CORRECCIÓN DEL TIPO AQUÍ
interface PagoConOrden extends Pago {
  orden?: Orden & { cliente?: { nombre: string; apellido: string } };
  tasa?: number | null;
}

type SortKeys = "fechaPago" | "ordenId" | "monto";
type SortDirection = "asc" | "desc";

interface Props {
  pagos: PagoConOrden[];
  monedaPrincipal: Moneda;
  sortColumn: SortKeys | null;
  sortDirection: SortDirection;
  cargandoOrdenDetalle: boolean;
  monedaFiltro: Moneda | "TODAS";
  setMonedaFiltro: (moneda: Moneda | "TODAS") => void;
  onSort: (column: SortKeys) => void;
  onVerDetallesOrden: (ordenId: number) => void;
}

const metodoPagoDisplay: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  PAGO_MOVIL: "Pago móvil",
};

export default function TablaPagos({
  pagos,
  monedaPrincipal,
  sortColumn,
  sortDirection,
  monedaFiltro,
  setMonedaFiltro,
  cargandoOrdenDetalle,
  onSort,
  onVerDetallesOrden,
}: Props) {
  const et = useEtiquetas();
  const negocio = useMonedas();
  const { config } = useConfiguracion();
  const tasas = { VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null };
  const getSortIcon = (column: SortKeys) => {
    if (sortColumn === column) {
      return sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />;
    }
    return <FaSort />;
  };

  return (
    <>
    <div className="md:hidden space-y-2.5">
      <label className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        Moneda
        <select
          value={monedaFiltro}
          onChange={(e) => setMonedaFiltro(e.target.value as Moneda | "TODAS")}
          className="h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        >
          <option value="TODAS">Todas</option>
          {negocio.activas.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <ul className="space-y-2.5">
        {pagos.length === 0 && <li className="text-center text-sm text-gray-500 dark:text-gray-400 italic py-8">No se encontraron pagos registrados.</li>}
        {pagos.map((pago) => (
          <TarjetaRegistro
            key={pago.id}
            onClick={cargandoOrdenDetalle ? undefined : () => onVerDetallesOrden(pago.ordenId)}
            titulo={
              <>
                <span className="text-blue-700 dark:text-blue-400 mr-1.5">#{pago.ordenId}</span>
                {nombreCliente(pago.orden?.cliente)}
              </>
            }
            subtitulo={`${dayjs(pago.fechaPago).format("DD MMM YYYY")} · ${metodoPagoDisplay[pago.metodoPago]}`}
            destacado={
              <span className={pago.monto < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}>
                {formatearMoneda(pago.monto, pago.moneda)}
              </span>
            }
            datos={[
              ...(pago.moneda !== monedaPrincipal
                ? [{ k: `En ${monedaPrincipal}`, v: "≈ " + formatearMoneda(calcularTotalAbonado([{ ...pago, tasa: pago.tasa ?? null, vueltos: [] }], tasas, monedaPrincipal), monedaPrincipal) }]
                : []),
              ...(pago.vueltos ?? []).map((v) => ({ k: "Vuelto", v: formatearMoneda(v.monto, v.moneda as Moneda) })),
            ]}
          />
        ))}
      </ul>
    </div>

    <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 transition-all">
      <table className="min-w-full bg-white dark:bg-gray-900 text-sm transition-colors">
        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
          <tr className="text-left">
            <th
              className="px-4 py-2 font-semibold cursor-pointer whitespace-nowrap"
              onClick={() => onSort("fechaPago")}
            >
              <div className="flex items-center gap-1">
                Fecha {getSortIcon("fechaPago")}
              </div>
            </th>
            <th
              className="px-4 py-2 font-semibold cursor-pointer whitespace-nowrap"
              onClick={() => onSort("ordenId")}
            >
              <div className="flex items-center gap-1">
                Orden {getSortIcon("ordenId")}
              </div>
            </th>
            <th className="px-4 py-2 font-semibold">{et.cliente}</th>
            <th className="px-4 py-2 font-semibold whitespace-nowrap">
              Método
            </th>
            {/* NUEVA COLUMNA DE TASA (OPCIONAL) */}
            <th className="px-4 py-2 font-semibold whitespace-nowrap">
              Tasa (Hist.)
            </th>
            <th className="px-4 py-2 font-semibold whitespace-nowrap">
              <div className="flex flex-col gap-1 items-start">
                <span>Moneda</span>
                <select
                  value={monedaFiltro}
                  onChange={(e) => setMonedaFiltro(e.target.value as Moneda | "TODAS")}
                  className="p-1 text-xs border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="TODAS">Todas</option>
                  {negocio.activas.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </th>
            <th
              className="px-4 py-2 font-semibold cursor-pointer whitespace-nowrap"
              onClick={() => onSort("monto")}
            >
              <div className="flex items-center gap-1">
                Monto {getSortIcon("monto")}
              </div>
            </th>
            <th className="px-4 py-2 font-semibold text-center whitespace-nowrap">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {pagos.length === 0 ? (
            <tr>
              <td
                colSpan={8} // Aumentamos el colspan por la nueva columna
                className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic bg-white dark:bg-gray-900 transition-colors"
              >
                No se encontraron pagos registrados.
              </td>
            </tr>
          ) : (
            pagos.map((pago) => {
              const monedaSegura: Moneda = pago.moneda;

              // Lógica visual para la tasa
              const mostrarTasa =
                pago.tasa && pago.tasa > 1 && pago.moneda !== "USD";

              return (
                <tr
                  key={pago.id}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-150 text-gray-700 dark:text-gray-300"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {dayjs(pago.fechaPago).format("DD MMM YYYY")}
                  </td>
                  <td className="px-4 py-3 font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                    #{pago.ordenId}
                  </td>
                  <td className="px-4 py-3">
                    {nombreCliente(pago.orden?.cliente)}
                  </td>
                  <td className="px-4 py-3 capitalize whitespace-nowrap">
                    {metodoPagoDisplay[pago.metodoPago]}
                  </td>

                  {/* CELDA DE LA TASA HISTÓRICA */}
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400 text-xs">
                    {mostrarTasa ? (
                      <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded border border-gray-300 dark:border-gray-700">
                        {Number(pago.tasa).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-700">-</span>
                    )}
                  </td>

                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {monedaSegura}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={`font-semibold tabular-nums ${pago.monto < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                      {formatearMoneda(pago.monto, monedaSegura)}
                    </div>
                    {monedaSegura !== monedaPrincipal && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        ≈ {formatearMoneda(calcularTotalAbonado([{ ...pago, tasa: pago.tasa ?? null, vueltos: [] }], tasas, monedaPrincipal), monedaPrincipal)}
                      </div>
                    )}
                    {(pago.vueltos ?? []).map((v) => (
                      <div key={v.id} className="text-xs text-sky-600 dark:text-sky-400 tabular-nums">
                        vuelto {formatearMoneda(v.monto, v.moneda as Moneda)}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <Button
                      onClick={() => onVerDetallesOrden(pago.ordenId)}
                      title={`Ver detalles de ${et.ordenMin}`}
                      variant="iconInfo"
                      size="icon"
                      disabled={cargandoOrdenDetalle}
                    >
                      <FaSearch size={12} />
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
    </>
  );
}
