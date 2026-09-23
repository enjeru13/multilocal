import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaUndoAlt } from "react-icons/fa";
import type { MetodoPago, Moneda, Orden } from "@lavanderia/shared/types/types";
import { agregarLineas, r2, valorDevolucion } from "@lavanderia/shared/utils/totales";
import { ordenesService } from "../../services/ordenesService";
import { convertirDesdePrincipal, formatearMoneda, type TasasConversion } from "../../utils/monedaHelpers";
import { useEtiquetas } from "../../context/configuracionCore";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

interface Props {
  orden: Orden;
  monedaPrincipal: Moneda;
  tasas: TasasConversion;
  onClose: () => void;
  onDevuelto: (orden: Orden) => void;
}

const input =
  "px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm";

export default function ModalDevolucion({ orden, monedaPrincipal, tasas, onClose, onDevuelto }: Props) {
  const et = useEtiquetas();
  const detalles = useMemo(() => orden.detalles ?? [], [orden.detalles]);
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [motivo, setMotivo] = useState("");
  const [reembolsar, setReembolsar] = useState(true);
  const [monedaReembolso, setMonedaReembolso] = useState<Moneda>(monedaPrincipal);
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [guardando, setGuardando] = useState(false);

  const disponible = (d: (typeof detalles)[number]) => r2(d.cantidad - d.cantidadDevuelta);

  const seleccion = detalles
    .map((d) => {
      const n = parseFloat((cantidades[d.id] ?? "").replace(",", "."));
      return { d, cantidad: isNaN(n) ? 0 : n };
    })
    .filter((x) => x.cantidad > 0);

  const invalida = seleccion.some((x) => x.cantidad > disponible(x.d) + 1e-9);

  const calculo = useMemo(() => {
    const valores = seleccion.map((x) => valorDevolucion(x.d, x.cantidad));
    const totalDevuelto = r2(valores.reduce((s, v) => s + v.total, 0));
    const nuevas = detalles.map((d) => ({
      ...d,
      cantidadDevuelta: d.cantidadDevuelta + (seleccion.find((x) => x.d.id === d.id)?.cantidad ?? 0),
    }));
    const nuevoTotal = agregarLineas(nuevas).total;
    const excedente = reembolsar ? r2(Math.max(0, orden.abonado - nuevoTotal)) : 0;
    return { totalDevuelto, nuevoTotal, excedente };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidades, detalles, reembolsar, orden.abonado]);

  const reembolsoEnMoneda = convertirDesdePrincipal(calculo.excedente, monedaReembolso, tasas, monedaPrincipal);
  const faltaTasa = calculo.excedente > 0 && monedaReembolso !== monedaPrincipal && reembolsoEnMoneda === 0;

  const confirmar = async () => {
    if (seleccion.length === 0) return toast.error(`Elige qué ${et.servicioMin} devolver.`);
    if (invalida) return toast.error("Hay cantidades mayores a las vendidas.");
    setGuardando(true);
    try {
      const res = await ordenesService.devolver(orden.id, {
        items: seleccion.map((x) => ({ detalleId: x.d.id, cantidad: x.cantidad })),
        motivo: motivo.trim() || null,
        reembolsar,
        moneda: monedaReembolso,
        metodoPago: metodo,
      });
      toast.success("Devolución registrada.");
      onDevuelto(res.data);
      onClose();
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo registrar la devolución." : "No se pudo registrar la devolución.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-2xl" className="p-6 space-y-5 overflow-auto max-h-[90vh]">
      <h2 className="text-2xl font-extrabold text-amber-600 dark:text-amber-500 flex items-center gap-3">
        <FaUndoAlt /> Devolver artículos · #{orden.id}
      </h2>

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left">{et.servicio}</th>
              <th className="px-3 py-2 text-right">Vendido</th>
              <th className="px-3 py-2 text-right">Ya devuelto</th>
              <th className="px-3 py-2 text-right w-28">Devolver</th>
            </tr>
          </thead>
          <tbody>
            {detalles.map((d) => {
              const max = disponible(d);
              return (
                <tr key={d.id} className="border-t border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200">
                  <td className="px-3 py-2">{d.servicio?.nombreServicio ?? `${et.servicio} #${d.servicioId}`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.cantidad}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{d.cantidadDevuelta || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {max > 0 ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={0}
                          max={max}
                          step={d.servicio?.permiteDecimales ? "any" : 1}
                          value={cantidades[d.id] ?? ""}
                          onChange={(e) => setCantidades((c) => ({ ...c, [d.id]: e.target.value }))}
                          placeholder="0"
                          aria-label={`Cantidad a devolver de ${d.servicio?.nombreServicio ?? d.servicioId}`}
                          className={`${input} w-20 text-right`}
                        />
                        <button
                          type="button"
                          title="Devolver todo lo restante"
                          onClick={() => setCantidades((c) => ({ ...c, [d.id]: String(max) }))}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          todo
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">completo</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Motivo (opcional)</label>
        <input className={`${input} w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej. defectuoso, se equivocó de talla…" />
      </div>

      <div className="rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Valor devuelto (con impuesto y descuento)</span>
          <strong className="tabular-nums text-gray-900 dark:text-gray-100">{formatearMoneda(calculo.totalDevuelto, monedaPrincipal)}</strong>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Nuevo total de la {et.ordenMin}</span>
          <strong className="tabular-nums text-gray-900 dark:text-gray-100">{formatearMoneda(calculo.nuevoTotal, monedaPrincipal)}</strong>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Ya pagado</span>
          <strong className="tabular-nums text-gray-900 dark:text-gray-100">{formatearMoneda(orden.abonado, monedaPrincipal)}</strong>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pt-1">
          <input type="checkbox" checked={reembolsar} onChange={(e) => setReembolsar(e.target.checked)} className="accent-blue-600 w-4 h-4" />
          Devolver el dinero al {et.clienteMin} si pagó de más
        </label>

        {reembolsar && calculo.excedente > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-amber-700 dark:text-amber-400 font-semibold">
              A reembolsar: {formatearMoneda(calculo.excedente, monedaPrincipal)}
            </span>
            <select value={monedaReembolso} onChange={(e) => setMonedaReembolso(e.target.value as Moneda)} className={input}>
              {(["USD", "VES", "COP"] as Moneda[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} className={input}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="PAGO_MOVIL">Pago móvil</option>
            </select>
            {monedaReembolso !== monedaPrincipal && !faltaTasa && (
              <span className="text-gray-500 dark:text-gray-400">= {formatearMoneda(reembolsoEnMoneda, monedaReembolso)}</span>
            )}
            {faltaTasa && <span className="text-red-600">No hay tasa configurada para {monedaReembolso}.</span>}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="edit" onClick={confirmar} isLoading={guardando} disabled={seleccion.length === 0 || invalida || faltaTasa}>
          Registrar devolución
        </Button>
      </div>
    </Modal>
  );
}
