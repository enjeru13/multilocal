import {
  FaSearch,
  FaMoneyBillWave,
  FaCheckCircle,
  FaTrashAlt,
  FaBan,
} from "react-icons/fa";
import { badgeEstado, badgePago } from "../../utils/badgeHelpers";
import {
  formatearMoneda,
  type Moneda,
  normalizarMoneda,
} from "../../utils/monedaHelpers";
import type { Orden } from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import dayjs from "dayjs";
import Button from "../ui/Button";
import { nombreCliente } from "../../utils/clienteHelpers";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";

interface Props {
  ordenes: Orden[];
  monedaPrincipal: Moneda;
  onVerDetalles: (orden: Orden) => void;
  onRegistrarPago: (orden: Orden) => void;
  onMarcarEntregada: (id: number) => void;
  onEliminar: (id: number) => void;
  onAnular: (id: number) => void;
}

export default function TablaOrdenes({
  ordenes,
  monedaPrincipal,
  onVerDetalles,
  onRegistrarPago,
  onMarcarEntregada,
  onEliminar,
  onAnular,
}: Props) {
  const principalSeguro: Moneda = normalizarMoneda(monedaPrincipal);
  const { hasRole } = useAuth();
  const { config } = useConfiguracion();
  const et = useEtiquetas();
  const conEntrega = config?.moduloFechaEntrega !== false;

  return (
    <>
      {/* Teléfono: una tarjeta por registro, con las acciones a la vista. */}
      <ul className="md:hidden space-y-2.5">
        {ordenes.length === 0 && <li className="text-center text-sm text-gray-500 dark:text-gray-400 italic py-8">{`No se encontraron ${et.ordenesMin} registradas.`}</li>}
        {ordenes.map((o) => {
          const cancelada = o.estado === "CANCELADO";
          const puedeCobrar = o.estadoPago !== "COMPLETO" && o.estado !== "ENTREGADO" && !cancelada;
          const puedeEntregar = conEntrega && o.estado !== "ENTREGADO" && !cancelada;
          return (
            <li key={o.id} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
              <button type="button" onClick={() => onVerDetalles(o)} className="w-full text-left p-3.5 space-y-2 active:bg-gray-50 dark:active:bg-gray-800/60 cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                      <span className="text-blue-700 dark:text-blue-400 mr-1.5">#{o.id}</span>
                      {nombreCliente(o.cliente)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {dayjs(o.fechaIngreso).format("DD/MM/YYYY")}
                      {conEntrega && o.fechaEntrega && ` · entrega ${dayjs(o.fechaEntrega).format("DD/MM")}`}
                    </p>
                  </div>
                  <p className="text-base font-extrabold tabular-nums text-gray-900 dark:text-gray-100 shrink-0">{formatearMoneda(o.total ?? 0, principalSeguro)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {badgeEstado(o.estado)}
                    {!cancelada && badgePago(o.estadoPago)}
                  </div>
                  {!cancelada && o.faltante > 0.005 && <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">Falta {formatearMoneda(o.faltante ?? 0, principalSeguro)}</span>}
                </div>
              </button>
              {(puedeCobrar || puedeEntregar || hasRole(["ADMIN"])) && (
                <div className="flex items-center gap-2 px-3 pb-3">
                  {puedeCobrar && (
                    <Button onClick={() => onRegistrarPago(o)} variant="whatsapp" size="sm" className="flex-1" leftIcon={<FaMoneyBillWave size={12} />}>
                      Cobrar
                    </Button>
                  )}
                  {puedeEntregar && (
                    <Button onClick={() => onMarcarEntregada(o.id)} variant="secondary" size="sm" className="flex-1" leftIcon={<FaCheckCircle size={12} />}>
                      Entregar
                    </Button>
                  )}
                  <span className="ml-auto flex gap-2">
                    {hasRole(["ADMIN"]) && !cancelada && (
                      <Button onClick={() => onAnular(o.id)} title="Anular" aria-label="Anular" variant="iconWarning" size="icon">
                        <FaBan size={12} />
                      </Button>
                    )}
                    {hasRole(["ADMIN"]) && (
                      <Button onClick={() => onEliminar(o.id)} title="Eliminar" aria-label="Eliminar" variant="iconDanger" size="icon">
                        <FaTrashAlt size={12} />
                      </Button>
                    )}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 transition-all">
        <table className="min-w-full bg-white dark:bg-gray-900 text-sm transition-colors">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-4 py-2 text-left whitespace-nowrap">{et.orden}</th>
              <th className="px-4 py-2 text-left whitespace-nowrap">{et.cliente}</th>
              <th className="px-4 py-2 text-left whitespace-nowrap">Estado</th>
              <th className="px-4 py-2 text-left whitespace-nowrap">Balance</th>
              <th className="px-4 py-2 text-left whitespace-nowrap">Ingreso</th>
              {conEntrega && (
                <th className="px-4 py-2 text-left whitespace-nowrap">Entrega</th>
              )}
              <th className="px-4 py-2 text-left whitespace-nowrap">Total</th>
              <th className="px-4 py-2 text-left whitespace-nowrap">
                Observaciones
              </th>
              <th className="px-4 py-2 text-right whitespace-nowrap">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenes.length === 0 ? (
              <tr>
                <td
                  colSpan={conEntrega ? 9 : 8}
                  className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic bg-white dark:bg-gray-900 transition-colors"
                >
                  {`No se encontraron ${et.ordenesMin} registradas.`}
                </td>
              </tr>
            ) : (
              ordenes.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-150 text-gray-700 dark:text-gray-300"
                >
                  <td className="px-4 py-3 font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                    #{o.id}
                  </td>
                  <td className="px-4 py-3">
                    {nombreCliente(o.cliente)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      {badgeEstado(o.estado)}
                      {o.estado !== "CANCELADO" && badgePago(o.estadoPago)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs space-y-0.5 whitespace-nowrap">
                    {o.estado === "CANCELADO" ? (
                      <div className="text-gray-500 dark:text-gray-400 font-semibold">
                        Anulada
                      </div>
                    ) : o.faltante === 0 ? (
                      <div className="text-green-600 dark:text-green-400 font-semibold">
                        Total pagado
                      </div>
                    ) : (
                      <>
                        <div className="text-gray-600 dark:text-gray-400">
                          Abonado:
                          <span className="font-semibold ml-1">
                            {formatearMoneda(o.abonado ?? 0, principalSeguro)}
                          </span>
                        </div>
                        <div className="text-red-600 dark:text-red-400">
                          Falta:
                          <span className="font-semibold ml-1">
                            {formatearMoneda(o.faltante ?? 0, principalSeguro)}
                          </span>
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {dayjs(o.fechaIngreso).format("DD/MM/YYYY")}
                  </td>
                  {conEntrega && (
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {o.fechaEntrega ? (
                        dayjs(o.fechaEntrega).format("DD/MM/YYYY")
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-indigo-700 dark:text-indigo-400 font-extrabold whitespace-nowrap">
                    {formatearMoneda(o.total ?? 0, principalSeguro)}
                  </td>
                  <td
                    className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[120px] truncate"
                    title={o.observaciones ?? undefined}
                  >
                    {o.observaciones ?? (
                      <span className="text-gray-400 dark:text-gray-600 italic">
                        Sin observaciones
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        onClick={() => onVerDetalles(o)}
                        title={`Ver detalles de ${et.ordenMin === "orden" ? "la orden" : `la ${et.ordenMin}`}`}
                        variant="iconInfo"
                        size="icon"
                      >
                        <FaSearch size={12} />
                      </Button>

                      {o.estadoPago !== "COMPLETO" &&
                        o.estado !== "ENTREGADO" &&
                        o.estado !== "CANCELADO" && (
                          <Button
                            onClick={() => onRegistrarPago(o)}
                            title="Registrar pago"
                            variant="iconWarning"
                            size="icon"
                          >
                            <FaMoneyBillWave size={12} />
                          </Button>
                        )}

                      {conEntrega && o.estado !== "ENTREGADO" && o.estado !== "CANCELADO" && (
                        <Button
                          onClick={() => onMarcarEntregada(o.id)}
                          title="Marcar como entregada"
                          variant="iconSuccess"
                          size="icon"
                        >
                          <FaCheckCircle size={12} />
                        </Button>
                      )}

                      {hasRole(["ADMIN"]) && o.estado !== "CANCELADO" && (
                        <Button
                          onClick={() => onAnular(o.id)}
                          title={`Anular ${et.ordenMin} (devuelve stock y reembolsa)`}
                          variant="iconWarning"
                          size="icon"
                        >
                          <FaBan size={12} />
                        </Button>
                      )}

                      {hasRole(["ADMIN"]) && (
                        <Button
                          onClick={() => onEliminar(o.id)}
                          title={`Eliminar ${et.ordenMin}`}
                          variant="iconDanger"
                          size="icon"
                        >
                          <FaTrashAlt size={12} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
