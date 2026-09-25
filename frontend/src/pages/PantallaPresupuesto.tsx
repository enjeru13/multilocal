import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import {
  FaArrowLeft,
  FaCheck,
  FaEllipsisH,
  FaExchangeAlt,
  FaFileSignature,
  FaPlus,
  FaPrint,
  FaSave,
  FaSearch,
  FaTimes,
  FaTrashAlt,
  FaUser,
  FaUserPlus,
  FaWhatsapp,
} from "react-icons/fa";
import type { Cliente, ClienteCreate, DescuentoOrden, EstadoPresupuesto, Presupuesto, PresupuestoInput } from "@lavanderia/shared/types/types";
import { calcularTotales, r2 } from "@lavanderia/shared/utils/totales";
import { presupuestosService } from "../services/presupuestosService";
import { servicioService, type ServicioConCategoria } from "../services/serviciosService";
import { clientesService } from "../services/clientesService";
import { convertirDesdePrincipal, formatearMoneda, normalizarMoneda } from "../utils/monedaHelpers";
import { opcionesDeConfig } from "../utils/totales";
import { enlaceWhatsAppPresupuesto, telefonoPresupuesto } from "../utils/presupuestoHelpers";
import { useConfiguracion } from "../context/configuracionCore";
import { useMonedas } from "../context/useMonedas";
import { useEsCompacto } from "../hooks/useMediaQuery";
import Button from "../components/ui/Button";
import { campo } from "../components/ui/Formulario";
import { CampoMontoNumero } from "../components/ui/CampoMonto";
import DescuentoControl from "../components/venta/DescuentoControl";
import DesgloseTotales from "../components/venta/DesgloseTotales";
import EtiquetaEstado from "../components/presupuesto/EtiquetaEstado";
import ListaClientesModal from "../components/modal/ListaClientesModal";
import FormularioCliente from "../components/formulario/FormularioCliente";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import ImprimirPresupuesto from "../impresion/informes/InformePresupuesto";
import { FormSkeleton } from "../components/Skeleton";

interface LineaForm {
  key: number;
  servicioId: number | null;
  descripcion: string;
  cantidad: string;
  precio: number | null;
  exento: boolean;
}

const tarjeta = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";
const etiqueta = "block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5";
const celdaNumero = `${campo} text-right tabular-nums`;

let contadorLineas = 0;
const nuevaKey = () => ++contadorLineas;

const cantidadNum = (t: string) => {
  const n = parseFloat(t.replace(",", "."));
  return isNaN(n) ? 0 : n;
};

export default function PantallaPresupuesto() {
  const { id } = useParams();
  const idNum = id ? Number(id) : null;
  const navigate = useNavigate();
  const { config } = useConfiguracion();
  const negocio = useMonedas();
  const compacto = useEsCompacto();
  const moneda = normalizarMoneda(config?.monedaPrincipal ?? "USD");

  const [cargando, setCargando] = useState(!!idNum);
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [catalogo, setCatalogo] = useState<ServicioConCategoria[]>([]);

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [validoHasta, setValidoHasta] = useState(() => dayjs().add(15, "day").format("YYYY-MM-DD"));
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [descuento, setDescuento] = useState<DescuentoOrden | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [condiciones, setCondiciones] = useState("");
  const [guardadoComo, setGuardadoComo] = useState<string | null>(null);

  const [buscar, setBuscar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [verClientes, setVerClientes] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [imprimir, setImprimir] = useState(false);
  const [confirmar, setConfirmar] = useState<null | "convertir" | "eliminar">(null);
  const [elegirParaConvertir, setElegirParaConvertir] = useState(false);

  const bloqueado = presupuesto?.estado === "CONVERTIDO";
  const clienteObligatorio = config?.clienteObligatorio !== false;

  useEffect(() => {
    servicioService.getAll().then((r) => setCatalogo(r.data)).catch(() => toast.error("No se pudo cargar el catálogo."));
  }, []);

  // Validez y condiciones por defecto en un presupuesto nuevo, cuando llega la configuración.
  useEffect(() => {
    if (idNum || !config) return;
    setValidoHasta(dayjs().add(config.presupuestoValidezDias ?? 15, "day").format("YYYY-MM-DD"));
    setCondiciones(config.presupuestoCondiciones ?? "");
  }, [idNum, config]);

  const aplicar = useCallback((p: Presupuesto) => {
    setPresupuesto(p);
    setCliente(p.cliente ? ({ ...p.cliente, tipo: null, direccion: p.cliente.direccion ?? null, email: p.cliente.email ?? null, telefono: p.cliente.telefono ?? null } as unknown as Cliente) : null);
    setContactoNombre(p.contactoNombre ?? "");
    setContactoTelefono(p.contactoTelefono ?? "");
    setValidoHasta(dayjs(p.validoHasta).format("YYYY-MM-DD"));
    setLineas(
      (p.detalles ?? []).map((d) => ({
        key: nuevaKey(),
        servicioId: d.servicioId,
        descripcion: d.descripcion,
        cantidad: String(d.cantidad),
        precio: d.precioUnit,
        exento: d.exento,
      }))
    );
    setDescuento(p.descuento > 0 && p.descuentoTipo && p.descuentoValor ? { tipo: p.descuentoTipo, valor: p.descuentoValor } : null);
    setObservaciones(p.observaciones ?? "");
    setCondiciones(p.condiciones ?? "");
  }, []);

  useEffect(() => {
    if (!idNum) return;
    setCargando(true);
    presupuestosService
      .getById(idNum)
      .then((r) => aplicar(r.data))
      .catch((err) => {
        toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo cargar el presupuesto." : "No se pudo cargar el presupuesto.");
        navigate("/presupuestos", { replace: true });
      })
      .finally(() => setCargando(false));
  }, [idNum, aplicar, navigate]);

  const totales = useMemo(
    () =>
      calcularTotales(
        lineas.map((l) => ({ subtotal: r2((l.precio ?? 0) * cantidadNum(l.cantidad)), exento: l.exento })),
        opcionesDeConfig(config, descuento)
      ),
    [lineas, config, descuento]
  );

  // Lo que se enviaría al guardar; sirve también para saber si hay cambios sin guardar.
  const datos: PresupuestoInput = useMemo(
    () => ({
      clienteId: cliente?.id ?? null,
      contactoNombre: cliente ? null : contactoNombre.trim() || null,
      contactoTelefono: cliente ? null : contactoTelefono.trim() || null,
      validoHasta,
      observaciones: observaciones.trim() || null,
      condiciones: condiciones.trim() || null,
      descuento: descuento && descuento.valor > 0 ? descuento : null,
      lineas: lineas.map((l) => ({ servicioId: l.servicioId, descripcion: l.descripcion.trim(), cantidad: cantidadNum(l.cantidad), precio: l.precio ?? 0, exento: l.exento })),
    }),
    [cliente, contactoNombre, contactoTelefono, validoHasta, observaciones, condiciones, descuento, lineas]
  );
  const instantanea = JSON.stringify(datos);
  const sucio = !presupuesto || instantanea !== guardadoComo;

  // Al cargar o guardar, lo que hay en pantalla pasa a ser "lo guardado".
  useEffect(() => {
    if (presupuesto) setGuardadoComo(JSON.stringify(datosDePresupuesto(presupuesto)));
  }, [presupuesto]);

  const resultados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return [];
    return catalogo
      .filter((s) => s.nombreServicio.toLowerCase().includes(q) || (s.sku ?? "").toLowerCase().includes(q) || (s.codigoBarras ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [buscar, catalogo]);

  const agregarDelCatalogo = (s: ServicioConCategoria) => {
    setLineas((prev) => {
      const existe = prev.find((l) => l.servicioId === s.id);
      if (existe) return prev.map((l) => (l.key === existe.key ? { ...l, cantidad: String(cantidadNum(l.cantidad) + 1) } : l));
      return [...prev, { key: nuevaKey(), servicioId: s.id, descripcion: s.nombreServicio, cantidad: "1", precio: s.precioBase, exento: s.exentoImpuesto }];
    });
    setBuscar("");
  };

  const agregarLibre = () => setLineas((prev) => [...prev, { key: nuevaKey(), servicioId: null, descripcion: "", cantidad: "1", precio: null, exento: false }]);
  const cambiarLinea = (key: number, parche: Partial<LineaForm>) => setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...parche } : l)));
  const quitarLinea = (key: number) => setLineas((prev) => prev.filter((l) => l.key !== key));

  const mensajeError = (err: unknown, defecto: string) => (isAxiosError(err) ? err.response?.data?.message ?? defecto : defecto);

  const validar = (): string | null => {
    if (!cliente && !contactoNombre.trim()) return "Elige un cliente o escribe el nombre de a quién va dirigido.";
    if (lineas.length === 0) return "Agrega al menos un producto o servicio.";
    if (lineas.some((l) => !l.servicioId && !l.descripcion.trim())) return "Escribe la descripción de cada línea libre.";
    if (lineas.some((l) => cantidadNum(l.cantidad) <= 0)) return "Cada línea necesita una cantidad mayor que cero.";
    if (lineas.some((l) => l.precio === null)) return "Falta el precio de alguna línea.";
    if (!validoHasta) return "Indica hasta cuándo es válido el presupuesto.";
    return null;
  };

  const guardar = async (): Promise<Presupuesto | null> => {
    const problema = validar();
    if (problema) {
      toast.error(problema);
      return null;
    }
    setGuardando(true);
    try {
      if (presupuesto) {
        const res = await presupuestosService.update(presupuesto.id, datos);
        aplicar(res.data);
        toast.success("Presupuesto guardado.");
        return res.data;
      }
      const res = await presupuestosService.create(datos);
      toast.success(`Presupuesto N.º ${res.data.id} creado.`);
      navigate(`/presupuestos/${res.data.id}`, { replace: true });
      return res.data;
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo guardar el presupuesto."));
      return null;
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (estado: Exclude<EstadoPresupuesto, "CONVERTIDO">) => {
    if (!presupuesto) return;
    setTrabajando(true);
    try {
      const res = await presupuestosService.cambiarEstado(presupuesto.id, estado);
      setPresupuesto(res.data);
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cambiar el estado."));
    } finally {
      setTrabajando(false);
    }
  };

  const enviarWhatsApp = async () => {
    if (!presupuesto) return;
    const enlace = enlaceWhatsAppPresupuesto(presupuesto, config?.nombreNegocio || "nuestro negocio", moneda);
    if (!enlace) {
      toast.error("Falta un teléfono válido del cliente para enviarlo por WhatsApp.");
      return;
    }
    window.open(enlace, "_blank", "noopener");
    if (presupuesto.estado === "BORRADOR") await cambiarEstado("ENVIADO");
  };

  const convertir = async (clienteId?: number) => {
    if (!presupuesto) return;
    setTrabajando(true);
    try {
      const res = await presupuestosService.convertir(presupuesto.id, clienteId);
      setPresupuesto(res.data.presupuesto);
      toast.success(`Presupuesto convertido en la venta #${res.data.ordenId}.`);
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo convertir el presupuesto en venta."));
    } finally {
      setTrabajando(false);
    }
  };

  const pedirConvertir = () => {
    if (!presupuesto) return;
    if (!presupuesto.clienteId && clienteObligatorio) {
      setElegirParaConvertir(true);
      return;
    }
    setConfirmar("convertir");
  };

  const eliminar = async () => {
    if (!presupuesto) return;
    try {
      await presupuestosService.eliminar(presupuesto.id);
      toast.success("Presupuesto eliminado.");
      navigate("/presupuestos", { replace: true });
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo eliminar el presupuesto."));
    }
  };

  if (cargando) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }

  const guardado = !sucio;
  const puedeConvertir = !!presupuesto && guardado && !bloqueado && presupuesto.estado !== "RECHAZADO";
  const telefono = presupuesto ? telefonoPresupuesto(presupuesto) : null;

  const acciones: { id: string; texto: string; icono?: React.ReactNode; accion: () => void; mostrar: boolean; peligro?: boolean }[] = [
    { id: "enviado", texto: "Marcar como enviado", accion: () => cambiarEstado("ENVIADO"), mostrar: !!presupuesto && !bloqueado && presupuesto.estado !== "ENVIADO" },
    { id: "aceptado", texto: "Marcar como aceptado", accion: () => cambiarEstado("ACEPTADO"), mostrar: !!presupuesto && !bloqueado && presupuesto.estado !== "ACEPTADO" },
    { id: "rechazado", texto: "Marcar como rechazado", accion: () => cambiarEstado("RECHAZADO"), mostrar: !!presupuesto && !bloqueado && presupuesto.estado !== "RECHAZADO" },
    { id: "borrador", texto: "Volver a borrador", accion: () => cambiarEstado("BORRADOR"), mostrar: !!presupuesto && !bloqueado && presupuesto.estado !== "BORRADOR" },
    { id: "eliminar", texto: "Eliminar presupuesto", icono: <FaTrashAlt />, accion: () => setConfirmar("eliminar"), mostrar: !!presupuesto && !bloqueado, peligro: true },
  ];

  const panelTotales = (
    <div className={`${tarjeta} p-4 sm:p-5 space-y-4`}>
      <DesgloseTotales totales={totales} moneda={moneda} tamano="lg" />
      {negocio.otrasUsables.map((m) => (
        <p key={m} className="text-right text-xs text-gray-500 dark:text-gray-400">
          {formatearMoneda(convertirDesdePrincipal(totales.total, m, negocio.tasas, moneda), m)}
        </p>
      ))}

      <div className="space-y-2 max-lg:hidden">
        {!bloqueado && (
          <Button className="w-full" size="lg" variant="primary" onClick={guardar} isLoading={guardando} disabled={guardando || (!sucio && !!presupuesto)} leftIcon={<FaSave />}>
            {presupuesto ? "Guardar cambios" : "Guardar presupuesto"}
          </Button>
        )}
        {puedeConvertir && (
          <Button className="w-full" size="lg" variant="whatsapp" onClick={pedirConvertir} isLoading={trabajando} leftIcon={<FaExchangeAlt />}>
            Convertir en venta
          </Button>
        )}
        {presupuesto && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setImprimir(true)} disabled={!guardado} leftIcon={<FaPrint />}>
              Imprimir
            </Button>
            <Button variant="secondary" onClick={enviarWhatsApp} disabled={!guardado || !telefono} leftIcon={<FaWhatsapp />} title={telefono ? undefined : "Falta un teléfono"}>
              WhatsApp
            </Button>
          </div>
        )}
        {presupuesto && !guardado && !bloqueado && <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">Guarda los cambios para imprimir, enviar o convertir.</p>}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to="/presupuestos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 mb-1">
            <FaArrowLeft size={11} /> Presupuestos
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1">
            <FaFileSignature className="text-blue-600 dark:text-blue-400" />
            {presupuesto ? `Presupuesto N.º ${presupuesto.id}` : "Nuevo presupuesto"}
            {presupuesto && <EtiquetaEstado p={presupuesto} />}
          </h1>
          {presupuesto && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Emitido el {dayjs(presupuesto.fecha).format("DD/MM/YYYY")}
              {presupuesto.userName ? ` por ${presupuesto.userName}` : ""}
            </p>
          )}
        </div>

        {presupuesto && acciones.some((a) => a.mostrar) && (
          <Menu as="div" className="relative">
            <MenuButton className="inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <FaEllipsisH /> Más
            </MenuButton>
            <MenuItems anchor="bottom end" className="z-60 mt-2 w-64 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1 focus:outline-none">
              {acciones
                .filter((a) => a.mostrar)
                .map((a) => (
                  <MenuItem key={a.id}>
                    <button
                      type="button"
                      onClick={a.accion}
                      disabled={trabajando}
                      className={`w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-sm data-focus:bg-gray-100 dark:data-focus:bg-gray-800 cursor-pointer ${a.peligro ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-100"}`}
                    >
                      {a.icono}
                      {a.texto}
                    </button>
                  </MenuItem>
                ))}
            </MenuItems>
          </Menu>
        )}
      </header>

      {bloqueado && presupuesto?.ordenId && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-4 py-3 text-sm text-violet-900 dark:text-violet-200 flex flex-wrap items-center justify-between gap-2">
          <span>Este presupuesto ya se convirtió en la venta #{presupuesto.ordenId}. Ya no se puede modificar.</span>
          <Link to="/ordenes" className="font-semibold underline">
            Ver ventas
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* Cliente */}
          <section className={`${tarjeta} p-4 sm:p-5 space-y-4`}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">¿Para quién es?</h2>
            {cliente ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200 truncate flex items-center gap-2">
                    <FaUser className="shrink-0" /> {`${cliente.nombre} ${cliente.apellido ?? ""}`.trim()}
                  </p>
                  {(cliente.telefono || cliente.identificacion) && <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 truncate">{[cliente.identificacion, cliente.telefono].filter(Boolean).join(" · ")}</p>}
                </div>
                {!bloqueado && (
                  <button type="button" onClick={() => setCliente(null)} className="shrink-0 p-2 text-emerald-800 dark:text-emerald-300 hover:text-red-600 cursor-pointer" title="Quitar cliente" aria-label="Quitar cliente">
                    <FaTimes />
                  </button>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={etiqueta}>Nombre</label>
                  <input className={campo} value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} placeholder="Persona o empresa" disabled={bloqueado} />
                </div>
                <div>
                  <label className={etiqueta}>Teléfono (para WhatsApp)</label>
                  <input className={campo} type="tel" value={contactoTelefono} onChange={(e) => setContactoTelefono(e.target.value)} placeholder="0414-1234567" disabled={bloqueado} />
                </div>
              </div>
            )}
            {!bloqueado && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" leftIcon={<FaUser />} onClick={() => setVerClientes(true)}>
                  {cliente ? "Cambiar cliente" : "Elegir cliente registrado"}
                </Button>
                {!cliente && (
                  <Button variant="secondary" size="sm" leftIcon={<FaUserPlus />} onClick={() => setNuevoCliente(true)}>
                    Registrar cliente nuevo
                  </Button>
                )}
              </div>
            )}
            {!cliente && <p className="text-xs text-gray-400">Puedes cotizarle a alguien sin registrarlo; para convertirlo en venta se le pedirá una ficha si tu negocio la exige.</p>}
          </section>

          {/* Líneas */}
          <section className={`${tarjeta} p-4 sm:p-5 space-y-4`}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Qué se cotiza</h2>

            {!bloqueado && (
              <div className="space-y-2">
                <div className="relative">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input className={`${campo} pl-10`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Busca en tu catálogo por nombre o código" />
                  {resultados.length > 0 && (
                    <ul className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                      {resultados.map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => agregarDelCatalogo(s)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer">
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.nombreServicio}</span>
                              {(s.sku || s.codigoBarras) && <span className="block text-xs text-gray-500 truncate">{s.sku || s.codigoBarras}</span>}
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-400 shrink-0">{formatearMoneda(s.precioBase, moneda)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {buscar.trim() && resultados.length === 0 && (
                    <p className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg px-4 py-3 text-sm text-gray-500">Nada coincide. Puedes agregar una línea libre.</p>
                  )}
                </div>
                <Button variant="outline" size="sm" leftIcon={<FaPlus />} onClick={agregarLibre}>
                  Agregar línea libre<span className="max-sm:hidden"> (instalación, mano de obra, traslado…)</span>
                </Button>
              </div>
            )}

            {lineas.length === 0 ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8 italic rounded-lg border border-dashed border-gray-300 dark:border-gray-700">Aún no hay nada en el presupuesto.</p>
            ) : (
              <ul className="space-y-3">
                <li className="hidden sm:grid grid-cols-[1fr_5.5rem_9rem_8rem_2.25rem] gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <span>Descripción</span>
                  <span className="text-right">Cant.</span>
                  <span className="text-right">Precio</span>
                  <span className="text-right">Importe</span>
                  <span />
                </li>
                {lineas.map((l) => {
                  const importe = r2((l.precio ?? 0) * cantidadNum(l.cantidad));
                  return (
                    <li key={l.key} className="grid grid-cols-2 sm:grid-cols-[1fr_5.5rem_9rem_8rem_2.25rem] gap-2 items-center rounded-lg border border-gray-200 dark:border-gray-800 sm:border-0 p-3 sm:p-0">
                      <div className="col-span-2 sm:col-span-1 min-w-0">
                        <input
                          className={campo}
                          value={l.descripcion}
                          onChange={(e) => cambiarLinea(l.key, { descripcion: e.target.value })}
                          placeholder="Descripción"
                          maxLength={200}
                          disabled={bloqueado}
                          aria-label="Descripción"
                        />
                        {(l.exento || !l.servicioId) && (
                          <label className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                            {l.servicioId ? (
                              <span>Exento de impuesto</span>
                            ) : (
                              <>
                                <input type="checkbox" checked={l.exento} onChange={(e) => cambiarLinea(l.key, { exento: e.target.checked })} disabled={bloqueado} className="accent-blue-600" />
                                Exento de impuesto
                              </>
                            )}
                          </label>
                        )}
                      </div>
                      <input
                        className={celdaNumero}
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={l.cantidad}
                        onChange={(e) => cambiarLinea(l.key, { cantidad: e.target.value })}
                        disabled={bloqueado}
                        aria-label="Cantidad"
                      />
                      <CampoMontoNumero moneda={moneda} valor={l.precio} onValor={(v) => cambiarLinea(l.key, { precio: v })} className={celdaNumero} disabled={bloqueado} aria-label="Precio" placeholder="0,00" />
                      <p className="sm:text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100 max-sm:col-span-1">{formatearMoneda(importe, moneda)}</p>
                      {!bloqueado ? (
                        <button type="button" onClick={() => quitarLinea(l.key)} className="justify-self-end w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer" title="Quitar" aria-label="Quitar línea">
                          <FaTrashAlt />
                        </button>
                      ) : (
                        <span />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
              <DescuentoControl value={descuento} onChange={setDescuento} disabled={bloqueado || lineas.length === 0} />
            </div>
          </section>

          {/* Validez y textos */}
          <section className={`${tarjeta} p-4 sm:p-5 space-y-4`}>
            <div className="grid sm:grid-cols-[12rem_1fr] gap-4">
              <div>
                <label className={etiqueta}>Válido hasta</label>
                <input className={campo} type="date" value={validoHasta} min={presupuesto ? undefined : dayjs().format("YYYY-MM-DD")} onChange={(e) => setValidoHasta(e.target.value)} disabled={bloqueado} />
              </div>
              <div>
                <label className={etiqueta}>Notas para el cliente (salen en el presupuesto)</label>
                <textarea className={`${campo} h-auto py-2`} rows={2} maxLength={2000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej. Incluye instalación y traslado dentro de la ciudad." disabled={bloqueado} />
              </div>
            </div>
            <div>
              <label className={etiqueta}>Condiciones</label>
              <textarea className={`${campo} h-auto py-2`} rows={3} maxLength={2000} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} placeholder="Ej. 50 % de anticipo. Garantía de instalación de 3 meses." disabled={bloqueado} />
              <p className="text-xs text-gray-400 mt-1">Tu texto habitual se define en Configuración → Presupuestos.</p>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-4 space-y-4">{panelTotales}</aside>
      </div>

      {compacto && !bloqueado && (
        <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-4 px-4 sm:px-6 pt-2.5 pb-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-xl font-extrabold tabular-nums leading-tight">{formatearMoneda(totales.total, moneda)}</p>
          </div>
          {puedeConvertir && (
            <Button variant="whatsapp" onClick={pedirConvertir} isLoading={trabajando} aria-label="Convertir en venta" title="Convertir en venta">
              <FaExchangeAlt />
            </Button>
          )}
          {presupuesto && guardado && (
            <>
              <Button variant="secondary" onClick={() => setImprimir(true)} aria-label="Imprimir" title="Imprimir">
                <FaPrint />
              </Button>
              <Button variant="secondary" onClick={enviarWhatsApp} disabled={!telefono} aria-label="Enviar por WhatsApp" title="Enviar por WhatsApp">
                <FaWhatsapp />
              </Button>
            </>
          )}
          <Button variant="primary" size="lg" onClick={guardar} isLoading={guardando} disabled={guardando || (!sucio && !!presupuesto)} leftIcon={<FaCheck />}>
            Guardar
          </Button>
        </div>
      )}

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
      {elegirParaConvertir && (
        <ListaClientesModal
          onClose={() => setElegirParaConvertir(false)}
          onSelect={(c) => {
            setElegirParaConvertir(false);
            convertir(c.id);
          }}
        />
      )}
      {confirmar === "convertir" && (
        <ConfirmacionModal
          titulo="Convertir en venta"
          mensaje={`Se creará una venta por ${formatearMoneda(totales.total, moneda)} con las líneas de este presupuesto. Las líneas libres pasarán a tu catálogo de servicios.`}
          textoConfirmar="Convertir"
          onCancel={() => setConfirmar(null)}
          onConfirm={() => {
            setConfirmar(null);
            convertir();
          }}
        />
      )}
      {confirmar === "eliminar" && (
        <ConfirmacionModal titulo="Eliminar presupuesto" mensaje={`Se borrará el presupuesto N.º ${presupuesto?.id}. Esto no se puede deshacer.`} textoConfirmar="Eliminar" onCancel={() => setConfirmar(null)} onConfirm={() => { setConfirmar(null); eliminar(); }} />
      )}

      <ImprimirPresupuesto open={imprimir} onClose={() => setImprimir(false)} presupuesto={presupuesto} />
    </div>
  );
}

/** Lo que el formulario enviaría para un presupuesto ya guardado (para detectar cambios sin guardar). */
function datosDePresupuesto(p: Presupuesto): PresupuestoInput {
  return {
    clienteId: p.clienteId,
    contactoNombre: p.clienteId ? null : p.contactoNombre?.trim() || null,
    contactoTelefono: p.clienteId ? null : p.contactoTelefono?.trim() || null,
    validoHasta: dayjs(p.validoHasta).format("YYYY-MM-DD"),
    observaciones: p.observaciones?.trim() || null,
    condiciones: p.condiciones?.trim() || null,
    descuento: p.descuento > 0 && p.descuentoTipo && p.descuentoValor ? { tipo: p.descuentoTipo, valor: p.descuentoValor } : null,
    lineas: (p.detalles ?? []).map((d) => ({ servicioId: d.servicioId, descripcion: d.descripcion.trim(), cantidad: d.cantidad, precio: d.precioUnit, exento: d.exento })),
  };
}
