import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ordenesService } from "../../services/ordenesService";
import { configuracionService } from "../../services/configuracionService";
import { pagosService } from "../../services/pagosService";
import { FiX } from "react-icons/fi";
import { BiMessageSquareDetail } from "react-icons/bi";
import { FaEdit, FaCheck, FaTimes, FaPencilAlt } from "react-icons/fa";
import {
  formatearMoneda,
  normalizarMoneda,
  type Moneda,
  type TasasConversion,
} from "../../utils/monedaHelpers";
import { badgeEstado } from "../../utils/badgeHelpers";
import { toast } from "react-toastify";
import { calcularResumenPago } from "@lavanderia/shared/utils/pagoFinance";
import type {
  Orden,
  Configuracion,
  ReciboData,
  Pago,
} from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import ModalReciboEntrega from "./ModalReciboEntrega";
import dayjs from "dayjs";
import { generarEnlaceWhatsApp } from "../../utils/whatsappHelpers";
import { FaWhatsapp } from "react-icons/fa";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

interface Props {
  orden: Orden;
  onClose: () => void;
  onPagoRegistrado: (nuevaOrden: Orden) => void;
  onAbrirPagoExtra: (orden: Orden) => void;
  tasas: TasasConversion;
  monedaPrincipal: Moneda;
}

export default function ModalDetalleOrden({
  orden,
  onClose,
  tasas,
  monedaPrincipal,
  onAbrirPagoExtra,
  onPagoRegistrado,
}: Props) {
  const navigate = useNavigate();
  const [observacionesEditadas, setObservacionesEditadas] = useState(
    orden.observaciones ?? ""
  );
  const [guardandoObservaciones, setGuardandoObservaciones] = useState(false);
  const [verModalRecibo, setVerModalRecibo] = useState(false);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(
    null
  );
  const [cargandoConfiguracion, setCargandoConfiguracion] = useState(true);

  // --- ESTADOS PARA EDICIÓN DE FECHA DE PAGO ---
  const [editingPagoId, setEditingPagoId] = useState<number | null>(null);
  const [editDateValue, setEditDateValue] = useState("");
  const [guardandoFechaPago, setGuardandoFechaPago] = useState(false);

  const { hasRole } = useAuth();

  useEffect(() => {
    setCargandoConfiguracion(true);
    configuracionService
      .get()
      .then((res) => setConfiguracion(res.data))
      .catch((err) => {
        console.error("Error al cargar configuración del sistema", err);
        toast.error("Error al cargar configuración del sistema");
      })
      .finally(() => {
        setCargandoConfiguracion(false);
      });
  }, []);

  const principalSeguro: Moneda = useMemo(
    () => normalizarMoneda(monedaPrincipal),
    [monedaPrincipal]
  );

  const resumen = useMemo(
    () => calcularResumenPago(orden, tasas, principalSeguro),
    [orden, tasas, principalSeguro]
  );

  // --- FUNCIÓN DE NAVEGACIÓN A EDITAR ---
  const handleIrAEditar = () => {
    onClose(); // Cerramos el modal primero
    navigate(`/ordenes/editar/${orden.id}`); // Redirigimos a la pantalla de edición
  };

  // --- FUNCIONES PARA OBSERVACIONES ---
  const guardarObservaciones = useCallback(async () => {
    if (observacionesEditadas.trim() === (orden.observaciones ?? "").trim()) {
      toast.info("No hay cambios en las observaciones.");
      return;
    }

    if (!hasRole(["ADMIN"])) {
      toast.error("No tienes permiso para editar observaciones.");
      return;
    }

    setGuardandoObservaciones(true);
    try {
      const obsPayload =
        observacionesEditadas.trim() === ""
          ? null
          : observacionesEditadas.trim();
      await ordenesService.updateObservacion(orden.id, obsPayload);
      const res = await ordenesService.getById(orden.id);
      toast.success("Observaciones actualizadas correctamente.");
      onPagoRegistrado(res.data);
    } catch (err) {
      toast.error("Error al guardar las observaciones.");
      console.error(err);
    } finally {
      setGuardandoObservaciones(false);
    }
  }, [
    orden.id,
    orden.observaciones,
    observacionesEditadas,
    onPagoRegistrado,
    hasRole,
  ]);

  // --- FUNCIONES PARA EDICIÓN DE FECHA DE PAGO ---
  const handleEditPagoClick = (pago: Pago) => {
    setEditingPagoId(pago.id);
    setEditDateValue(dayjs(pago.fechaPago).format("YYYY-MM-DD"));
  };

  const handleCancelEditPago = () => {
    setEditingPagoId(null);
    setEditDateValue("");
  };

  const handleSaveFechaPago = async (pagoId: number) => {
    if (!editDateValue) {
      toast.error("La fecha no puede estar vacía");
      return;
    }

    setGuardandoFechaPago(true);
    try {
      const nuevaFechaISO = dayjs(editDateValue).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await pagosService.update(pagoId, { fechaPago: nuevaFechaISO } as any);

      toast.success("Fecha del pago actualizada");

      const res = await ordenesService.getById(orden.id);
      onPagoRegistrado(res.data);
      handleCancelEditPago();
    } catch (error) {
      console.error("Error actualizando fecha de pago:", error);
      toast.error("Error al actualizar la fecha.");
    } finally {
      setGuardandoFechaPago(false);
    }
  };

  const handleWhatsAppClick = () => {
    const nombreNegocio = configuracion?.nombreNegocio || "Nuestra Lavandería";
    const link = generarEnlaceWhatsApp(orden, nombreNegocio, tasas);

    if (link) {
      window.open(link, "_blank");
    } else {
      toast.warning("El cliente no tiene un teléfono válido registrado.");
    }
  };

  const generarDatosRecibo = (): ReciboData => {
    const totalCantidadPiezas =
      orden.detalles?.reduce((sum, detalle) => {
        return (
          sum + (detalle.servicio?.permiteDecimales ? 1 : detalle.cantidad)
        );
      }, 0) ?? 0;

    return {
      clienteInfo: {
        nombre: orden.cliente?.nombre ?? "",
        apellido: orden.cliente?.apellido ?? "",
        identificacion: orden.cliente?.identificacion ?? "",
        fechaIngreso: dayjs(orden.fechaIngreso).isValid()
          ? dayjs(orden.fechaIngreso).toDate()
          : new Date(),
        fechaEntrega:
          orden.fechaEntrega && dayjs(orden.fechaEntrega).isValid()
            ? dayjs(orden.fechaEntrega).toDate()
            : null,
        telefono: orden.cliente?.telefono ?? "",
        telefono_secundario: orden.cliente?.telefono_secundario ?? "",
      },
      // CORRECCIÓN AQUÍ: Se cambió precioUnit por precioUnitario para coincidir con la interfaz ReciboItem
      items:
        orden.detalles?.map((d) => ({
          descripcion:
            d.servicio?.nombreServicio ?? "Descripción no disponible",
          cantidad: d.cantidad,
          precioUnitario: d.precioUnit,
          permiteDecimales: d.servicio?.permiteDecimales ?? false,
        })) ?? [],
      abono: resumen.abonado,
      total: orden.total,
      numeroOrden: orden.id,
      observaciones:
        observacionesEditadas.trim() === ""
          ? null
          : observacionesEditadas.trim(),

      lavanderiaInfo: {
        nombre: configuracion?.nombreNegocio ?? "Lavandería sin nombre",
        rif: configuracion?.rif ?? null,
        direccion: configuracion?.direccion ?? null,
        telefonoPrincipal: configuracion?.telefonoPrincipal ?? null,
        telefonoSecundario: configuracion?.telefonoSecundario ?? null,
      },
      mensajePieRecibo:
        configuracion?.mensajePieRecibo === ""
          ? null
          : configuracion?.mensajePieRecibo ?? null,
      monedaPrincipal: principalSeguro,
      totalCantidadPiezas: totalCantidadPiezas,
    };
  };

  const isObservacionesDisabled = !hasRole(["ADMIN"]) || guardandoObservaciones;

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-2xl"
      className="relative p-6 space-y-6 text-base text-gray-800 dark:text-gray-200 overflow-auto max-h-[90vh]"
    >
        {/* HEADER */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-extrabold text-green-700 dark:text-green-500 flex items-center gap-3">
            <BiMessageSquareDetail className="text-3xl" />
            Detalle de la orden
            <span className="text-gray-500 dark:text-gray-400 font-semibold">#{orden.id}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-3xl font-bold transition-transform transform hover:rotate-90 cursor-pointer"
            title="Cerrar"
          >
            <FiX />
          </button>
        </div>

        {/* GRID DE INFO */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <p className="text-gray-700 dark:text-gray-300 font-semibold text-sm mb-2">Cliente</p>
            <div className="bg-gray-100 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100 shadow-sm">
              {orden.cliente?.nombre} {orden.cliente?.apellido}
            </div>
          </div>
          <div>
            <p className="text-gray-700 dark:text-gray-300 font-semibold text-sm mb-2">
              Estado de la entrega
            </p>
            <div className="bg-gray-100 dark:bg-gray-950 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center gap-2 shadow-sm">
              {badgeEstado(orden.estado)}
            </div>
          </div>
          <div>
            <p className="text-gray-700 dark:text-gray-300 font-semibold text-sm mb-2">
              Fecha de ingreso
            </p>
            <div className="bg-gray-100 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100 shadow-sm">
              {dayjs(orden.fechaIngreso).format("DD/MM/YYYY")}
            </div>
          </div>
          <div>
            <p className="text-gray-700 dark:text-gray-300 font-semibold text-sm mb-2">
              Fecha estimada de entrega
            </p>
            <div className="bg-gray-100 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100 shadow-sm">
              {orden.fechaEntrega
                ? dayjs(orden.fechaEntrega).format("DD/MM/YYYY")
                : "No definida"}
            </div>
          </div>
          {orden.estado === "ENTREGADO" && orden.deliveredBy && (
            <div>
              <p className="text-gray-700 dark:text-gray-300 font-semibold text-sm mb-2">
                Entregado Por
              </p>
              <div className="bg-gray-100 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100 shadow-sm">
                {orden.deliveredBy.name || orden.deliveredBy.email}
              </div>
            </div>
          )}
        </div>

        {/* TABLA SERVICIOS */}
        <div>
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-3">
            Servicios contratados
          </h3>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
            <table className="min-w-full bg-white dark:bg-gray-950 text-sm">
              <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left">Servicio</th>
                  <th className="px-4 py-3 text-center">Cantidad</th>
                  <th className="px-4 py-3 text-right">Precio Unitario</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orden.detalles?.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition duration-200 ease-in-out"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {d.servicio?.nombreServicio ?? "Servicio no disponible"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">
                      x{d.cantidad}
                    </td>
                    <td className="px-4 py-3 text-right text-indigo-700 dark:text-indigo-400 font-bold">
                      {formatearMoneda(d.precioUnit, principalSeguro)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 dark:text-green-500 font-bold">
                      {formatearMoneda(d.subtotal, principalSeguro)}
                    </td>
                  </tr>
                )) ?? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-4 text-center text-gray-500 italic"
                      >
                        No hay servicios asociados a esta orden.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGOS REALIZADOS */}
        {(orden.pagos?.length ?? 0) > 0 && (
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-3">
              Pagos realizados
            </h3>
            <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {orden.pagos?.map((p) => (
                <li
                  key={p.id}
                  className="bg-gray-100 dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm hover:bg-gray-200 dark:hover:bg-gray-900 transition duration-200 ease-in-out"
                >
                  <div className="flex justify-between items-center mb-1">
                    {/* --- SECCIÓN EDITABLE DE FECHA --- */}
                    <div className="flex items-center gap-2">
                      {editingPagoId === p.id ? (
                        <div className="flex items-center gap-1 animate-fade-in">
                          <input
                            type="date"
                            value={editDateValue}
                            onChange={(e) => setEditDateValue(e.target.value)}
                            disabled={guardandoFechaPago}
                            className="text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-800 dark:text-gray-100"
                          />
                          <button
                            onClick={() => handleSaveFechaPago(p.id)}
                            disabled={guardandoFechaPago}
                            className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                            title="Guardar"
                          >
                            <FaCheck size={12} />
                          </button>
                          <button
                            onClick={handleCancelEditPago}
                            disabled={guardandoFechaPago}
                            className="p-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                            title="Cancelar"
                          >
                            <FaTimes size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {dayjs(p.fechaPago).format("DD/MM/YYYY")}
                          </span>
                          {hasRole(["ADMIN"]) && (
                            <button
                              onClick={() => handleEditPagoClick(p)}
                              className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 ml-1 transition-colors cursor-pointer"
                              title="Editar fecha"
                            >
                              <FaEdit size={12} />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                      {formatearMoneda(p.monto, p.moneda)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                    Pago en {p.moneda} vía {p.metodoPago}
                    {p.tasa && p.tasa > 1 && p.moneda !== "USD" && (
                      <span className="ml-1 text-gray-500 dark:text-gray-500 not-italic">
                        (Tasa: {Number(p.tasa).toFixed(2)})
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* RESUMEN DE PAGOS */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-3">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-3">
            Resumen de Pagos
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm font-medium">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-sm flex justify-between items-center border border-blue-100 dark:border-blue-900/30">
              <span className="text-blue-800 dark:text-blue-300">Total Orden:</span>
              <span className="font-bold text-blue-900 dark:text-blue-100">
                {formatearMoneda(orden.total, principalSeguro)}
              </span>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg shadow-sm flex justify-between items-center border border-green-100 dark:border-green-900/30">
              <span className="text-green-800 dark:text-green-300">Total Abonado:</span>
              <span className="font-bold text-green-900 dark:text-green-100">
                {formatearMoneda(resumen.abonado, principalSeguro)}
              </span>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm flex justify-between items-center border border-red-100 dark:border-red-900/30">
              <span className="text-red-800 dark:text-red-300">Saldo Pendiente:</span>
              <span className="font-bold text-red-900 dark:text-red-100">
                {formatearMoneda(resumen.faltante, principalSeguro)}
              </span>
            </div>
          </div>
        </div>

        {/* NOTAS */}
        <div className="pt-4 space-y-3 border-t border-gray-200 dark:border-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-3">
            Notas de la orden
          </h3>
          <textarea
            value={observacionesEditadas}
            onChange={(e) => setObservacionesEditadas(e.target.value)}
            placeholder="Sin notas registradas..."
            disabled={isObservacionesDisabled}
            className="w-full min-h-[100px] px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y text-sm transition duration-200 dark:text-gray-200"
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 italic">
            Puedes agregar comentarios, aclaraciones o notas internas sobre la
            orden. Solo los administradores pueden editar.
          </p>
          <div className="flex justify-end pt-2">
            <Button
              onClick={guardarObservaciones}
              disabled={
                isObservacionesDisabled ||
                observacionesEditadas.trim() ===
                (orden.observaciones ?? "").trim()
              }
              isLoading={guardandoObservaciones}
              variant="primary"
            >
              Guardar notas
            </Button>
          </div>
        </div>

        {/* FOOTER CON BOTONES DE ACCIÓN */}
        <div className="flex flex-wrap gap-3 justify-end items-center pt-4 border-t border-gray-200 dark:border-gray-800">
          {/* BOTÓN VER RECIBO */}
          <Button
            onClick={() => setVerModalRecibo(true)}
            disabled={cargandoConfiguracion}
            variant="secondary"
          >
            Ver recibo
          </Button>

          {/* BOTÓN WHATSAPP (Solo si no está entregada) */}
          {orden.cliente?.telefono && orden.estado !== "ENTREGADO" && (
            <Button
              onClick={handleWhatsAppClick}
              variant="whatsapp"
              leftIcon={<FaWhatsapp size={20} />}
            >
              WhatsApp
            </Button>
          )}

          {/* --- BOTÓN: EDITAR ORDEN --- */}
          {hasRole(["ADMIN", "EMPLOYEE"]) && orden.estado !== "ENTREGADO" && (
            <Button
              onClick={handleIrAEditar}
              variant="secondary"
              leftIcon={<FaPencilAlt />}
            >
              Editar Orden
            </Button>
          )}

          {/* BOTÓN REGISTRAR PAGO */}
          {resumen.faltante > 0 && (
            <Button
              onClick={() => onAbrirPagoExtra(orden)}
              variant="edit"
            >
              Registrar pago
            </Button>
          )}
        </div>

        {verModalRecibo && configuracion && (
          <ModalReciboEntrega
            visible={true}
            onClose={() => setVerModalRecibo(false)}
            datosRecibo={generarDatosRecibo()}
          />
        )}
    </Modal>
  );
}
