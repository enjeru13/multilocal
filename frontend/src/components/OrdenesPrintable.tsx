import { forwardRef } from "react";
import { formatearMoneda } from "../utils/monedaHelpers";
import type {
  Moneda,
  Orden,
  Configuracion,
  EstadoOrden,
  EstadoPagoRaw,
} from "@lavanderia/shared/types/types";
import dayjs from "dayjs";
import "dayjs/locale/es";

dayjs.locale("es");

interface OrdenesPrintableProps {
  ordenes: Orden[];
  monedaPrincipal: Moneda;
  configuracion?: Configuracion | null;
  filtros: {
    estado: EstadoOrden | "TODOS" | "";
    pago: EstadoPagoRaw | "TODOS" | "";
  };
}

export const OrdenesPrintable = forwardRef<
  HTMLDivElement,
  OrdenesPrintableProps
>(({ ordenes, monedaPrincipal, configuracion, filtros }, ref) => {
  const fechaGeneracion = dayjs().format("DD [de] MMMM [de] YYYY - hh:mm A");

  // Datos del negocio
  const nombreNegocio = configuracion?.nombreNegocio || "Mi Lavandería";
  const rif = configuracion?.rif || "RIF: J-00000000-0";
  const direccion = configuracion?.direccion || "Dirección no configurada";
  const telefono = configuracion?.telefonoPrincipal || "";

  // Cálculos de totales para el resumen
  const totalMonto = ordenes.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalDeuda = ordenes.reduce((sum, o) => sum + (o.faltante || 0), 0);

  return (
    <div ref={ref} className="w-full p-8 bg-white text-gray-800 font-sans">
      {/* --- ENCABEZADO --- */}
      <div className="flex justify-between items-end border-b-2 border-gray-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-blue-900">
            Reporte de Órdenes
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Generado el:{" "}
            <span className="font-semibold text-gray-700">
              {fechaGeneracion}
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-1 uppercase">
            Filtros:{" "}
            {filtros.estado !== "TODOS" ? filtros.estado : "Todas las entregas"}{" "}
            / {filtros.pago !== "TODOS" ? filtros.pago : "Todos los pagos"}
          </p>
        </div>

        <div className="text-right text-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {nombreNegocio}
          </h2>
          <p className="text-gray-600 font-medium">{rif}</p>
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
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            Total en Órdenes
          </p>
          <p className="text-2xl font-extrabold text-gray-800">
            {formatearMoneda(totalMonto, monedaPrincipal)}
          </p>
        </div>
        <div className="flex-1 bg-red-50 border border-red-100 rounded-lg p-4">
          <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">
            Por Cobrar (Deuda)
          </p>
          <p className="text-2xl font-extrabold text-red-700">
            {formatearMoneda(totalDeuda, monedaPrincipal)}
          </p>
        </div>
        <div className="w-1/4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            Cantidad
          </p>
          <p className="text-2xl font-extrabold text-gray-700">
            {ordenes.length}
          </p>
        </div>
      </div>

      {/* --- TABLA --- */}
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 text-gray-700 border-y border-gray-300">
            <th className="py-2 px-2 font-bold w-16">N°</th>
            <th className="py-2 px-2 font-bold">Cliente</th>
            <th className="py-2 px-2 font-bold">Fecha Ingreso</th>
            <th className="py-2 px-2 font-bold">Estado</th>
            <th className="py-2 px-2 font-bold">Pago</th>
            <th className="py-2 px-2 font-bold text-right">Total</th>
            <th className="py-2 px-2 font-bold text-right text-red-600">
              Falta
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {ordenes.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="py-10 text-center text-gray-500 italic"
              >
                No hay órdenes con estos criterios.
              </td>
            </tr>
          ) : (
            ordenes.map((orden) => (
              <tr key={orden.id} className="break-inside-avoid">
                <td className="py-2 px-2 font-bold text-blue-800">
                  #{orden.id}
                </td>
                <td className="py-2 px-2 truncate max-w-[180px]">
                  {orden.cliente?.nombre} {orden.cliente?.apellido}
                </td>
                <td className="py-2 px-2 text-gray-600">
                  {dayjs(orden.fechaIngreso).format("DD/MM/YYYY")}
                </td>
                <td className="py-2 px-2 text-xs font-semibold uppercase">
                  {orden.estado}
                </td>
                <td className="py-2 px-2 text-xs">
                  {orden.estadoPago === "COMPLETO" ? (
                    <span className="text-green-700 font-bold">Completo</span>
                  ) : (
                    <span className="text-orange-600 font-bold">
                      Incompleto
                    </span>
                  )}
                </td>
                <td className="py-2 px-2 text-right font-bold text-gray-800">
                  {formatearMoneda(orden.total || 0, monedaPrincipal)}
                </td>
                <td className="py-2 px-2 text-right font-bold text-red-600">
                  {orden.faltante && orden.faltante > 0
                    ? formatearMoneda(orden.faltante, monedaPrincipal)
                    : "-"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* --- FOOTER --- */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-400 flex justify-between print:mt-auto">
        <span>{configuracion?.mensajePieRecibo || "Sistema de Gestión"}</span>
        <span>Fin del reporte</span>
      </div>
    </div>
  );
});

OrdenesPrintable.displayName = "OrdenesPrintable";
