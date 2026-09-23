import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import {
  FaBarcode,
  FaMinus,
  FaPlus,
  FaTrashAlt,
  FaUser,
  FaUserPlus,
  FaCashRegister,
  FaExclamationTriangle,
} from "react-icons/fa";
import { servicioService } from "../services/serviciosService";
import { ordenesService } from "../services/ordenesService";
import { clientesService } from "../services/clientesService";
import { cajaService } from "../services/cajaService";
import { useConfiguracion, useEtiquetas } from "../context/configuracionCore";
import {
  convertirDesdePrincipal,
  formatearMoneda,
  normalizarMoneda,
  type Moneda,
  type TasasConversion,
} from "../utils/monedaHelpers";
import { nombreCliente } from "../utils/clienteHelpers";
import ModalPago from "../components/modal/ModalPago";
import ListaClientesModal from "../components/modal/ListaClientesModal";
import FormularioCliente from "../components/formulario/FormularioCliente";
import Button from "../components/ui/Button";
import DescuentoControl from "../components/venta/DescuentoControl";
import DesgloseTotales from "../components/venta/DesgloseTotales";
import { totalesDeSeleccion } from "../utils/totales";
import { TableSkeleton } from "../components/Skeleton";
import type { Cliente, ClienteCreate, DescuentoOrden, Orden, Servicio } from "@lavanderia/shared/types/types";

type LineaCarrito = { servicio: Servicio; cantidad: number };

const coincideExacto = (s: Servicio, q: string) => {
  const v = q.trim().toLowerCase();
  return !!v && [s.codigoBarras, s.sku].some((x) => x && x.toLowerCase() === v);
};

// Venta de mostrador: escanear/buscar, armar el carrito y cobrar. La venta
// nace entregada (sin flujo de entrega) y el cobro usa el mismo modal de
// pagos multi-moneda que el resto del sistema.
export default function VentaMostrador() {
  const { config } = useConfiguracion();
  const et = useEtiquetas();
  const inventario = !!config?.moduloInventario;
  const clienteObligatorio = config?.clienteObligatorio !== false;
  const moneda: Moneda = normalizarMoneda(config?.monedaPrincipal ?? "USD");
  const tasas: TasasConversion = useMemo(
    () => ({ VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null }),
    [config]
  );

  const [catalogo, setCatalogo] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [verClientes, setVerClientes] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [descuento, setDescuento] = useState<DescuentoOrden | null>(null);
  const [ordenACobrar, setOrdenACobrar] = useState<Orden | null>(null);
  const [cajaCerrada, setCajaCerrada] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);
  const cobradaRef = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const res = await servicioService.getAll();
      setCatalogo(res.data);
    } catch {
      toast.error("No se pudo cargar el catálogo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!config?.moduloCaja) {
      setCajaCerrada(false);
      return;
    }
    cajaService
      .actual()
      .then((r) => setCajaCerrada(!r.data.abierta))
      .catch(() => setCajaCerrada(false));
  }, [config?.moduloCaja, ordenACobrar]);

  const disponible = (s: Servicio) => (inventario && s.controlaStock ? s.stockActual : Infinity);

  const enCarrito = (id: number) => carrito.find((l) => l.servicio.id === id)?.cantidad ?? 0;

  const agregar = useCallback(
    (s: Servicio, cantidad = 1) => {
      const yaHay = carrito.find((l) => l.servicio.id === s.id)?.cantidad ?? 0;
      const tope = inventario && s.controlaStock ? s.stockActual : Infinity;
      if (yaHay + cantidad > tope) {
        toast.warning(`Solo hay ${s.stockActual} de "${s.nombreServicio}" en stock.`);
        return;
      }
      setCarrito((prev) => {
        const existe = prev.find((l) => l.servicio.id === s.id);
        if (existe) {
          return prev.map((l) => (l.servicio.id === s.id ? { ...l, cantidad: l.cantidad + cantidad } : l));
        }
        return [...prev, { servicio: s, cantidad }];
      });
    },
    [carrito, inventario]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = q
      ? catalogo.filter(
          (s) =>
            s.nombreServicio.toLowerCase().includes(q) ||
            (s.sku ?? "").toLowerCase().includes(q) ||
            (s.codigoBarras ?? "").toLowerCase().includes(q)
        )
      : catalogo;
    return lista.slice(0, 60);
  }, [catalogo, busqueda]);

  // Los lectores de código de barras "escriben" el código y pulsan Enter.
  const alEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = busqueda.trim();
    if (!q) return;
    const exacto = catalogo.find((s) => coincideExacto(s, q));
    const elegido = exacto ?? (filtrados.length === 1 ? filtrados[0] : undefined);
    if (elegido) {
      agregar(elegido);
      setBusqueda("");
    } else {
      toast.info(filtrados.length === 0 ? "No se encontró ese código o nombre." : "Elige uno de la lista.");
    }
  };

  const cambiarCantidad = (id: number, valor: number) => {
    const linea = carrito.find((l) => l.servicio.id === id);
    if (!linea) return;
    if (valor <= 0) {
      setCarrito((prev) => prev.filter((l) => l.servicio.id !== id));
      return;
    }
    if (valor > disponible(linea.servicio)) {
      toast.warning(`Solo hay ${linea.servicio.stockActual} en stock.`);
      return;
    }
    setCarrito((prev) => prev.map((l) => (l.servicio.id === id ? { ...l, cantidad: valor } : l)));
  };

  const totales = useMemo(
    () =>
      totalesDeSeleccion(
        carrito.map((l) => ({ servicioId: l.servicio.id, cantidad: l.cantidad })),
        carrito.map((l) => l.servicio),
        config,
        descuento
      ),
    [carrito, config, descuento]
  );
  const totalRedondeado = totales.total;

  const vaciar = () => {
    setCarrito([]);
    setCliente(null);
    setDescuento(null);
    setBusqueda("");
    buscador.current?.focus();
  };

  const cobrar = async () => {
    if (carrito.length === 0) return toast.error("Agrega al menos un producto.");
    if (!cliente && clienteObligatorio) return toast.error(`Selecciona un ${et.clienteMin}.`);
    setGuardando(true);
    try {
      const res = await ordenesService.create({
        clienteId: cliente?.id ?? null,
        entregaInmediata: true,
        estado: "PENDIENTE",
        descuento: descuento && descuento.valor > 0 ? descuento : null,
        servicios: carrito.map((l) => ({ servicioId: l.servicio.id, cantidad: l.cantidad })),
      });
      setOrdenACobrar(res.data);
      cargar();
    } catch (err) {
      toast.error(
        err instanceof AxiosError ? err.response?.data?.message ?? "No se pudo registrar la venta." : "No se pudo registrar la venta."
      );
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="p-6">
        <TableSkeleton rows={8} cols={4} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <FaCashRegister className="text-blue-600" /> Nueva {et.ordenMin}
        </h1>
        {cajaCerrada && (
          <Link
            to="/caja"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm font-semibold border border-amber-300 dark:border-amber-800"
          >
            <FaExclamationTriangle /> La caja está cerrada — ábrela para cobrar
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <section className="space-y-4">
          <div className="relative">
            <FaBarcode className="absolute top-3.5 left-4 text-gray-400" />
            <input
              ref={buscador}
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={alEnter}
              placeholder="Escanea el código de barras o busca por nombre / SKU…"
              className="w-full pl-11 pr-4 py-3 text-lg rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtrados.map((s) => {
              const sinStock = disponible(s) - enCarrito(s.id) <= 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={sinStock}
                  onClick={() => {
                    agregar(s);
                    buscador.current?.focus();
                  }}
                  className="text-left p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-400 hover:shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <p className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">{s.nombreServicio}</p>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                      {formatearMoneda(s.precioBase, moneda)}
                    </span>
                    {inventario && s.controlaStock && (
                      <span
                        className={`text-xs font-semibold ${
                          s.stockMinimo !== null && s.stockActual <= s.stockMinimo
                            ? "text-red-500"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {s.stockActual <= 0 ? "Agotado" : `${s.stockActual} en stock`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {filtrados.length === 0 && (
              <p className="col-span-full text-gray-500 dark:text-gray-400 py-6 text-center">
                Sin resultados para "{busqueda}".
              </p>
            )}
          </div>
        </section>

        <aside className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 space-y-4 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                {et.cliente} {!clienteObligatorio && "(opcional)"}
              </p>
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                <FaUser className="text-gray-400 shrink-0" />
                {nombreCliente(cliente, clienteObligatorio ? `Selecciona un ${et.clienteMin}` : "Mostrador")}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="iconNeutral" size="icon" title={`Elegir ${et.clienteMin}`} onClick={() => setVerClientes(true)}>
                <FaUser size={12} />
              </Button>
              <Button variant="iconInfo" size="icon" title={`Nuevo ${et.clienteMin}`} onClick={() => setNuevoCliente(true)}>
                <FaUserPlus size={12} />
              </Button>
              {cliente && !clienteObligatorio && (
                <Button variant="iconDanger" size="icon" title="Quitar" onClick={() => setCliente(null)}>
                  <FaTrashAlt size={12} />
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2 max-h-[45vh] overflow-y-auto">
            {carrito.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                El carrito está vacío. Escanea o elige un producto.
              </p>
            )}
            {carrito.map((l) => (
              <div key={l.servicio.id} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{l.servicio.nombreServicio}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatearMoneda(l.servicio.precioBase, moneda)} c/u</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center"
                    onClick={() => cambiarCantidad(l.servicio.id, l.cantidad - 1)}
                  >
                    <FaMinus size={9} />
                  </button>
                  <input
                    type="number"
                    step={l.servicio.permiteDecimales ? "any" : 1}
                    min={0}
                    value={l.cantidad}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) cambiarCantidad(l.servicio.id, l.servicio.permiteDecimales ? v : Math.round(v));
                    }}
                    className="w-14 text-center py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    className="w-7 h-7 rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center"
                    onClick={() => cambiarCantidad(l.servicio.id, l.cantidad + 1)}
                  >
                    <FaPlus size={9} />
                  </button>
                </div>
                <p className="w-20 text-right font-semibold text-gray-800 dark:text-gray-200">
                  {formatearMoneda(l.servicio.precioBase * l.cantidad, moneda)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-1">
            {carrito.length > 0 && <DescuentoControl value={descuento} onChange={setDescuento} disabled={guardando} />}
            <DesgloseTotales totales={totales} moneda={moneda} tamano="lg" />
            {(["VES", "COP"] as const)
              .filter((m) => m !== moneda && tasas[m])
              .map((m) => (
                <p key={m} className="text-right text-xs text-gray-500 dark:text-gray-400">
                  {formatearMoneda(convertirDesdePrincipal(totalRedondeado, m, tasas, moneda), m)}
                </p>
              ))}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={vaciar} disabled={carrito.length === 0 && !cliente}>
              Vaciar
            </Button>
            <Button className="flex-1" size="lg" variant="whatsapp" onClick={cobrar} isLoading={guardando} disabled={carrito.length === 0}>
              Cobrar
            </Button>
          </div>
        </aside>
      </div>

      {verClientes && (
        <ListaClientesModal
          onClose={() => setVerClientes(false)}
          onSelect={(c) => {
            setCliente(c);
            setVerClientes(false);
          }}
        />
      )}

      {nuevoCliente && (
        <FormularioCliente
          onClose={() => setNuevoCliente(false)}
          onSubmit={async (data) => {
            const res = await clientesService.create(data as ClienteCreate);
            setCliente(res.data);
            setNuevoCliente(false);
          }}
        />
      )}

      {ordenACobrar && (
        <ModalPago
          orden={ordenACobrar}
          tasas={tasas}
          monedaPrincipal={moneda}
          onClose={() => {
            // Cerrado sin cobrar: la venta queda registrada como pendiente de pago.
            if (!cobradaRef.current) {
              toast.info(`${et.orden} #${ordenACobrar.id} guardada sin cobrar. Puedes cobrarla desde ${et.ordenes}.`);
            }
            cobradaRef.current = false;
            setOrdenACobrar(null);
            vaciar();
          }}
          onPagoRegistrado={() => {
            cobradaRef.current = true;
            toast.success(`${et.orden} #${ordenACobrar.id} cobrada.`);
          }}
        />
      )}
    </div>
  );
}
