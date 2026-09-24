import { useState } from "react";
import { FaBoxOpen, FaPlus, FaTrashAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import type { MetodoPago, Proveedor, Servicio } from "@lavanderia/shared/types/types";
import { useConfiguracion } from "../../context/configuracionCore";
import { comprasService } from "../../services/comprasService";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

type Linea = { servicioId: number; cantidad: number; costoUnit: number };

type Props = {
  proveedor: Proveedor;
  productos: Servicio[];
  monedaPrincipal: Moneda;
  onClose: () => void;
  onGuardada: () => void;
};

export default function ModalRegistrarCompra({
  proveedor,
  productos,
  monedaPrincipal,
  onClose,
  onGuardada,
}: Props) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [servicioSel, setServicioSel] = useState<number | "">("");
  const [cantidadSel, setCantidadSel] = useState<number | "">("");
  const [costoSel, setCostoSel] = useState<number | "">("");
  const [cargando, setCargando] = useState(false);
  const { config } = useConfiguracion();
  const [pago, setPago] = useState<"TODO" | "CREDITO" | "ABONO">("TODO");
  const [abono, setAbono] = useState("");
  const [vence, setVence] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [desdeCaja, setDesdeCaja] = useState(true);

  const agregarLinea = () => {
    if (!servicioSel || !cantidadSel || cantidadSel <= 0 || costoSel === "" || costoSel < 0) {
      toast.error("Selecciona producto, cantidad y costo válidos.");
      return;
    }
    setLineas((prev) => [
      ...prev,
      { servicioId: Number(servicioSel), cantidad: Number(cantidadSel), costoUnit: Number(costoSel) },
    ]);
    setServicioSel("");
    setCantidadSel("");
    setCostoSel("");
  };

  const quitarLinea = (idx: number) => {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  };

  const total = lineas.reduce((sum, l) => sum + l.cantidad * l.costoUnit, 0);

  const nombreDe = (id: number) =>
    productos.find((p) => p.id === id)?.nombreServicio ?? `#${id}`;

  const guardar = async () => {
    if (lineas.length === 0) {
      toast.error("Agrega al menos un producto a la compra.");
      return;
    }
    setCargando(true);
    try {
      const abonoNum = parseFloat(abono.replace(",", "."));
      if (pago === "ABONO" && (isNaN(abonoNum) || abonoNum <= 0 || abonoNum >= total)) {
        toast.error("El abono debe ser mayor a 0 y menor al total.");
        setCargando(false);
        return;
      }
      const pagoInicial = pago === "TODO" ? total : pago === "CREDITO" ? 0 : abonoNum;
      await comprasService.create({
        proveedorId: proveedor.id,
        estado: "RECIBIDA",
        detalles: lineas,
        pagoInicial,
        fechaVencimiento: pago !== "TODO" && vence ? vence : null,
        metodoPago: metodo,
        desdeCaja: pagoInicial > 0 && metodo === "EFECTIVO" && !!config?.moduloCaja ? desdeCaja : false,
      });
      toast.success("Compra registrada, stock actualizado.");
      onGuardada();
    } catch (err) {
      console.error("Error al registrar compra:", err);
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Error al registrar la compra"
          : "Error al registrar la compra";
      toast.error(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="max-h-[85vh] flex flex-col overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 px-6 py-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-3">
          <FaBoxOpen className="text-xl" />
          Registrar compra — {proveedor.nombre}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">
          &times;
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-5">
        <div className="grid grid-cols-[1fr_90px_100px_auto] gap-2 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Producto
            </label>
            <select
              value={servicioSel}
              onChange={(e) => setServicioSel(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
            >
              <option value="">-- Seleccionar --</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreServicio} {p.sku ? `(${p.sku})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              value={cantidadSel}
              onChange={(e) => setCantidadSel(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Costo unit.
            </label>
            <input
              type="number"
              step="any"
              value={costoSel}
              onChange={(e) => setCostoSel(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <Button type="button" onClick={agregarLinea} variant="iconSuccess" size="icon">
            <FaPlus size={12} />
          </Button>
        </div>

        {lineas.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            No has agregado productos.
          </p>
        ) : (
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
            {lineas.map((l, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-800 dark:text-gray-200">
                  {nombreDe(l.servicioId)} × {l.cantidad} @ {formatearMoneda(l.costoUnit, monedaPrincipal)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {formatearMoneda(l.cantidad * l.costoUnit, monedaPrincipal)}
                  </span>
                  <button
                    onClick={() => quitarLinea(idx)}
                    className="text-red-500 hover:text-red-700"
                    title="Quitar"
                  >
                    <FaTrashAlt size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pago al proveedor</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                ["TODO", "Pagada"],
                ["ABONO", "Abono"],
                ["CREDITO", "A crédito"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPago(id)}
                className={`px-3 py-1.5 rounded-md border font-medium cursor-pointer ${
                  pago === id
                    ? "bg-green-600 border-green-600 text-white"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {pago === "ABONO" && (
            <input
              type="number"
              step="any"
              value={abono}
              onChange={(e) => setAbono(e.target.value)}
              placeholder={`Monto abonado (${monedaPrincipal})`}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
            />
          )}
          {pago !== "CREDITO" && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoPago)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="PAGO_MOVIL">Pago móvil</option>
              </select>
              {config?.moduloCaja && metodo === "EFECTIVO" && (
                <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={desdeCaja} onChange={(e) => setDesdeCaja(e.target.checked)} className="accent-green-600 w-4 h-4" />
                  Sale de la caja
                </label>
              )}
            </div>
          )}
          {pago !== "TODO" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Vence el (opcional)</label>
              <input
                type="date"
                value={vence}
                onChange={(e) => setVence(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-800">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Total compra</span>
          <span className="text-lg font-bold text-green-700 dark:text-green-400">
            {formatearMoneda(total, monedaPrincipal)}
          </span>
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
        <Button type="button" onClick={onClose} variant="secondary" disabled={cargando}>
          Cancelar
        </Button>
        <Button onClick={guardar} variant="whatsapp" isLoading={cargando}>
          Registrar y sumar stock
        </Button>
      </div>
    </Modal>
  );
}
