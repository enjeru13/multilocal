import { useState } from "react";
import { FaBoxOpen, FaPlus, FaTrashAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import type { MetodoPago, Proveedor, Servicio } from "@lavanderia/shared/types/types";
import { useConfiguracion } from "../../context/configuracionCore";
import { comprasService } from "../../services/comprasService";
import { formatearMoneda, parsearMonto, type Moneda } from "../../utils/monedaHelpers";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import CampoMonto, { CampoMontoNumero } from "../ui/CampoMonto";
import { Campo, Seccion, Segmentado, ModalEncabezado, ModalPie, Opcion, campo } from "../ui/Formulario";

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
      const abonoNum = abono === "" ? NaN : parsearMonto(abono, monedaPrincipal);
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

  const restante = pago === "ABONO" ? Math.max(0, total - (parsearMonto(abono, monedaPrincipal) || 0)) : pago === "CREDITO" ? total : 0;

  return (
    <Modal open onClose={onClose} maxWidth="max-w-xl" className="max-h-[92vh] flex flex-col overflow-hidden">
      <ModalEncabezado icono={<FaBoxOpen />} titulo="Registrar compra" subtitulo={`Proveedor: ${proveedor.nombre}`} onClose={onClose} />

      <div className="px-6 py-5 flex-1 overflow-y-auto space-y-6">
        <Seccion titulo="Productos comprados">
          <div className="grid grid-cols-[1fr_84px_100px_auto] gap-2 items-end">
            <Campo etiqueta="Producto">
              <select value={servicioSel} onChange={(e) => setServicioSel(e.target.value ? Number(e.target.value) : "")} className={campo}>
                <option value="">Elegir…</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombreServicio} {p.sku ? `(${p.sku})` : ""}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Cantidad">
              <input type="number" value={cantidadSel} onChange={(e) => setCantidadSel(e.target.value ? Number(e.target.value) : "")} className={`${campo} text-right tabular-nums`} />
            </Campo>
            <Campo etiqueta="Costo unit.">
              <CampoMontoNumero moneda={monedaPrincipal} valor={costoSel === "" ? null : costoSel} onValor={(n) => setCostoSel(n ?? "")} className={`${campo} text-right tabular-nums`} placeholder="0.00" />
            </Campo>
            <Button type="button" onClick={agregarLinea} variant="iconSuccess" size="icon" title="Agregar a la compra">
              <FaPlus size={12} />
            </Button>
          </div>

          {lineas.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">Agrega los productos que llegaron.</p>
          ) : (
            <ul className="border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
              {lineas.map((l, idx) => (
                <li key={idx} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900 dark:text-gray-100 truncate">{nombreDe(l.servicioId)}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {l.cantidad} × {formatearMoneda(l.costoUnit, monedaPrincipal)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">{formatearMoneda(l.cantidad * l.costoUnit, monedaPrincipal)}</span>
                    <button onClick={() => quitarLinea(idx)} className="text-gray-400 hover:text-red-600 cursor-pointer" title="Quitar" aria-label="Quitar">
                      <FaTrashAlt size={12} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        <Seccion titulo="Pago al proveedor">
          <Segmentado
            ariaLabel="Forma de pago"
            valor={pago}
            onChange={setPago}
            opciones={[
              { id: "TODO", label: "Pagada" },
              { id: "ABONO", label: "Abono" },
              { id: "CREDITO", label: "A crédito" },
            ]}
          />
          {pago === "ABONO" && (
            <Campo etiqueta={`Monto abonado (${monedaPrincipal})`}>
              <CampoMonto moneda={monedaPrincipal} value={abono} onValue={setAbono} className={`${campo} text-right tabular-nums`} placeholder="0.00" />
            </Campo>
          )}
          {pago !== "CREDITO" && (
            <div className="space-y-2">
              <Campo etiqueta="Método de pago">
                <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} className={campo}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="PAGO_MOVIL">Pago móvil</option>
                </select>
              </Campo>
              {config?.moduloCaja && metodo === "EFECTIVO" && <Opcion activo={desdeCaja} onChange={setDesdeCaja} titulo="Sale de la caja" detalle="Se registra como egreso en la caja abierta." />}
            </div>
          )}
          {pago !== "TODO" && (
            <Campo etiqueta="Vence el" opcional>
              <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className={campo} />
            </Campo>
          )}
        </Seccion>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total de la compra</p>
            {restante > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Quedará por pagar {formatearMoneda(restante, monedaPrincipal)}</p>}
          </div>
          <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatearMoneda(total, monedaPrincipal)}</span>
        </div>
      </div>

      <ModalPie>
        <Button type="button" onClick={onClose} variant="secondary" disabled={cargando}>
          Cancelar
        </Button>
        <Button onClick={guardar} variant="primary" isLoading={cargando}>
          Registrar y sumar stock
        </Button>
      </ModalPie>
    </Modal>
  );
}
