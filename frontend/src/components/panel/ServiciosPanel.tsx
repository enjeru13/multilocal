import { useState, useEffect, useMemo } from "react";
import { FaTshirt, FaPlus, FaDollarSign, FaTrashAlt } from "react-icons/fa";
import { formatearMoneda, montoAEntrada, parsearMonto, type Moneda } from "../../utils/monedaHelpers";
import CampoMonto from "../ui/CampoMonto";
import { useEtiquetas } from "../../context/configuracionCore";
import type {
  Servicio,
  ServicioSeleccionado,
} from "@lavanderia/shared/types/types";
import Button from "../ui/Button"; // 1. Importamos el componente Button

type Props = {
  serviciosCatalogo: Servicio[];
  serviciosSeleccionados: ServicioSeleccionado[];
  setServiciosSeleccionados: React.Dispatch<
    React.SetStateAction<ServicioSeleccionado[]>
  >;
  monedaPrincipal: Moneda;
};

export default function ServiciosPanel({
  serviciosCatalogo,
  serviciosSeleccionados,
  setServiciosSeleccionados,
  monedaPrincipal,
}: Props) {
  const et = useEtiquetas();
  const [servicioId, setServicioId] = useState<number | string>("");
  const [cantidad, setCantidad] = useState<number>(1);
  const [precioPersonalizado, setPrecioPersonalizado] = useState<string>("");

  // Obtener el servicio actual para validar decimales
  const servicioActual = useMemo(
    () => serviciosCatalogo.find((s) => s.id === Number(servicioId)),
    [servicioId, serviciosCatalogo]
  );

  // Resetear precio y ajustar cantidad mínima al cambiar de servicio
  useEffect(() => {
    if (servicioActual) {
      setPrecioPersonalizado(montoAEntrada(servicioActual.precioBase, monedaPrincipal));
      setCantidad(1);
    } else {
      setPrecioPersonalizado("");
    }
  }, [servicioActual, monedaPrincipal]);

  const agregarServicio = () => {
    if (!servicioActual) return;
    if (cantidad <= 0) return;

    // Validar precio
    const precioFinal = precioPersonalizado === "" ? NaN : parsearMonto(precioPersonalizado, monedaPrincipal);
    if (isNaN(precioFinal) || precioFinal < 0) return;

    const existe = serviciosSeleccionados.find(
      (s) => s.servicioId === servicioActual.id
    );

    if (existe) {
      // Si existe, sumamos cantidad y actualizamos al ÚLTIMO precio ingresado
      setServiciosSeleccionados((prev) =>
        prev.map((s) =>
          s.servicioId === servicioActual.id
            ? { ...s, cantidad: s.cantidad + cantidad, precio: precioFinal }
            : s
        )
      );
    } else {
      setServiciosSeleccionados((prev) => [
        ...prev,
        { servicioId: servicioActual.id, cantidad, precio: precioFinal },
      ]);
    }

    // Reset simple (mantenemos el servicio seleccionado por si quiere agregar más)
    setCantidad(1);
  };

  const eliminarServicio = (id: number) => {
    setServiciosSeleccionados((prev) =>
      prev.filter((s) => s.servicioId !== id)
    );
  };

  return (
    <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 transition-all duration-300">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-3">
        <FaTshirt size={28} className="text-blue-600 dark:text-blue-400" /> Selección de {et.servicios}
      </h2>

      {/* --- FILA DE AGREGAR --- */}
      <div className="grid grid-cols-2 md:flex gap-3 sm:gap-4 mb-6 items-end bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
        {/* SELECTOR SERVICIO */}
        <div className="col-span-2 md:flex-1 w-full">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {et.servicio}
          </label>
          <select
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 dark:text-gray-100 transition-colors"
            value={servicioId}
            onChange={(e) => setServicioId(e.target.value)}
          >
            <option value="">-- Seleccionar --</option>
            {serviciosCatalogo.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombreServicio}
              </option>
            ))}
          </select>
        </div>

        {/* INPUT PRECIO (EDITABLE) */}
        <div className="md:w-40">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Precio Unit.
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaDollarSign className="text-gray-400 dark:text-gray-500 text-xs" />
            </div>
            <CampoMonto
              moneda={monedaPrincipal}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 pl-8 focus:ring-2 focus:ring-blue-500 focus:outline-none text-right font-medium bg-white dark:bg-gray-800 dark:text-gray-100 transition-colors"
              value={precioPersonalizado}
              onValue={setPrecioPersonalizado}
              disabled={!servicioId}
            />
          </div>
        </div>

        {/* INPUT CANTIDAD (VALIDACIÓN DECIMALES) */}
        <div className="md:w-32">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Cantidad {servicioActual?.permiteDecimales ? "(Dec)" : "(Ent)"}
          </label>
          <input
            type="number"
            min="0.01"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none text-center font-medium bg-white dark:bg-gray-800 dark:text-gray-100 transition-colors"
            value={cantidad}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (servicioActual && !servicioActual.permiteDecimales) {
                setCantidad(Math.floor(val));
              } else {
                setCantidad(val);
              }
            }}
            onKeyDown={(e) => {
              if (
                servicioActual &&
                !servicioActual.permiteDecimales &&
                e.key === "."
              ) {
                e.preventDefault();
              }
            }}
          />
        </div>

        {/* BOTÓN AGREGAR (Reemplazado) */}
        <div className="col-span-2 md:col-span-1 md:w-auto">
          <Button
            onClick={agregarServicio}
            disabled={!servicioId || cantidad <= 0}
            variant="primary"
            leftIcon={<FaPlus />}
            // Forzamos la clase para que se comporte igual en responsive que tu input anterior
            className="w-full md:w-auto h-11 md:h-[46px]"
          >
            Agregar
          </Button>
        </div>
      </div>

      {/* --- TABLA --- */}
      <div className="space-y-3">
        {serviciosSeleccionados.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-6 italic bg-gray-50 dark:bg-gray-950 rounded-lg border border-dashed border-gray-300 dark:border-gray-800 transition-all">
            Aún no has agregado nada.
          </p>
        ) : (
          <>
          <ul className="md:hidden divide-y divide-gray-200 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950">
            {serviciosSeleccionados.map((item, index) => {
              const s = serviciosCatalogo.find((cat) => cat.id === item.servicioId);
              const precio = item.precio ?? s?.precioBase ?? 0;
              return (
                <li key={`${item.servicioId}-${index}`} className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{s?.nombreServicio}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {item.cantidad} × {formatearMoneda(precio, monedaPrincipal)}
                      {s && precio !== s.precioBase && <span className="ml-1.5 font-bold text-orange-500">Editado</span>}
                    </p>
                  </div>
                  <p className="font-bold tabular-nums text-green-600 dark:text-green-500">{formatearMoneda(precio * item.cantidad, monedaPrincipal)}</p>
                  <button onClick={() => eliminarServicio(item.servicioId)} className="w-10 h-10 -mr-2 flex items-center justify-center text-red-500 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/40 rounded-full cursor-pointer" title={`Eliminar ${et.servicioMin}`} aria-label={`Eliminar ${et.servicioMin}`}>
                    <FaTrashAlt />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="max-md:hidden overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm transition-all">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {et.servicio}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cant.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Subtotal
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
                {serviciosSeleccionados.map((item, index) => {
                  const s = serviciosCatalogo.find(
                    (cat) => cat.id === item.servicioId
                  );
                  const precio = item.precio ?? s?.precioBase ?? 0;
                  return (
                    <tr
                      key={`${item.servicioId}-${index}`}
                      className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {s?.nombreServicio}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-bold text-gray-700 dark:text-gray-300">
                        {item.cantidad}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-right dark:text-gray-200">
                        {s && precio !== s.precioBase && (
                          <span className="text-xs text-orange-500 dark:text-orange-400 mr-1 font-bold">
                            (Editado)
                          </span>
                        )}
                        {formatearMoneda(precio, monedaPrincipal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-600 dark:text-green-500">
                        {formatearMoneda(
                          precio * item.cantidad,
                          monedaPrincipal
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => eliminarServicio(item.servicioId)}
                          className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 p-2 rounded-full transition-all cursor-pointer"
                          title={`Eliminar ${et.servicioMin}`}
                        >
                          <FaTrashAlt />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </section>
  );
}