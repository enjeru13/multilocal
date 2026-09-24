import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import type {
  ClienteResumen,
  Servicio,
  ServicioSeleccionado,
} from "@lavanderia/shared/types/types";
import { FaClipboardList, FaTshirt, FaTag, FaInfoCircle } from "react-icons/fa";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useEtiquetas } from "../../context/configuracionCore";

dayjs.locale("es");

type Props = {
  cliente: ClienteResumen | null;
  serviciosSeleccionados: ServicioSeleccionado[];
  serviciosCatalogo: Servicio[];
  observaciones: string;
  fechaEntrega: string;
  monedaPrincipal: Moneda;
};

export default function ResumenOrdenPanel({
  cliente,
  serviciosSeleccionados,
  serviciosCatalogo,
  observaciones,
  fechaEntrega,
  monedaPrincipal,
}: Props) {
  const et = useEtiquetas();
  // --- LÓGICA CORREGIDA ---
  // Calcular subtotal real considerando precio personalizado si existe
  const calcularSubtotalServicio = (s: ServicioSeleccionado) => {
    const servicio = serviciosCatalogo.find((x) => x.id === s.servicioId);

    // 1. Busamos el precio: Si 's.precio' existe (editado), úsalo. Si no, usa el del catálogo.
    const precioUnitario = s.precio ?? servicio?.precioBase ?? 0;

    // 2. Calculamos el bruto
    const bruto = precioUnitario * s.cantidad;

    // 3. Restamos descuento (si existe)
    const descuento = s.descuento || 0;

    return Math.max(0, bruto - descuento);
  };

  const totalPrendas = serviciosSeleccionados.reduce(
    (sum, item) => sum + item.cantidad,
    0
  );

  const formatFechaEntrega = (dateString: string) => {
    if (!dateString) return "No definida";
    const fecha = dayjs(dateString);
    return fecha.isValid() ? fecha.format("DD/MM/YYYY") : "Fecha inválida";
  };

  return (
    <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
      <header className="pb-4 border-b border-gray-200 dark:border-gray-800 mb-6 transition-colors">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <FaClipboardList size={28} className="text-teal-600 dark:text-teal-400" /> Resumen de la
          orden
        </h2>
        <p className="text-base text-gray-600 dark:text-gray-400 mt-2">
          Detalle general antes de confirmar.
        </p>
      </header>

      <div className="space-y-5 text-base text-gray-800 dark:text-gray-200">
        {/* SECCIÓN CLIENTE */}
        <div className="bg-gray-100 dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
          <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
            {et.cliente}:
          </span>
          {cliente ? (
            <span className="text-gray-900 dark:text-gray-100 font-medium text-lg">
              {cliente.nombre} {cliente.apellido}
            </span>
          ) : (
            <span className="italic text-gray-500 dark:text-gray-500">No asignado</span>
          )}
        </div>

        {/* SECCIÓN SERVICIOS */}
        <div>
          <span className="text-gray-700 dark:text-gray-300 block mb-3 font-semibold">
            {et.servicios} seleccionados:
          </span>
          {serviciosSeleccionados.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 italic bg-gray-100 dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm transition-all">
              Nada seleccionado
            </p>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950 shadow-sm transition-all">
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {serviciosSeleccionados.map((s) => {
                  const servicio = serviciosCatalogo.find(
                    (x) => x.id === s.servicioId
                  );
                  const descuento = s.descuento || 0;
                  const tieneDescuento = descuento > 0;

                  // Detectar si es precio editado para mostrar indicador visual (Opcional pero útil)
                  const precioUsado = s.precio ?? servicio?.precioBase ?? 0;
                  const esPrecioEditado =
                    servicio && precioUsado !== servicio.precioBase;

                  return (
                    <li
                      key={s.servicioId}
                      className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-900 transition duration-200 ease-in-out"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          {servicio?.nombreServicio ?? `${et.servicio} desconocido`}

                          <span className="font-bold text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-sm transition-colors">
                            × {s.cantidad}
                          </span>

                          {esPrecioEditado && (
                            <span
                              className="text-xs text-orange-500 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800/30 flex items-center gap-1 transition-all"
                              title="Precio modificado manualmente"
                            >
                              <FaInfoCircle size={10} /> Editado
                            </span>
                          )}
                        </span>

                        {tieneDescuento && (
                          <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1 font-semibold transition-colors">
                            <FaTag size={10} /> Descuento aplicado: -
                            {formatearMoneda(descuento, monedaPrincipal)}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-green-700 dark:text-green-500 block text-lg transition-colors">
                          {formatearMoneda(
                            calcularSubtotalServicio(s),
                            monedaPrincipal
                          )}
                        </span>
                        {/* Mostrar el unitario pequeño debajo para referencia */}
                        <span className="text-xs text-gray-400 dark:text-gray-500 block transition-colors">
                          Unit: {formatearMoneda(precioUsado, monedaPrincipal)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 border-t border-blue-100 dark:border-blue-900/30 flex justify-between items-center transition-all">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                  <FaTshirt />
                  <span>Total de artículos:</span>
                </div>
                <span className="bg-white dark:bg-gray-800 text-blue-900 dark:text-blue-100 font-extrabold px-4 py-1 rounded-full border border-blue-200 dark:border-blue-700 text-lg shadow-sm transition-all">
                  {totalPrendas}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* OBSERVACIONES Y FECHA */}
        {observaciones && (
          <div className="bg-gray-100 dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
            <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
              Observaciones:
            </span>
            <p className="text-gray-900 dark:text-gray-100 wrap-break-word whitespace-pre-wrap">
              {observaciones}
            </p>
          </div>
        )}
        {fechaEntrega && (
          <div className="bg-gray-100 dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
            <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
              Fecha de entrega estimada:
            </span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {formatFechaEntrega(fechaEntrega)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
