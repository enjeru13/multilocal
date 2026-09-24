import { useState, useMemo, useEffect, useCallback } from "react";
import { FiX, FiPlus } from "react-icons/fi";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { MdOutlinePayments } from "react-icons/md";
import { toast } from "react-toastify";
import { pagosService } from "../../services/pagosService";
import { ordenesService } from "../../services/ordenesService";
import {
  convertirDesdePrincipal,
  convertirAmonedaPrincipal,
  normalizarMoneda,
  formatearMoneda,
  parsearMonto,
  type Moneda,
  type TasasConversion,
} from "../../utils/monedaHelpers";
import { calcularResumenPago } from "@lavanderia/shared/utils/pagoFinance";
import type { Orden, MetodoPago } from "@lavanderia/shared/types/types";

type PagoInput = {
  monto: string;
  moneda: Moneda;
  metodo: "Efectivo" | "Transferencia" | "Pago móvil";
};

const metodoPagoMap: Record<PagoInput["metodo"], MetodoPago> = {
  Efectivo: "EFECTIVO",
  Transferencia: "TRANSFERENCIA",
  "Pago móvil": "PAGO_MOVIL",
};

interface ModalPagoProps {
  orden: Orden;
  onClose: () => void;
  onPagoRegistrado: (ordenActualizada: Orden) => void;
  tasas: TasasConversion;
  monedaPrincipal: Moneda;
}

export default function ModalPago({
  orden,
  onClose,
  onPagoRegistrado,
  tasas,
  monedaPrincipal,
}: ModalPagoProps) {
  const principalSegura: Moneda = useMemo(
    () => normalizarMoneda(monedaPrincipal),
    [monedaPrincipal]
  );
  const resumen = useMemo(
    () => calcularResumenPago(orden, tasas, principalSegura),
    [orden, tasas, principalSegura]
  );

  const [pagos, setPagos] = useState<PagoInput[]>([
    {
      monto: "0",
      moneda: "USD" as Moneda,
      metodo: "Efectivo" as PagoInput["metodo"],
    },
  ]);
  const [estaRegistrando, setEstaRegistrando] = useState(false);

  const totalPagosEnModalPrincipal = useMemo(() => {
    return pagos.reduce(
      (sum, p) =>
        sum +
        convertirAmonedaPrincipal(
          parsearMonto(p.monto, p.moneda),
          p.moneda,
          tasas,
          principalSegura
        ),
      0
    );
  }, [pagos, tasas, principalSegura]);

  const faltanteProyectado = useMemo(() => {
    return Math.max(resumen.faltante - totalPagosEnModalPrincipal, 0);
  }, [resumen.faltante, totalPagosEnModalPrincipal]);

  const [displayedRestanteVES, setDisplayedRestanteVES] = useState(0);
  const [displayedRestanteCOP, setDisplayedRestanteCOP] = useState(0);

  useEffect(() => {
    const initialFaltanteVES = convertirDesdePrincipal(
      resumen.faltante,
      "VES",
      tasas,
      principalSegura
    );
    const initialFaltanteCOP = convertirDesdePrincipal(
      resumen.faltante,
      "COP",
      tasas,
      principalSegura
    );
    setDisplayedRestanteVES(initialFaltanteVES);
    setDisplayedRestanteCOP(initialFaltanteCOP);
  }, [resumen.faltante, tasas, principalSegura]);

  const updateDisplayedRemaining = useCallback(() => {
    const currentFaltanteProyectado = Math.max(
      resumen.faltante - totalPagosEnModalPrincipal,
      0
    );
    setDisplayedRestanteVES(
      convertirDesdePrincipal(
        currentFaltanteProyectado,
        "VES",
        tasas,
        principalSegura
      )
    );
    setDisplayedRestanteCOP(
      convertirDesdePrincipal(
        currentFaltanteProyectado,
        "COP",
        tasas,
        principalSegura
      )
    );
  }, [resumen.faltante, totalPagosEnModalPrincipal, tasas, principalSegura]);

  const registrarPago = async () => {
    const pagosValidos = pagos.filter(
      (p) => parsearMonto(p.monto, p.moneda) > 0 && p.moneda && p.metodo
    );

    if (pagosValidos.length === 0) {
      toast.error("Ingresa al menos un pago válido.");
      return;
    }

    if (resumen.faltante <= 0) {
      toast.info("Ya está saldado.");
      onClose();
      return;
    }

    if (totalPagosEnModalPrincipal > resumen.faltante + 0.01) {
      toast.warn("El monto total de los pagos excede el faltante de la orden.");
    }

    setEstaRegistrando(true);
    try {
      for (const p of pagosValidos) {
        await pagosService.create({
          ordenId: orden.id,
          monto: parsearMonto(p.monto, p.moneda),
          moneda: p.moneda,
          metodoPago: metodoPagoMap[p.metodo],
        });
      }

      toast.success("Pagos registrados exitosamente.");

      const res = await ordenesService.getById(orden.id);
      const actualizada = res.data;

      if (actualizada) {
        onPagoRegistrado(actualizada);
      }
      onClose();
      updateDisplayedRemaining();
    } catch (err) {
      toast.error("Error al registrar el pago.");
      console.error("Error pago:", err);
    } finally {
      setEstaRegistrando(false);
    }
  };

  const actualizarPago = (
    idx: number,
    campo: keyof PagoInput,
    valor: string
  ) => {
    const nuevos = [...pagos];
    const pagoToUpdate: PagoInput = { ...nuevos[idx] };

    if (campo === "monto") {
      pagoToUpdate.monto = valor;
    } else if (campo === "moneda") {
      pagoToUpdate.moneda = valor as Moneda;
    } else if (campo === "metodo") {
      pagoToUpdate.metodo = valor as PagoInput["metodo"];
    }

    nuevos[idx] = pagoToUpdate;
    setPagos(nuevos);
  };

  const agregarPago = () => {
    const newPagos = [
      ...pagos,
      {
        monto: "0",
        moneda: "USD" as Moneda,
        metodo: "Efectivo" as PagoInput["metodo"],
      },
    ];
    setPagos(newPagos);
    const currentTotalInPrincipal = newPagos.reduce(
      (sum, p) =>
        sum +
        convertirAmonedaPrincipal(
          parsearMonto(p.monto, p.moneda),
          p.moneda,
          tasas,
          principalSegura
        ),
      0
    );
    const currentFaltanteProyectado = Math.max(
      resumen.faltante - currentTotalInPrincipal,
      0
    );
    setDisplayedRestanteVES(
      convertirDesdePrincipal(
        currentFaltanteProyectado,
        "VES",
        tasas,
        principalSegura
      )
    );
    setDisplayedRestanteCOP(
      convertirDesdePrincipal(
        currentFaltanteProyectado,
        "COP",
        tasas,
        principalSegura
      )
    );
  };

  const eliminarPago = (idx: number) => {
    const nuevaLista = pagos.filter((_, i) => i !== idx);
    setPagos(nuevaLista);
    const currentTotalInPrincipal = nuevaLista.reduce(
      (sum, p) =>
        sum +
        convertirAmonedaPrincipal(
          parsearMonto(p.monto, p.moneda),
          p.moneda,
          tasas,
          principalSegura
        ),
      0
    );
    const currentFaltanteProyectado = Math.max(
      resumen.faltante - currentTotalInPrincipal,
      0
    );
    setDisplayedRestanteVES(
      convertirDesdePrincipal(
        currentFaltanteProyectado,
        "VES",
        tasas,
        principalSegura
      )
    );
    setDisplayedRestanteCOP(
      convertirDesdePrincipal(
        currentFaltanteProyectado,
        "COP",
        tasas,
        principalSegura
      )
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-xl md:max-w-2xl"
      className="max-h-[90vh] overflow-hidden flex flex-col"
    >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <MdOutlinePayments className="text-2xl sm:text-3xl" />
            Registrar pago
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-3xl font-bold transition-transform transform hover:rotate-90 cursor-pointer"
            title="Cerrar"
          >
            <FiX />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6 text-base text-gray-800 dark:text-gray-200">
          {pagos.map((p, idx) => (
            <div
              key={idx}
              className="border border-gray-300 dark:border-gray-700 rounded-xl p-5 bg-gray-50 dark:bg-gray-950 shadow-md relative space-y-4 transition-all duration-200 hover:shadow-lg"
            >
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor={`monto-${idx}`}
                    className="block text-sm text-gray-600 dark:text-gray-400 font-semibold mb-1"
                  >
                    Monto
                  </label>
                  <input
                    id={`monto-${idx}`}
                    type="text"
                    inputMode="decimal"
                    value={p.monto}
                    onChange={(e) =>
                      actualizarPago(idx, "monto", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base shadow-sm dark:text-gray-100"
                    placeholder="Ej. 20.50 (USD), 1.458,78 (VES)"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`moneda-${idx}`}
                    className="block text-sm text-gray-600 dark:text-gray-400 font-semibold mb-1"
                  >
                    Moneda
                  </label>
                  <select
                    id={`moneda-${idx}`}
                    value={p.moneda}
                    onChange={(e) =>
                      actualizarPago(idx, "moneda", e.target.value as Moneda)
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base shadow-sm dark:text-gray-100"
                  >
                    <option value="USD">USD</option>
                    <option value="VES">VES</option>
                    <option value="COP">COP</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`metodo-${idx}`}
                    className="block text-sm text-gray-600 dark:text-gray-400 font-semibold mb-1"
                  >
                    Método
                  </label>
                  <select
                    id={`metodo-${idx}`}
                    value={p.metodo}
                    onChange={(e) =>
                      actualizarPago(
                        idx,
                        "metodo",
                        e.target.value as PagoInput["metodo"]
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base shadow-sm dark:text-gray-100"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Pago móvil">Pago móvil</option>
                  </select>
                </div>
              </div>

              {pagos.length > 1 && (
                <button
                  onClick={() => eliminarPago(idx)}
                  className="absolute top-3 right-3 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xl transition-transform transform hover:scale-110 cursor-pointer"
                  title="Eliminar pago"
                >
                  <FiX />
                </button>
              )}
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button
              onClick={agregarPago}
              variant="outline"
              leftIcon={<FiPlus className="text-base" />}
              className="border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40"
            >
              Agregar otro pago
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="p-4 bg-blue-50 rounded-lg shadow-sm flex flex-col justify-between">
              <span className="text-sm text-blue-800 font-semibold mb-1">
                Total:
              </span>
              <span className="block text-blue-900 font-bold text-xl">
                {formatearMoneda(orden.total, principalSegura)}
              </span>
            </div>
            <div className="p-4 bg-green-50 rounded-lg shadow-sm flex flex-col justify-between">
              <span className="text-sm text-green-800 font-semibold mb-1">
                Total Abonado:
              </span>
              <span className="block text-green-900 font-bold text-xl">
                {formatearMoneda(resumen.abonado, principalSegura)}
              </span>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg shadow-sm flex flex-col justify-between">
              <span className="text-sm text-purple-800 font-semibold mb-1">
                Monto a abonar (este modal):
              </span>
              <span className="block text-purple-900 font-bold text-xl">
                {formatearMoneda(totalPagosEnModalPrincipal, principalSegura)}
              </span>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 p-4 bg-red-50 rounded-lg shadow-sm flex flex-col justify-between">
              <span className="text-sm text-red-800 font-semibold mb-1">
                Faltante proyectado:
              </span>
              <span className="block text-red-900 font-bold text-2xl">
                {formatearMoneda(faltanteProyectado, principalSegura)}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-inner ring-1 ring-gray-100 dark:ring-gray-900/50 space-y-3 mt-6">
            <p className="font-bold text-gray-800 dark:text-gray-100 text-lg">
              Faltante proyectado en otras monedas:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-sm text-gray-700 dark:text-gray-400">Bolívares (VES):</span>
                <span className="block text-red-700 dark:text-red-400 font-bold text-lg">
                  {formatearMoneda(displayedRestanteVES, "VES")}
                </span>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-sm text-gray-700 dark:text-gray-400">Pesos (COP):</span>
                <span className="block text-red-700 dark:text-red-400 font-bold text-lg">
                  {formatearMoneda(displayedRestanteCOP, "COP")}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-500 italic">
              Estos valores se actualizan al agregar/eliminar pagos.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-4 font-medium border-t border-gray-200 dark:border-gray-800">
          <Button onClick={onClose} variant="secondary">
            Salir
          </Button>

          <Button
            onClick={registrarPago}
            disabled={
              totalPagosEnModalPrincipal <= 0 ||
              faltanteProyectado === resumen.faltante ||
              estaRegistrando
            }
            isLoading={estaRegistrando}
            variant="whatsapp"
          >
            Guardar pagos
          </Button>
        </div>
    </Modal>
  );
}
