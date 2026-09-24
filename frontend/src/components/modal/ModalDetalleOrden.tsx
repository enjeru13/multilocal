import { useEffect, useState, useMemo, useCallback } from "react";
import { useMonedas } from "../../context/useMonedas";
import { useNavigate } from "react-router-dom";
import { ordenesService } from "../../services/ordenesService";
import { configuracionService } from "../../services/configuracionService";
import { pagosService } from "../../services/pagosService";
import { FiX } from "react-icons/fi";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { FaEdit, FaCheck, FaTimes, FaPencilAlt, FaUndoAlt, FaReceipt, FaEllipsisH, FaMoneyBillWave } from "react-icons/fa";
import {
  formatearMoneda,
  normalizarMoneda,
  type Moneda,
  type TasasConversion,
} from "../../utils/monedaHelpers";
import { badgeEstado, badgePago } from "../../utils/badgeHelpers";
import { toast } from "react-toastify";
import { calcularResumenPago, calcularTotalAbonado } from "@lavanderia/shared/utils/pagoFinance";
import type {
  Orden,
  Configuracion,
  ReciboData,
  Pago,
  Devolucion,
} from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import ModalReciboEntrega from "./ModalReciboEntrega";
import dayjs from "dayjs";
import { generarEnlaceWhatsApp } from "../../utils/whatsappHelpers";
import { reciboDeOrden } from "../../utils/reciboData";
import { FaWhatsapp } from "react-icons/fa";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import ModalDevolucion from "./ModalDevolucion";
import ResumenCobro from "../ui/ResumenCobro";
import { nombreCliente } from "../../utils/clienteHelpers";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";

const METODO_TEXTO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", PAGO_MOVIL: "Pago móvil" };

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
  const { config: perfil } = useConfiguracion();
  const negocio = useMonedas();
  const et = useEtiquetas();
  const conEntrega = perfil?.moduloFechaEntrega !== false;
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

  const { hasRole, user } = useAuth();
  const [verDevolucion, setVerDevolucion] = useState(false);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>(orden.devoluciones ?? []);

  // La lista no trae el historial de devoluciones: se pide al abrir el detalle.
  useEffect(() => {
    ordenesService
      .getById(orden.id)
      .then((res) => setDevoluciones(res.data.devoluciones ?? []))
      .catch(() => {});
  }, [orden.id]);

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
    const nombreNegocio = configuracion?.nombreNegocio || "Mi negocio";
    const link = generarEnlaceWhatsApp(orden, nombreNegocio, tasas, { principal: negocio.principal, otras: negocio.otrasUsables });

    if (link) {
      window.open(link, "_blank");
    } else {
      toast.warning("El cliente no tiene un teléfono válido registrado.");
    }
  };

  const generarDatosRecibo = (): ReciboData =>
    reciboDeOrden(orden, configuracion ?? null, {
      atendio: user?.name ?? user?.email ?? null,
      abonado: resumen.abonado,
      observaciones: observacionesEditadas,
    });

  const isObservacionesDisabled = !hasRole(["ADMIN"]) || guardandoObservaciones;

  const saldado = resumen.faltante <= 0.005;
  const cancelada = orden.estado === "CANCELADO";
  const quedanPorDevolver = orden.detalles?.some((d) => d.cantidad - d.cantidadDevuelta > 1e-9) ?? false;
  // Devolver artículos tiene sentido donde se vende al momento (caja, mostrador); una lavandería anula la orden.
  const permiteDevolver =
    hasRole(["ADMIN", "EMPLOYEE"]) && !cancelada && quedanPorDevolver && perfil?.moduloFechaEntrega === false;
  const puedeEntregar = conEntrega && orden.estado !== "ENTREGADO" && !cancelada;
  const puedeMarcarLista = conEntrega && orden.estado === "PENDIENTE";
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const cambiarEstado = async (estado: "LISTO" | "ENTREGADO") => {
    setCambiandoEstado(true);
    try {
      const res = await ordenesService.update(orden.id, { estado });
      toast.success(estado === "LISTO" ? "Marcada como lista para entregar." : "Marcada como entregada.");
      onPagoRegistrado(res.data);
    } catch {
      toast.error("No se pudo actualizar el estado.");
    } finally {
      setCambiandoEstado(false);
    }
  };

  const filaMeta = (etiqueta: string, valor: React.ReactNode) => (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">{valor}</dd>
    </div>
  );

  const titulo = (texto: string, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{texto}</h3>
      {extra}
    </div>
  );

  const lineaDesglose = (etiqueta: string, valor: string, clase = "text-gray-700 dark:text-gray-300") => (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{etiqueta}</span>
      <span className={`tabular-nums ${clase}`}>{valor}</span>
    </div>
  );

  const hayDesglose = orden.descuento > 0 || orden.impuesto > 0 || orden.devuelto > 0;

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-2xl"
      className="max-h-[92dvh] flex flex-col overflow-hidden"
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {et.orden} <span className="text-gray-400 font-medium">#{orden.id}</span>
            </h2>
            {badgeEstado(orden.estado)}
            {!cancelada && badgePago(resumen.estadoRaw)}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
            {nombreCliente(orden.cliente)}
            {orden.cliente?.telefono && <span className="text-gray-400"> · {orden.cliente.telefono}</span>}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer" title="Cerrar" aria-label="Cerrar">
          <FiX size={20} />
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          {filaMeta("Ingreso", dayjs(orden.fechaIngreso).format("DD/MM/YYYY"))}
          {conEntrega && filaMeta("Entrega estimada", orden.fechaEntrega ? dayjs(orden.fechaEntrega).format("DD/MM/YYYY") : "Sin definir")}
          {orden.estado === "ENTREGADO" && orden.deliveredBy && filaMeta("Entregado por", orden.deliveredBy.name || orden.deliveredBy.email)}
        </dl>

        {/* Artículos */}
        <section>
          {titulo(et.servicios)}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-2.5 text-left">{et.servicio}</th>
                  <th className="px-4 py-2.5 text-center">Cant.</th>
                  <th className="px-4 py-2.5 text-right">Precio</th>
                  <th className="px-4 py-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orden.detalles?.map((d) => (
                  <tr key={d.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{d.servicio?.nombreServicio ?? `${et.servicio} no disponible`}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-700 dark:text-gray-300">
                      {d.cantidad}
                      {d.cantidadDevuelta > 0 && <span className="block text-[11px] text-amber-600 dark:text-amber-400">{d.cantidadDevuelta} devuelto(s)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatearMoneda(d.precioUnit, principalSeguro)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatearMoneda(d.subtotal, principalSeguro)}</td>
                  </tr>
                )) ?? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-gray-500 italic">{`No hay ${et.serviciosMin} asociados.`}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cuenta */}
        <section className="space-y-3">
          {titulo("Cuenta")}
          {hayDesglose && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 space-y-1.5">
              {lineaDesglose("Subtotal", formatearMoneda(orden.subtotal, principalSeguro))}
              {orden.descuento > 0 && lineaDesglose("Descuento", `− ${formatearMoneda(orden.descuento, principalSeguro)}`, "text-emerald-600 dark:text-emerald-400")}
              {orden.impuesto > 0 &&
                lineaDesglose(
                  `${configuracion?.impuestoNombre || "IVA"}${orden.impuestoTasa ? ` (${orden.impuestoTasa}%)` : ""}${configuracion?.preciosIncluyenImpuesto ?? true ? " incluido" : ""}`,
                  formatearMoneda(orden.impuesto, principalSeguro)
                )}
              {orden.devuelto > 0 && lineaDesglose("Ya devuelto", formatearMoneda(orden.devuelto, principalSeguro), "text-amber-600 dark:text-amber-400")}
            </div>
          )}
          {!cancelada && <ResumenCobro total={orden.total} abonado={resumen.abonado} saldo={resumen.faltante} moneda={principalSeguro} />}
        </section>

        {/* Pagos */}
        {(orden.pagos?.length ?? 0) > 0 && (
          <section>
            {titulo("Pagos")}
            <ul className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {orden.pagos?.map((p) => {
                const reembolso = p.monto < 0;
                const enPrincipal = calcularTotalAbonado([p], tasas, principalSeguro);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      {editingPagoId === p.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={editDateValue}
                            onChange={(e) => setEditDateValue(e.target.value)}
                            disabled={guardandoFechaPago}
                            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-100"
                          />
                          <button onClick={() => handleSaveFechaPago(p.id)} disabled={guardandoFechaPago} className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer" title="Guardar">
                            <FaCheck size={11} />
                          </button>
                          <button onClick={handleCancelEditPago} disabled={guardandoFechaPago} className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 disabled:opacity-50 cursor-pointer" title="Cancelar">
                            <FaTimes size={11} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                          {dayjs(p.fechaPago).format("DD/MM/YYYY")}
                          {hasRole(["ADMIN"]) && (
                            <button onClick={() => handleEditPagoClick(p)} className="text-gray-400 hover:text-blue-600 cursor-pointer" title="Editar fecha" aria-label="Editar fecha del pago">
                              <FaEdit size={11} />
                            </button>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {reembolso ? "Reembolso" : METODO_TEXTO[p.metodoPago] ?? p.metodoPago}
                        {p.moneda !== principalSeguro && p.tasa && p.tasa > 1 && <span> · tasa {Number(p.tasa).toFixed(2)}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold tabular-nums ${reembolso ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>{formatearMoneda(p.monto, p.moneda)}</p>
                      {p.moneda !== principalSeguro && <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">≈ {formatearMoneda(enPrincipal, principalSeguro)}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {devoluciones.length > 0 && (
          <section>
            {titulo("Devoluciones")}
            <ul className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {devoluciones.map((dv) => (
                <li key={dv.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {dayjs(dv.fecha).format("DD/MM/YYYY HH:mm")}
                    {dv.motivo && <span className="text-gray-500 dark:text-gray-400"> · {dv.motivo}</span>}
                  </span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatearMoneda(dv.total, principalSeguro)}
                    {dv.reembolso > 0 && <span className="font-normal text-gray-500 dark:text-gray-400"> (reembolsado {formatearMoneda(dv.reembolso, principalSeguro)})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Notas */}
        <section>
          {titulo(
            "Notas",
            hasRole(["ADMIN"]) && observacionesEditadas.trim() !== (orden.observaciones ?? "").trim() ? (
              <Button size="sm" variant="primary" onClick={guardarObservaciones} isLoading={guardandoObservaciones}>
                Guardar nota
              </Button>
            ) : undefined
          )}
          <textarea
            value={observacionesEditadas}
            onChange={(e) => setObservacionesEditadas(e.target.value)}
            placeholder={hasRole(["ADMIN"]) ? "Escribe una nota interna…" : "Sin notas"}
            disabled={isObservacionesDisabled}
            rows={2}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-80 resize-y"
          />
        </section>
      </div>

      {/* Acciones: a la izquierda lo de consulta, a la derecha lo que hace avanzar la orden */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/30">
        <Button size="sm" variant="ghost" onClick={() => setVerModalRecibo(true)} leftIcon={<FaReceipt />} disabled={cargandoConfiguracion}>
          Recibo
        </Button>
        {orden.cliente?.telefono && orden.estado !== "ENTREGADO" && !cancelada && (
          <Button size="sm" variant="ghost" onClick={handleWhatsAppClick} leftIcon={<FaWhatsapp />}>
            Avisar
          </Button>
        )}
        {hasRole(["ADMIN", "EMPLOYEE"]) && orden.estado !== "ENTREGADO" && !cancelada && (
          <Button size="sm" variant="ghost" onClick={handleIrAEditar} leftIcon={<FaPencilAlt />}>
            Editar
          </Button>
        )}
        {permiteDevolver && (
          <Menu as="div" className="relative">
            <MenuButton className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label="Más acciones" title="Más acciones">
              <FaEllipsisH />
            </MenuButton>
            <MenuItems anchor="top start" className="z-60 mb-2 w-52 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1 focus:outline-none">
              <MenuItem>
                <button type="button" onClick={() => setVerDevolucion(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 data-focus:bg-gray-100 dark:data-focus:bg-gray-800 cursor-pointer">
                  <FaUndoAlt className="text-gray-400" /> Devolver artículos
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {puedeMarcarLista && (
            <Button size="sm" variant="secondary" onClick={() => cambiarEstado("LISTO")} isLoading={cambiandoEstado}>
              Marcar lista
            </Button>
          )}
          {puedeEntregar && (
            <Button size="sm" variant={saldado ? "primary" : "secondary"} onClick={() => cambiarEstado("ENTREGADO")} isLoading={cambiandoEstado}>
              Entregar
            </Button>
          )}
          {!saldado && !cancelada && (
            <Button size="sm" variant="primary" onClick={() => onAbrirPagoExtra(orden)} leftIcon={<FaMoneyBillWave />}>
              Cobrar {formatearMoneda(resumen.faltante, principalSeguro)}
            </Button>
          )}
        </div>
      </div>

      {verDevolucion && (
        <ModalDevolucion
          orden={orden}
          monedaPrincipal={principalSeguro}
          tasas={tasas}
          onClose={() => setVerDevolucion(false)}
          onDevuelto={(actualizada) => {
            setDevoluciones(actualizada.devoluciones ?? []);
            onPagoRegistrado(actualizada);
          }}
        />
      )}

      {verModalRecibo && configuracion && (
        <ModalReciboEntrega visible={true} onClose={() => setVerModalRecibo(false)} datosRecibo={generarDatosRecibo()} />
      )}
    </Modal>
  );
}
