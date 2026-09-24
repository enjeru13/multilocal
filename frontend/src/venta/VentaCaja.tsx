import { useEffect, useMemo, useRef, useState } from "react";
import { useMonedas } from "../context/useMonedas";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  FaBarcode,
  FaMinus,
  FaPlus,
  FaTimes,
  FaUser,
  FaCashRegister,
  FaExclamationTriangle,
  FaSignOutAlt,
  FaPauseCircle,
  FaPlayCircle,
  FaMoneyBillWave,
  FaThLarge,
} from "react-icons/fa";
import { formatearMoneda, convertirDesdePrincipal } from "../utils/monedaHelpers";
import { nombreCliente } from "../utils/clienteHelpers";
import { useAuth } from "../hooks/useAuth";
import { useAtajos, useAtajosContext } from "../atajos/atajosCore";
import Kbd from "../atajos/Kbd";
import DescuentoControl from "../components/venta/DescuentoControl";
import DesgloseTotales from "../components/venta/DesgloseTotales";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import { TableSkeleton } from "../components/Skeleton";
import { useVenta } from "./useVenta";
import Modal from "../components/ui/Modal";
import { useEsCompacto } from "../hooks/useMediaQuery";
import VentaModales from "./VentaModales";

const SIN_CATEGORIA = "Sin categoría";

/**
 * Caja de minimarket: pantalla completa, buscador siempre listo para el lector de
 * códigos, ticket grande, cobro con una tecla y ventas en espera. Se maneja casi
 * sin ratón (barra de teclas F abajo).
 */
export default function VentaCaja() {
  const venta = useVenta();
  const negocio = useMonedas();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { abrirAyuda } = useAtajosContext();
  const { et, moneda, tasas, carrito, seleccion, totales } = venta;

  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<string>("__frecuentes");
  const [verClientes, setVerClientes] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [verEspera, setVerEspera] = useState(false);
  const compacto = useEsCompacto();
  const [hoja, setHoja] = useState<null | "resumen" | "productos">(null);
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  const [recibido, setRecibido] = useState("");
  const [hora, setHora] = useState(() => dayjs().format("HH:mm"));
  const buscador = useRef<HTMLInputElement>(null);
  const inputDescuento = useRef<HTMLElement>(null);
  const inputRecibido = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setHora(dayjs().format("HH:mm")), 15000);
    return () => clearInterval(t);
  }, []);

  // En teléfono no se devuelve el foco al buscador: abriría el teclado tras cada toque.
  const enfocar = () => {
    if (!compacto) setTimeout(() => buscador.current?.focus(), 0);
  };

  const sugerencias = useMemo(() => (busqueda.trim() ? venta.filtrar(busqueda, 8) : []), [busqueda, venta]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    venta.catalogo.forEach((s) => set.add(s.categoria?.nombre ?? SIN_CATEGORIA));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [venta.catalogo]);

  // Si aún no hay frecuentes, se abre en la primera categoría.
  const pestanaActiva = pestana === "__frecuentes" && venta.frecuentes.length === 0 ? categorias[0] ?? "" : pestana;
  const productosRapidos = useMemo(() => {
    if (pestanaActiva === "__frecuentes") return venta.frecuentes;
    return venta.catalogo.filter((s) => (s.categoria?.nombre ?? SIN_CATEGORIA) === pestanaActiva).slice(0, 30);
  }, [pestanaActiva, venta.frecuentes, venta.catalogo]);

  const cobrarConEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!busqueda.trim()) return;
      if (venta.agregarPorTexto(busqueda, sugerencias)) setBusqueda("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      venta.setSeleccion(Math.min(seleccion + 1, carrito.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      venta.setSeleccion(Math.max(seleccion - 1, 0));
    } else if (e.code === "NumpadAdd" || e.code === "NumpadSubtract") {
      e.preventDefault();
      const l = carrito[seleccion];
      if (l) venta.cambiarCantidad(l.servicio.id, l.cantidad + (e.code === "NumpadAdd" ? 1 : -1));
    } else if (e.key === "Escape") {
      setBusqueda("");
    }
  };

  const ocupado = venta.guardando || !!venta.ordenACobrar;
  const hayItems = carrito.length > 0;

  useAtajos([
    { combo: "F1", descripcion: "Ayuda de atajos", grupo: "Caja", accion: () => abrirAyuda(true) },
    { combo: "F2", descripcion: "Buscar o escanear", grupo: "Caja", accion: () => buscador.current?.focus() },
    { combo: "F3", descripcion: `Elegir ${et.clienteMin}`, grupo: "Caja", accion: () => !ocupado && setVerClientes(true) },
    { combo: "F4", descripcion: "Descuento", grupo: "Caja", accion: () => inputDescuento.current?.focus() },
    { combo: "F5", descripcion: "Dejar venta en espera", grupo: "Caja", accion: () => !ocupado && venta.ponerEnEspera() && enfocar() },
    { combo: "F6", descripcion: "Recuperar venta en espera", grupo: "Caja", accion: () => !ocupado && setVerEspera(true) },
    { combo: "F7", descripcion: "Monto recibido (calcular vuelto)", grupo: "Caja", accion: () => inputRecibido.current?.focus() },
    { combo: "F8", descripcion: "Cobrar en efectivo exacto", grupo: "Caja", accion: () => !ocupado && hayItems && venta.cobroRapidoEfectivo() },
    { combo: "F9", descripcion: "Cobrar (varios métodos y monedas)", grupo: "Caja", accion: () => !ocupado && hayItems && venta.cobrar() },
    { combo: "F10", descripcion: "Vaciar la venta", grupo: "Caja", accion: () => !ocupado && hayItems && setConfirmarVaciar(true) },
    { combo: "Alt+Backspace", descripcion: "Quitar la línea seleccionada", grupo: "Caja", enCampo: true, accion: () => carrito[seleccion] && venta.quitar(carrito[seleccion].servicio.id) },
  ]);

  // Al terminar un cobro el buscador vuelve a quedar listo para el siguiente cliente.
  useEffect(() => {
    if (!venta.ordenACobrar && !verClientes && !nuevoCliente && !verEspera && !confirmarVaciar && !compacto) buscador.current?.focus();
  }, [venta.ordenACobrar, verClientes, nuevoCliente, verEspera, confirmarVaciar, compacto]);

  useEffect(() => {
    if (carrito.length === 0) setRecibido("");
  }, [carrito.length]);

  const recibidoNum = parseFloat(recibido.replace(",", "."));
  const vuelto = !isNaN(recibidoNum) ? recibidoNum - totales.total : null;

  if (venta.cargando) {
    return createPortal(
      <div className="fixed inset-0 z-[60] bg-gray-100 dark:bg-gray-950 p-6">
        <TableSkeleton rows={8} cols={4} />
      </div>,
      document.body
    );
  }

  const tecla = (combo: string, texto: string, onClick: () => void, opciones: { deshabilitado?: boolean; destacado?: boolean } = {}) => (
    <button
      key={combo}
      type="button"
      onClick={onClick}
      disabled={opciones.deshabilitado}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
        opciones.destacado
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      <Kbd combo={combo} className={opciones.destacado ? "text-white" : "text-gray-500"} />
      {texto}
    </button>
  );

  const bloqueTotales = (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => !ocupado && setVerClientes(true)}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        >
          <span className="flex items-center gap-2 truncate">
            <FaUser className="text-gray-400 shrink-0" />
            {nombreCliente(venta.cliente, venta.clienteObligatorio ? `Elegir ${et.clienteMin}` : "Consumidor final")}
          </span>
          <Kbd combo="F3" className="text-gray-400" />
        </button>
        <button
          type="button"
          onClick={() => !ocupado && setNuevoCliente(true)}
          title={`Nuevo ${et.clienteMin}`}
          className="px-3 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        >
          <FaPlus size={12} />
        </button>
      </div>
      {venta.cliente && !venta.clienteObligatorio && (
        <button type="button" onClick={() => venta.setCliente(null)} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer">
          Quitar {et.clienteMin}
        </button>
      )}
    
      {hayItems && <DescuentoControl value={venta.descuento} onChange={venta.setDescuento} disabled={ocupado} inputRef={inputDescuento} />}
      <DesgloseTotales totales={totales} moneda={moneda} tamano="lg" />
      {negocio.otrasUsables
                      .map((m) => (
          <p key={m} className="text-right text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {formatearMoneda(convertirDesdePrincipal(totales.total, m, tasas, moneda), m)}
          </p>
        ))}
    
      {hayItems && (
        <div className="flex items-center gap-2 pt-1">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">Recibido</label>
          <input
            ref={inputRecibido}
            value={recibido}
            onChange={(e) => setRecibido(e.target.value)}
            inputMode="decimal"
            placeholder={formatearMoneda(0, moneda)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscador.current?.focus())}
            className="flex-1 min-w-0 text-right px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent tabular-nums"
          />
          <Kbd combo="F7" className="text-gray-400" />
        </div>
      )}
      {vuelto !== null && hayItems && (
        <p className={`text-right text-lg font-bold tabular-nums ${vuelto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {vuelto >= 0 ? "Vuelto" : "Falta"}: {formatearMoneda(Math.abs(vuelto), moneda)}
        </p>
      )}
    
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          disabled={!hayItems || ocupado}
          onClick={venta.cobroRapidoEfectivo}
          className="py-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 font-bold text-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-40 cursor-pointer flex flex-col items-center gap-0.5"
        >
          <span className="flex items-center gap-2"><FaMoneyBillWave /> Efectivo</span>
          <Kbd combo="F8" className="opacity-70" />
        </button>
        <button
          type="button"
          disabled={!hayItems || ocupado}
          onClick={venta.cobrar}
          className="py-3 rounded-xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 disabled:opacity-40 cursor-pointer flex flex-col items-center gap-0.5"
        >
          <span>Cobrar</span>
          <Kbd combo="F9" className="opacity-80" />
        </button>
      </div>
    </div>
  );

  const bloqueRapidos = (
    <div className="flex-1 min-h-[200px] flex flex-col rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Productos</span>
        <select
          value={pestanaActiva}
          onChange={(e) => {
            setPestana(e.target.value);
            enfocar();
          }}
          aria-label="Categoría"
          className="ml-auto min-w-0 max-w-[65%] h-8 pl-2.5 pr-7 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer truncate"
        >
          {venta.frecuentes.length > 0 && <option value="__frecuentes">★ Frecuentes</option>}
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5 content-start">
        {productosRapidos.map((s) => {
          const agotado = venta.disponible(s) - venta.enCarrito(s.id) <= 0;
          return (
            <button
              key={s.id}
              type="button"
              disabled={agotado || ocupado}
              onClick={() => {
                venta.agregar(s);
                enfocar();
              }}
              className="text-left p-3 min-h-[68px] flex flex-col justify-between gap-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-[0.98] transition disabled:opacity-40 cursor-pointer"
            >
              <p className="text-[13px] font-medium leading-snug line-clamp-2">{s.nombreServicio}</p>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400 tabular-nums">{formatearMoneda(s.precioBase, moneda)}</p>
            </button>
          );
        })}
        {productosRapidos.length === 0 && <p className="col-span-2 text-xs text-gray-400 text-center py-4">Sin productos.</p>}
      </div>
    </div>
  );

  const articulos = carrito.reduce((n, l) => n + l.cantidad, 0);

  // En un portal: el contenedor de las pantallas tiene animación (transform) y eso
  // impediría que "fixed" cubra la ventana completa.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Barra superior */}
      <header className="h-14 shrink-0 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-800">
        <span className="flex items-center gap-2 font-bold tracking-tight min-w-0">
          <FaCashRegister className="text-blue-600 dark:text-blue-400 shrink-0" /> <span className="truncate">{venta.config?.nombreNegocio || "Caja"}</span>
        </span>
        {venta.config?.moduloCaja &&
          (venta.cajaCerrada ? (
            <Link to="/caja" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              <FaExclamationTriangle /> <span className="max-sm:hidden">Caja cerrada — ábrela para cobrar</span><span className="sm:hidden">Caja cerrada</span>
            </Link>
          ) : (
            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">Caja abierta</span>
          ))}
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400 hidden md:inline">{user?.name || user?.email}</span>
        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300 max-sm:ml-auto">{hora}</span>
        <button
          type="button"
          onClick={() => navigate("/resumen")}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer max-sm:w-10 max-sm:h-10 max-sm:justify-center"
          title="Salir de la caja" aria-label="Salir de la caja"
        >
          <FaSignOutAlt /> <span className="max-sm:hidden">Salir</span> <Kbd combo="Alt+H" className="text-gray-400" />
        </button>
      </header>

      <div className={`flex-1 min-h-0 grid ${compacto ? "" : "lg:grid-cols-[1fr_400px]"}`}>
        {/* Ticket */}
        <section className="min-h-0 flex flex-col p-3 sm:p-4 gap-3">
          <div className="relative">
            <FaBarcode className="absolute top-4 left-4 text-gray-400" />
            <input
              ref={buscador}
              autoFocus={!compacto}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={cobrarConEnter}
              disabled={ocupado}
              placeholder={compacto ? "Código o nombre del producto" : "Escanea o escribe un código / nombre…   (3*código = 3 unidades)"}
              className="w-full pl-11 pr-4 py-3 sm:py-3.5 text-base sm:text-xl rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:border-blue-500"
              aria-label="Buscar o escanear producto"
            />
            {sugerencias.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
                {sugerencias.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (venta.agregar(s)) setBusqueda("");
                        enfocar();
                      }}
                      disabled={venta.disponible(s) - venta.enCarrito(s.id) <= 0}
                      className={`w-full flex items-center justify-between gap-4 px-4 py-2.5 text-left cursor-pointer disabled:opacity-40 ${
                        i === 0 ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      } hover:bg-blue-50 dark:hover:bg-blue-900/30`}
                    >
                      <span className="truncate">
                        <span className="font-medium">{s.nombreServicio}</span>
                        {(s.sku || s.codigoBarras) && <span className="ml-2 text-xs text-gray-400">{s.sku || s.codigoBarras}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-blue-700 dark:text-blue-400">
                        {formatearMoneda(s.precioBase, moneda)}
                        {venta.inventario && s.controlaStock && <span className="ml-2 text-xs font-normal text-gray-400">{s.stockActual} en stock</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {carrito.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-3 p-8 text-center">
                <FaBarcode size={48} />
                <p className="text-lg">Escanea un producto para empezar</p>
                <p className="text-xs">
                  <Kbd combo="F2" /> buscar · <Kbd combo="F6" /> recuperar venta en espera
                </p>
              </div>
            ) : (
              compacto ? (
                <ul className="p-2 space-y-2">
                  {carrito.map((l, i) => (
                    <li
                      key={l.servicio.id}
                      onClick={() => venta.setSeleccion(i)}
                      className={`rounded-xl border p-3 space-y-2 ${i === seleccion ? "border-blue-400 bg-blue-50/60 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-800"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-[15px] leading-snug min-w-0">{l.servicio.nombreServicio}</p>
                        <p className="font-extrabold tabular-nums shrink-0">{formatearMoneda(l.servicio.precioBase * l.cantidad, moneda)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{formatearMoneda(l.servicio.precioBase, moneda)} c/u</p>
                        <div className="flex items-center gap-1.5">
                          <button type="button" className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-700 flex items-center justify-center active:bg-gray-100 dark:active:bg-gray-800 cursor-pointer" onClick={() => venta.cambiarCantidad(l.servicio.id, l.cantidad - 1)} aria-label="Menos">
                            <FaMinus size={11} />
                          </button>
                          <span className="w-10 text-center font-bold tabular-nums text-lg">{l.cantidad}</span>
                          <button type="button" className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-700 flex items-center justify-center active:bg-gray-100 dark:active:bg-gray-800 cursor-pointer" onClick={() => venta.cambiarCantidad(l.servicio.id, l.cantidad + 1)} aria-label="Más">
                            <FaPlus size={11} />
                          </button>
                          <button type="button" onClick={() => venta.quitar(l.servicio.id)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer" title="Quitar" aria-label="Quitar">
                            <FaTimes />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
              <table className="w-full text-base">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left w-10">#</th>
                    <th className="px-4 py-2 text-left">{et.servicio}</th>
                    <th className="px-4 py-2 text-center w-40">Cantidad</th>
                    <th className="px-4 py-2 text-right w-32">P. unit.</th>
                    <th className="px-4 py-2 text-right w-36">Importe</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {carrito.map((l, i) => {
                    const activa = i === seleccion;
                    return (
                      <tr
                        key={l.servicio.id}
                        onClick={() => venta.setSeleccion(i)}
                        className={`border-t border-gray-100 dark:border-gray-800 cursor-pointer ${
                          activa ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        } ${venta.ultimaAgregada === l.servicio.id ? "animate-pulse-subtle" : ""}`}
                      >
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{l.servicio.nombreServicio}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => venta.cambiarCantidad(l.servicio.id, l.cantidad - 1)} aria-label="Menos">
                              <FaMinus size={10} />
                            </button>
                            <span className="w-12 text-center font-bold tabular-nums text-lg">{l.cantidad}</span>
                            <button type="button" className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => venta.cambiarCantidad(l.servicio.id, l.cantidad + 1)} aria-label="Más">
                              <FaPlus size={10} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatearMoneda(l.servicio.precioBase, moneda)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold">{formatearMoneda(l.servicio.precioBase * l.cantidad, moneda)}</td>
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
              )
            )}
          </div>
        </section>

        {/* Total y productos rápidos (en teléfono y tablet viven en hojas, abiertas desde la barra de abajo) */}
        {!compacto && (
        <aside className="min-h-0 overflow-y-auto flex flex-col gap-3 p-4 lg:pl-0">
          {bloqueTotales}

          {bloqueRapidos}
        </aside>
        )}
      </div>

      {compacto && (
        <div className="shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => hayItems && setHoja("resumen")} className="text-left min-w-0 cursor-pointer" aria-label="Ver el detalle de la venta">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {hayItems ? `${articulos} artículo${articulos === 1 ? "" : "s"} · ${nombreCliente(venta.cliente, "Consumidor final")}` : "Sin artículos"}
              </p>
              <p className="text-2xl font-extrabold tabular-nums leading-tight">{formatearMoneda(totales.total, moneda)}</p>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => setHoja("productos")} className="h-11 px-3.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-semibold flex items-center gap-2 active:bg-gray-100 dark:active:bg-gray-800 cursor-pointer">
                <FaThLarge /> Productos
              </button>
              {venta.enEspera.length > 0 && (
                <button type="button" onClick={() => setVerEspera(true)} className="h-11 w-11 rounded-xl border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 flex items-center justify-center relative cursor-pointer" aria-label="Ventas en espera">
                  <FaPlayCircle />
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{venta.enEspera.length}</span>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2.5">
            <button
              type="button"
              disabled={!hayItems || ocupado}
              onClick={venta.cobroRapidoEfectivo}
              className="h-12 px-4 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 font-bold text-sm flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <FaMoneyBillWave /> Efectivo
            </button>
            <button type="button" disabled={!hayItems || ocupado} onClick={venta.cobrar} className="h-12 rounded-xl bg-emerald-600 text-white font-bold text-base active:bg-emerald-700 disabled:opacity-40 cursor-pointer">
              Cobrar {hayItems && formatearMoneda(totales.total, moneda)}
            </button>
          </div>
        </div>
      )}

      {compacto && (
        <>
          <Modal open={hoja === "resumen"} onClose={() => setHoja(null)} maxWidth="max-w-md" className="max-sm:max-h-[92dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h2 className="text-lg font-semibold">Detalle de la venta</h2>
              <button type="button" onClick={() => setHoja(null)} aria-label="Cerrar" className="p-2 text-gray-400 cursor-pointer">
                <FaTimes />
              </button>
            </div>
            <div className="overflow-y-auto px-3 pb-4">{bloqueTotales}</div>
          </Modal>
          <Modal open={hoja === "productos"} onClose={() => setHoja(null)} maxWidth="max-w-md" className="max-sm:h-[85dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <h2 className="text-lg font-semibold">Productos</h2>
              <button type="button" onClick={() => setHoja(null)} aria-label="Cerrar" className="p-2 text-gray-400 cursor-pointer">
                <FaTimes />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col px-3 pb-3">{bloqueRapidos}</div>
          </Modal>
        </>
      )}

      {/* Barra de teclas de función */}
      {!compacto && (
      <footer className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        {tecla("F1", "Ayuda", () => abrirAyuda(true))}
        {tecla("F2", "Buscar", () => buscador.current?.focus())}
        {tecla("F3", et.cliente, () => setVerClientes(true), { deshabilitado: ocupado })}
        {tecla("F5", "En espera", () => venta.ponerEnEspera() && enfocar(), { deshabilitado: ocupado || !hayItems })}
        <button
          type="button"
          onClick={() => setVerEspera(true)}
          disabled={ocupado}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-40"
        >
          <Kbd combo="F6" className="text-gray-500" />
          <FaPlayCircle /> Recuperar
          {venta.enEspera.length > 0 && <span className="px-1.5 rounded-full bg-amber-500 text-white text-[10px]">{venta.enEspera.length}</span>}
        </button>
        {tecla("F10", "Vaciar", () => setConfirmarVaciar(true), { deshabilitado: ocupado || !hayItems })}
        <span className="ml-auto text-[11px] text-gray-400 hidden xl:flex items-center gap-2">
          <FaPauseCircle /> ↑↓ elegir línea · Num+ / Num− cantidad · Alt+Retroceso quita la línea
        </span>
      </footer>
      )}

      <VentaModales
        venta={venta}
        verClientes={verClientes}
        nuevoCliente={nuevoCliente}
        verEspera={verEspera}
        cerrarClientes={() => setVerClientes(false)}
        cerrarNuevoCliente={() => setNuevoCliente(false)}
        cerrarEspera={() => setVerEspera(false)}
      />

      {confirmarVaciar && (
        <ConfirmacionModal
          titulo="Vaciar venta"
          textoConfirmar="Vaciar"
          mensaje="¿Quitar todos los productos de esta venta?"
          onConfirm={() => {
            venta.vaciar();
            setConfirmarVaciar(false);
          }}
          onCancel={() => setConfirmarVaciar(false)}
        />
      )}
    </div>,
    document.body
  );
}
