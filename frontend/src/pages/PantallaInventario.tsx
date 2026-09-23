import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { FaExclamationTriangle, FaSearch, FaSlidersH, FaHistory } from "react-icons/fa";
import { AxiosError } from "axios";
import dayjs from "dayjs";
import { servicioService } from "../services/serviciosService";
import { configuracionService } from "../services/configuracionService";
import { formatearMoneda, type Moneda } from "../utils/monedaHelpers";
import { TableSkeleton } from "../components/Skeleton";
import { useConfiguracion } from "../context/ConfiguracionContext";
import type { Servicio } from "@lavanderia/shared/types/types";
import { inventarioService, type MovimientoInventario } from "../services/inventarioService";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";

const MOTIVO: Record<MovimientoInventario["motivo"], string> = {
  COMPRA: "Compra",
  VENTA: "Venta",
  AJUSTE_MANUAL: "Ajuste manual",
  DEVOLUCION: "Devolución",
};

export default function PantallaInventario() {
  const { t } = useConfiguracion();
  const { hasRole } = useAuth();
  const [ajustando, setAjustando] = useState<Servicio | null>(null);
  const [ajTipo, setAjTipo] = useState<"ENTRADA" | "SALIDA">("ENTRADA");
  const [ajCantidad, setAjCantidad] = useState("");
  const [ajNota, setAjNota] = useState("");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [historialDe, setHistorialDe] = useState<Servicio | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [items, setItems] = useState<Servicio[]>([]);
  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [resServ, resConfig] = await Promise.all([
        servicioService.getAll(),
        configuracionService.get(),
      ]);
      setItems(resServ.data.filter((s) => s.controlaStock));
      setMonedaPrincipal(resConfig.data.monedaPrincipal);
    } catch (error) {
      console.error("Error al cargar inventario:", error);
      toast.error("No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    return items.filter((i) => {
      const coincideBusqueda =
        i.nombreServicio.toLowerCase().includes(busqueda.toLowerCase()) ||
        (i.sku ?? "").toLowerCase().includes(busqueda.toLowerCase());
      const stockBajo = i.stockMinimo !== null && i.stockActual <= i.stockMinimo;
      return coincideBusqueda && (!soloStockBajo || stockBajo);
    });
  }, [items, busqueda, soloStockBajo]);

  const abrirHistorial = async (item: Servicio) => {
    setHistorialDe(item);
    setMovimientos([]);
    try {
      const res = await inventarioService.movimientos(item.id);
      setMovimientos(res.data);
    } catch {
      toast.error("No se pudo cargar el historial.");
    }
  };

  const guardarAjuste = async () => {
    const cantidad = parseFloat(ajCantidad.replace(",", "."));
    if (!ajustando || isNaN(cantidad) || cantidad <= 0) return toast.error("Indica una cantidad válida.");
    if (!ajNota.trim()) return toast.error("Indica el motivo del ajuste.");
    setGuardandoAjuste(true);
    try {
      await inventarioService.ajustar({ servicioId: ajustando.id, tipo: ajTipo, cantidad, nota: ajNota.trim() });
      toast.success("Stock ajustado.");
      setAjustando(null);
      setAjCantidad("");
      setAjNota("");
      cargar();
    } catch (err) {
      toast.error(
        err instanceof AxiosError ? err.response?.data?.message ?? "No se pudo ajustar." : "No se pudo ajustar."
      );
    } finally {
      setGuardandoAjuste(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Inventario</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("servicio")} con control de stock activado.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">Buscar</label>
          <div className="relative w-72">
            <FaSearch className="absolute top-2.5 left-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o SKU"
              className="pl-9 pr-3 py-2 w-full rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-950 text-sm dark:text-gray-200"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={soloStockBajo}
            onChange={(e) => setSoloStockBajo(e.target.checked)}
            className="accent-red-600 w-4 h-4 cursor-pointer"
          />
          Solo stock bajo
        </label>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No hay {t("servicio").toLowerCase()} con control de stock. Actívalo al crear o editar uno.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">Sin resultados con estos filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <table className="min-w-full bg-white dark:bg-gray-900 text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">Nombre</th>
                <th className="px-6 py-3 text-left">SKU</th>
                <th className="px-6 py-3 text-right">Stock</th>
                <th className="px-6 py-3 text-right">Mínimo</th>
                <th className="px-6 py-3 text-right">Costo</th>
                <th className="px-6 py-3 text-right">Precio venta</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => {
                const stockBajo = i.stockMinimo !== null && i.stockActual <= i.stockMinimo;
                return (
                  <tr
                    key={i.id}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <td className="px-6 py-4 font-semibold text-gray-800 dark:text-gray-100">
                      {i.nombreServicio}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {i.sku ?? <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`font-semibold ${
                          stockBajo
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-800 dark:text-gray-100"
                        }`}
                      >
                        {i.stockActual}
                      </span>
                      {stockBajo && (
                        <FaExclamationTriangle
                          className="inline ml-2 text-red-500"
                          title="Stock por debajo del mínimo"
                          size={12}
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">
                      {i.stockMinimo ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">
                      {i.costoBase !== null ? formatearMoneda(i.costoBase, monedaPrincipal) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-indigo-700 dark:text-indigo-400">
                      {formatearMoneda(i.precioBase, monedaPrincipal)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex gap-2">
                        {hasRole(["ADMIN"]) && (
                          <Button
                            onClick={() => {
                              setAjustando(i);
                              setAjTipo("ENTRADA");
                            }}
                            title="Ajustar stock"
                            variant="iconWarning"
                            size="icon"
                          >
                            <FaSlidersH size={12} />
                          </Button>
                        )}
                        <Button onClick={() => abrirHistorial(i)} title="Historial de movimientos" variant="iconInfo" size="icon">
                          <FaHistory size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {ajustando && (
        <Modal open onClose={() => setAjustando(null)} maxWidth="max-w-sm" className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Ajustar stock</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {ajustando.nombreServicio} — stock actual: <strong>{ajustando.stockActual}</strong>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["ENTRADA", "SALIDA"] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setAjTipo(tp)}
                className={`py-2 rounded-lg border text-sm font-semibold ${
                  ajTipo === tp
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {tp === "ENTRADA" ? "Sumar" : "Restar"}
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={ajCantidad}
            onChange={(e) => setAjCantidad(e.target.value)}
            placeholder="Cantidad"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            autoFocus
          />
          <input
            type="text"
            value={ajNota}
            onChange={(e) => setAjNota(e.target.value)}
            placeholder="Motivo (ej. conteo físico, merma, daño)"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAjustando(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarAjuste} isLoading={guardandoAjuste}>
              Guardar
            </Button>
          </div>
        </Modal>
      )}

      {historialDe && (
        <Modal open onClose={() => setHistorialDe(null)} maxWidth="max-w-2xl" className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Historial — {historialDe.nombreServicio}
          </h3>
          {movimientos.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Sin movimientos registrados.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-gray-500 dark:text-gray-400 text-left">
                <tr>
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Motivo</th>
                  <th className="py-2 text-right">Cant.</th>
                  <th className="py-2 text-right">Stock</th>
                  <th className="py-2 pl-4">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-gray-600 dark:text-gray-400">{dayjs(m.fecha).format("DD/MM/YY HH:mm")}</td>
                    <td className="py-2 text-gray-800 dark:text-gray-200">{MOTIVO[m.motivo]}</td>
                    <td className={`py-2 text-right font-semibold ${m.tipo === "ENTRADA" ? "text-emerald-600" : "text-red-500"}`}>
                      {m.tipo === "ENTRADA" ? "+" : "-"}
                      {m.cantidad}
                    </td>
                    <td className="py-2 text-right text-gray-800 dark:text-gray-200">{m.stockResultante}</td>
                    <td className="py-2 pl-4 text-gray-500 dark:text-gray-400">
                      {[m.nota, m.usuario].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setHistorialDe(null)}>
              Cerrar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
