import { forwardRef } from "react";
import { formatearMoneda } from "../utils/monedaHelpers";
import type {
  Moneda,
  Pago,
  Orden,
  MetodoPago,
  Configuracion, // Importamos tu interfaz
} from "@lavanderia/shared/types/types";
import dayjs from "dayjs";
import "dayjs/locale/es";

dayjs.locale("es");

interface PagoConOrden extends Pago {
  orden?: Orden & {
    cliente?: {
      nombre: string;
      apellido: string;
    };
  };
  tasa?: number | null;
}

interface PagosPrintableProps {
  pagos: PagoConOrden[];
  monedaPrincipal: Moneda;
  totalIngresos: number;
  configuracion?: Configuracion | null; // <--- Recibimos la config
}

const metodoPagoDisplay: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  PAGO_MOVIL: "Pago Móvil",
};

export const PagosPrintable = forwardRef<HTMLDivElement, PagosPrintableProps>(
  ({ pagos, monedaPrincipal, totalIngresos, configuracion }, ref) => {
    const fechaGeneracion = dayjs().format("DD [de] MMMM [de] YYYY - hh:mm A");

    // Datos con fallback por si están null
    const nombreNegocio = configuracion?.nombreNegocio || "Mi Lavandería";
    const rif = configuracion?.rif || "RIF: J-00000000-0";
    const direccion = configuracion?.direccion || "Dirección no configurada";
    const telefono = configuracion?.telefonoPrincipal || "";

    return (
      <div ref={ref} className="w-full pt-6 bg-white text-gray-800 font-sans">
        {/* --- ENCABEZADO DINÁMICO --- */}
        <div className="flex justify-between items-end border-b-2 border-gray-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-blue-900">
              Reporte de Ingresos
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              Generado el:{" "}
              <span className="font-semibold text-gray-700">
                {fechaGeneracion}
              </span>
            </p>
          </div>

          {/* AQUÍ SE MUESTRAN TUS DATOS REALES */}
          <div className="text-right text-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {nombreNegocio}
            </h2>
            <p className="text-gray-600 font-medium">
              {rif.startsWith("J") || rif.startsWith("V") ? rif : `RIF: ${rif}`}
            </p>
            <p className="text-gray-600 max-w-[250px] ml-auto leading-tight mt-1">
              {direccion}
            </p>
            {telefono && (
              <p className="text-gray-600 mt-1 font-medium">Tel: {telefono}</p>
            )}
          </div>
        </div>

        {/* --- RESUMEN --- */}
        <div className="flex gap-6 mb-8">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-5 print:bg-gray-100 print:border-gray-300">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Total Recaudado ({monedaPrincipal})
            </p>
            <p className="text-4xl font-extrabold text-green-700">
              {formatearMoneda(totalIngresos, monedaPrincipal)}
            </p>
          </div>
          <div className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg p-5 print:bg-gray-100 print:border-gray-300">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Transacciones
            </p>
            <p className="text-4xl font-extrabold text-gray-700">
              {pagos.length}
            </p>
          </div>
        </div>

        {/* --- TABLA --- */}
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 border-y border-gray-300 print:bg-gray-200">
              <th className="py-3 px-4 font-bold">Fecha</th>
              <th className="py-3 px-4 font-bold">Orden</th>
              <th className="py-3 px-4 font-bold">Cliente</th>
              <th className="py-3 px-4 font-bold">Método</th>
              <th className="py-3 px-4 font-bold text-right">Tasa</th>
              <th className="py-3 px-4 font-bold text-center">Divisa</th>
              <th className="py-3 px-4 font-bold text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pagos.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-gray-500 italic"
                >
                  No hay pagos registrados.
                </td>
              </tr>
            ) : (
              pagos.map((pago, index) => {
                const mostrarTasa =
                  pago.tasa && pago.tasa > 1 && pago.moneda !== "USD";
                return (
                  <tr
                    key={pago.id || index}
                    className="hover:bg-gray-50 print:break-inside-avoid"
                  >
                    <td className="py-2 px-4 whitespace-nowrap text-gray-600">
                      {dayjs(pago.fechaPago).format("DD/MM/YYYY")}
                    </td>
                    <td className="py-2 px-4 font-bold text-blue-800 print:text-black">
                      #{pago.ordenId}
                    </td>
                    <td className="py-2 px-4 truncate max-w-[180px] text-gray-800">
                      {pago.orden?.cliente
                        ? `${pago.orden.cliente.nombre} ${pago.orden.cliente.apellido}`
                        : "N/A"}
                    </td>
                    <td className="py-2 px-4 capitalize text-gray-600">
                      {metodoPagoDisplay[pago.metodoPago]}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-xs text-gray-500">
                      {mostrarTasa ? Number(pago.tasa).toFixed(2) : "-"}
                    </td>
                    <td className="py-2 px-4 text-center text-xs font-bold text-gray-500">
                      {pago.moneda}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                      {formatearMoneda(pago.monto, pago.moneda)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* --- FOOTER --- */}
        <div className="mt-12 pt-4 border-t border-gray-300 text-center text-xs text-gray-400 flex justify-between print:mt-auto">
          <span>
            {configuracion?.mensajePieRecibo || "Gracias por su preferencia"}
          </span>
          <span>Fin del reporte</span>
        </div>
      </div>
    );
  }
);

PagosPrintable.displayName = "PagosPrintable";
