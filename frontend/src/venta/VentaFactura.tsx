import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaBarcode, FaExclamationTriangle, FaFileInvoiceDollar, FaPlus, FaTimes, FaUser, FaSave, FaFolderOpen } from "react-icons/fa";
import { formatearMoneda, convertirDesdePrincipal } from "../utils/monedaHelpers";
import { nombreCliente } from "../utils/clienteHelpers";
import { useAtajos } from "../atajos/atajosCore";
import Kbd from "../atajos/Kbd";
import Button from "../components/ui/Button";
import DescuentoControl from "../components/venta/DescuentoControl";
import { CampoMontoNumero } from "../components/ui/CampoMonto";
import DesgloseTotales from "../components/venta/DesgloseTotales";
import { TableSkeleton } from "../components/Skeleton";
import { useVenta } from "./useVenta";
import VentaModales from "./VentaModales";

const tarjeta = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";

/**
 * Facturación de mostrador (repuestos, equipos): se busca en el catálogo con
 * todos los datos a la vista (código, stock, precio), se arma la factura línea
 * por línea con precio editable y se pueden guardar cotizaciones para después.
 */
export default function VentaFactura() {
  const venta = useVenta({ precioEditable: true });
  const { et, moneda, tasas, carrito, totales } = venta;

  const [busqueda, setBusqueda] = useState("");
  const [resaltado, setResaltado] = useState(0);
  const [verClientes, setVerClientes] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [verEspera, setVerEspera] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);
  const inputDescuento = useRef<HTMLElement>(null);

  const resultados = useMemo(() => (busqueda.trim() ? venta.filtrar(busqueda.replace(/^\s*\d+(?:[.,]\d+)?\s*[*x×]\s*/i, ""), 10) : []), [busqueda, venta]);
  const idx = Math.min(resaltado, Math.max(resultados.length - 1, 0));
  const ocupado = venta.guardando || !!venta.ordenACobrar;
  const hayItems = carrito.length > 0;

  const enfocar = () => setTimeout(() => buscador.current?.focus(), 0);

  const teclado = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((r) => Math.min(r + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!busqueda.trim()) return;
      if (venta.agregarPorTexto(busqueda, resultados[idx] ? [resultados[idx]] : [])) {
        setBusqueda("");
        setResaltado(0);
      }
    } else if (e.key === "Escape") {
      setBusqueda("");
    }
  };

  useAtajos([
    { combo: "F2", descripcion: "Buscar en el catálogo", grupo: "Facturación", accion: () => buscador.current?.focus() },
    { combo: "F3", descripcion: `Elegir ${et.clienteMin}`, grupo: "Facturación", accion: () => !ocupado && setVerClientes(true) },
    { combo: "F4", descripcion: "Descuento", grupo: "Facturación", accion: () => inputDescuento.current?.focus() },
    { combo: "F5", descripcion: "Guardar como cotización", grupo: "Facturación", accion: () => !ocupado && venta.ponerEnEspera() && enfocar() },
    { combo: "F6", descripcion: "Abrir una cotización guardada", grupo: "Facturación", accion: () => !ocupado && setVerEspera(true) },
    { combo: "F9", descripcion: "Facturar y cobrar", grupo: "Facturación", accion: () => !ocupado && hayItems && venta.cobrar() },
  ]);

  const total = useMemo(() => totales.total, [totales]);

  if (venta.cargando) {
    return (
      <div className="p-6">
        <TableSkeleton rows={8} cols={4} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FaFileInvoiceDollar className="text-blue-600" /> Facturación
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Busca en el catálogo, ajusta precios y cobra.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {venta.cajaCerrada && (
            <Link to="/caja" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm font-semibold border border-amber-300 dark:border-amber-800">
              <FaExclamationTriangle /> La caja está cerrada — ábrela para cobrar
            </Link>
          )}
          <Button variant="secondary" onClick={() => setVerEspera(true)} disabled={ocupado} leftIcon={<FaFolderOpen />}>
            Cotizaciones {venta.enEspera.length > 0 && <span className="ml-1 px-1.5 rounded-full bg-blue-600 text-white text-[10px]">{venta.enEspera.length}</span>}
            <Kbd combo="F6" className="ml-2 opacity-60" />
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-5 min-w-0">
          {/* Buscador con resultados en tabla */}
          <section className={`${tarjeta} relative`}>
            <div className="relative">
              <FaBarcode className="absolute top-4 left-4 text-gray-400" />
              <input
                ref={buscador}
                autoFocus
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setResaltado(0);
                }}
                onKeyDown={teclado}
                disabled={ocupado}
                placeholder="Código, nombre, descripción… (F2)"
                className="w-full pl-11 pr-4 py-3 text-lg rounded-xl bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                aria-label="Buscar en el catálogo"
              />
            </div>
            {resultados.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-left">Código</th>
                      <th className="px-4 py-2 text-left">Descripción</th>
                      <th className="px-4 py-2 text-left hidden md:table-cell">Categoría</th>
                      <th className="px-4 py-2 text-right">Stock</th>
                      <th className="px-4 py-2 text-right">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((s, i) => {
                      const sinStock = venta.disponible(s) - venta.enCarrito(s.id) <= 0;
                      return (
                        <tr
                          key={s.id}
                          onMouseEnter={() => setResaltado(i)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!sinStock && venta.agregar(s)) {
                              setBusqueda("");
                              enfocar();
                            }
                          }}
                          className={`border-t border-gray-100 dark:border-gray-800 cursor-pointer ${i === idx ? "bg-blue-50 dark:bg-blue-900/20" : ""} ${sinStock ? "opacity-40" : ""}`}
                        >
                          <td className="px-4 py-2 tabular-nums text-gray-500">{s.sku || s.codigoBarras || "—"}</td>
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{s.nombreServicio}</td>
                          <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{s.categoria?.nombre ?? "—"}</td>
                          <td className={`px-4 py-2 text-right tabular-nums ${s.controlaStock && s.stockActual <= 0 ? "text-red-500 font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
                            {venta.inventario && s.controlaStock ? s.stockActual : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-bold text-blue-700 dark:text-blue-400">{formatearMoneda(s.precioBase, moneda)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="px-4 py-1.5 text-[11px] text-gray-400">↑↓ elegir · Enter agregar · 3*código = 3 unidades</p>
              </div>
            )}
          </section>

          {/* Líneas de la factura */}
          <section className={`${tarjeta} overflow-hidden`}>
            {carrito.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-gray-600">La factura está vacía. Busca un producto arriba.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left">{et.servicio}</th>
                      <th className="px-4 py-2 text-right w-28">Cant.</th>
                      <th className="px-4 py-2 text-right w-36">Precio unit.</th>
                      <th className="px-4 py-2 text-right w-32">Importe</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.map((l) => {
                      const precio = l.precio ?? l.servicio.precioBase;
                      const modificado = l.precio !== undefined && l.precio !== l.servicio.precioBase;
                      const bajoCosto = l.servicio.costoBase != null && precio < l.servicio.costoBase;
                      return (
                        <tr key={l.servicio.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{l.servicio.nombreServicio}</div>
                            <div className="text-xs text-gray-400">{l.servicio.sku || l.servicio.codigoBarras || ""}</div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step={l.servicio.permiteDecimales ? "any" : 1}
                              value={l.cantidad}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v)) venta.cambiarCantidad(l.servicio.id, l.servicio.permiteDecimales ? v : Math.round(v));
                              }}
                              className="w-20 text-right px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent tabular-nums"
                              aria-label={`Cantidad de ${l.servicio.nombreServicio}`}
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <CampoMontoNumero
                              moneda={moneda}
                              valor={precio}
                              onValor={(v) => venta.fijarPrecio(l.servicio.id, v === null ? undefined : v === l.servicio.precioBase ? undefined : v)}
                              className={`w-28 text-right px-2 py-1 rounded-md border bg-transparent tabular-nums ${
                                bajoCosto ? "border-red-400 text-red-600" : modificado ? "border-amber-400" : "border-gray-300 dark:border-gray-700"
                              }`}
                              aria-label={`Precio de ${l.servicio.nombreServicio}`}
                            />
                            {modificado && (
                              <button type="button" onClick={() => venta.fijarPrecio(l.servicio.id, undefined)} className="block ml-auto text-[10px] text-amber-600 hover:underline cursor-pointer">
                                lista: {formatearMoneda(l.servicio.precioBase, moneda)}
                              </button>
                            )}
                            {bajoCosto && <span className="block text-[10px] text-red-500">Por debajo del costo</span>}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-bold">{formatearMoneda(precio * l.cantidad, moneda)}</td>
                          <td className="px-2">
                            <button type="button" onClick={() => venta.quitar(l.servicio.id)} className="text-gray-400 hover:text-red-500 cursor-pointer p-2" title="Quitar" aria-label="Quitar">
                              <FaTimes />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Cliente y totales */}
        <aside className={`${tarjeta} p-5 space-y-4 lg:sticky lg:top-4`}>
          <div>
            <p className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 mb-1">
              {et.cliente} {!venta.clienteObligatorio && "(opcional)"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => !ocupado && setVerClientes(true)}
                className="flex-1 min-w-0 flex items-center justify-between gap-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
                  <FaUser className="text-gray-400 shrink-0" />
                  {nombreCliente(venta.cliente, venta.clienteObligatorio ? `Elegir ${et.clienteMin}` : "Mostrador")}
                </span>
                <Kbd combo="F3" className="text-gray-400" />
              </button>
              <Button variant="iconInfo" size="icon" title={`Nuevo ${et.clienteMin}`} onClick={() => setNuevoCliente(true)}>
                <FaPlus size={12} />
              </Button>
            </div>
            {venta.cliente?.telefono && <p className="text-xs text-gray-400 mt-1">{venta.cliente.telefono}</p>}
          </div>

          {hayItems && <DescuentoControl value={venta.descuento} onChange={venta.setDescuento} disabled={ocupado} inputRef={inputDescuento} />}
          <DesgloseTotales totales={totales} moneda={moneda} />
          {(["VES", "COP"] as const)
            .filter((m) => m !== moneda && tasas[m])
            .map((m) => (
              <p key={m} className="text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {formatearMoneda(convertirDesdePrincipal(total, m, tasas, moneda), m)}
              </p>
            ))}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={() => venta.ponerEnEspera() && enfocar()} disabled={!hayItems || ocupado} leftIcon={<FaSave />}>
              Cotización
            </Button>
            <Button variant="whatsapp" size="lg" onClick={venta.cobrar} isLoading={venta.guardando} disabled={!hayItems || ocupado}>
              Facturar
            </Button>
          </div>
          <p className="text-[11px] text-gray-400 flex justify-between">
            <span><Kbd combo="F5" /> guardar</span>
            <span><Kbd combo="F9" /> facturar</span>
          </p>
        </aside>
      </div>

      <VentaModales
        venta={venta}
        verClientes={verClientes}
        nuevoCliente={nuevoCliente}
        verEspera={verEspera}
        cerrarClientes={() => setVerClientes(false)}
        cerrarNuevoCliente={() => setNuevoCliente(false)}
        cerrarEspera={() => setVerEspera(false)}
        nombreEspera="guardadas (cotizaciones)"
      />
    </div>
  );
}
