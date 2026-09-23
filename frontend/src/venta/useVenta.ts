import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import type { Cliente, DescuentoOrden, Orden, Servicio } from "@lavanderia/shared/types/types";
import { servicioService } from "../services/serviciosService";
import { ordenesService } from "../services/ordenesService";
import { pagosService } from "../services/pagosService";
import { cajaService } from "../services/cajaService";
import { useConfiguracion, useEtiquetas } from "../context/configuracionCore";
import { normalizarMoneda, type Moneda, type TasasConversion } from "../utils/monedaHelpers";
import { totalesDeSeleccion } from "../utils/totales";

export interface LineaVenta {
  servicio: Servicio;
  cantidad: number;
  /** Precio propio de la línea (facturación); si falta se usa el del catálogo. */
  precio?: number;
}

interface VentaEnEspera {
  id: string;
  etiqueta: string;
  fecha: string;
  cliente: Cliente | null;
  descuento: DescuentoOrden | null;
  lineas: { servicioId: number; cantidad: number; precio?: number }[];
}

const CLAVE_ESPERA = "mostrador.enEspera.v1";
const CLAVE_FRECUENTES = "mostrador.frecuentes.v1";

function leerJson<T>(clave: string, defecto: T): T {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : defecto;
  } catch {
    return defecto;
  }
}

function guardarJson(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: la venta en espera solo dura mientras la pantalla esté abierta */
  }
}

/** "3*7591234" → 3 unidades del código; sin prefijo, 1. */
export function parsearEntrada(texto: string): { cantidad: number; consulta: string } {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*[*x×]\s*(.+)$/i.exec(texto);
  if (!m) return { cantidad: 1, consulta: texto.trim() };
  const n = parseFloat(m[1].replace(",", "."));
  return n > 0 ? { cantidad: n, consulta: m[2].trim() } : { cantidad: 1, consulta: texto.trim() };
}

const coincideExacto = (s: Servicio, q: string) => {
  const v = q.trim().toLowerCase();
  return !!v && [s.codigoBarras, s.sku].some((x) => x && x.toLowerCase() === v);
};

const errorDe = (err: unknown, defecto: string) => (isAxiosError(err) ? err.response?.data?.message ?? defecto : defecto);

/**
 * Lógica compartida de las pantallas de venta directa (caja de minimarket y
 * facturación de repuestos): carrito, cliente, descuento, ventas en espera,
 * cobro completo o rápido en efectivo. Cada pantalla decide cómo se ve.
 */
export function useVenta({ precioEditable = false }: { precioEditable?: boolean } = {}) {
  const { config } = useConfiguracion();
  const et = useEtiquetas();
  const inventario = !!config?.moduloInventario;
  const clienteObligatorio = config?.clienteObligatorio !== false;
  const moneda: Moneda = normalizarMoneda(config?.monedaPrincipal ?? "USD");
  const tasas: TasasConversion = useMemo(() => ({ VES: config?.tasaVES ?? null, COP: config?.tasaCOP ?? null }), [config]);

  const [catalogo, setCatalogo] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState<LineaVenta[]>([]);
  const [seleccion, setSeleccion] = useState(0);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [descuento, setDescuento] = useState<DescuentoOrden | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ordenACobrar, setOrdenACobrar] = useState<Orden | null>(null);
  const [cajaCerrada, setCajaCerrada] = useState(false);
  const [enEspera, setEnEspera] = useState<VentaEnEspera[]>(() => leerJson<VentaEnEspera[]>(CLAVE_ESPERA, []));
  const [ultimaAgregada, setUltimaAgregada] = useState<number | null>(null);
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

  const disponible = useCallback((s: Servicio) => (inventario && s.controlaStock ? s.stockActual : Infinity), [inventario]);
  const enCarrito = (id: number) => carrito.find((l) => l.servicio.id === id)?.cantidad ?? 0;

  const agregar = useCallback(
    (s: Servicio, cantidad = 1) => {
      const yaHay = carrito.find((l) => l.servicio.id === s.id)?.cantidad ?? 0;
      if (yaHay + cantidad > disponible(s)) {
        toast.warning(`Solo hay ${s.stockActual} de "${s.nombreServicio}" en stock.`);
        return false;
      }
      setCarrito((prev) => {
        const existe = prev.find((l) => l.servicio.id === s.id);
        if (existe) return prev.map((l) => (l.servicio.id === s.id ? { ...l, cantidad: l.cantidad + cantidad } : l));
        return [...prev, { servicio: s, cantidad }];
      });
      setUltimaAgregada(s.id);
      // La línea recién tocada queda seleccionada.
      setSeleccion(() => {
        const idx = carrito.findIndex((l) => l.servicio.id === s.id);
        return idx >= 0 ? idx : carrito.length;
      });
      return true;
    },
    [carrito, disponible]
  );

  const cambiarCantidad = (id: number, valor: number) => {
    const linea = carrito.find((l) => l.servicio.id === id);
    if (!linea) return;
    if (valor <= 0) {
      setCarrito((prev) => prev.filter((l) => l.servicio.id !== id));
      setSeleccion((s) => Math.max(0, Math.min(s, carrito.length - 2)));
      return;
    }
    if (valor > disponible(linea.servicio)) {
      toast.warning(`Solo hay ${linea.servicio.stockActual} en stock.`);
      return;
    }
    setCarrito((prev) => prev.map((l) => (l.servicio.id === id ? { ...l, cantidad: valor } : l)));
  };

  const fijarPrecio = (id: number, precio: number | undefined) => {
    if (!precioEditable) return;
    setCarrito((prev) => prev.map((l) => (l.servicio.id === id ? { ...l, precio } : l)));
  };

  const quitar = (id: number) => cambiarCantidad(id, 0);

  /** Busca por código exacto o por nombre; devuelve lo que encontró para que la pantalla decida. */
  const filtrar = useCallback(
    (texto: string, limite = 60) => {
      const q = texto.trim().toLowerCase();
      const lista = q
        ? catalogo.filter(
            (s) =>
              s.nombreServicio.toLowerCase().includes(q) ||
              (s.sku ?? "").toLowerCase().includes(q) ||
              (s.codigoBarras ?? "").toLowerCase().includes(q) ||
              (s.descripcion ?? "").toLowerCase().includes(q)
          )
        : catalogo;
      return lista.slice(0, limite);
    },
    [catalogo]
  );

  /** Enter en el buscador: código exacto o único resultado. Acepta "3*código". */
  const agregarPorTexto = (texto: string, candidatos: Servicio[]) => {
    const { cantidad, consulta } = parsearEntrada(texto);
    if (!consulta) return false;
    const exacto = catalogo.find((s) => coincideExacto(s, consulta));
    const filtrados = exacto ? [exacto] : filtrar(consulta);
    const elegido = exacto ?? (filtrados.length === 1 ? filtrados[0] : candidatos.length > 0 ? candidatos[0] : undefined);
    if (!elegido) {
      toast.info(filtrados.length === 0 ? "No se encontró ese código o nombre." : "Elige uno de la lista.");
      return false;
    }
    return agregar(elegido, cantidad);
  };

  const lineasSeleccion = useMemo(
    () => carrito.map((l) => ({ servicioId: l.servicio.id, cantidad: l.cantidad, precio: l.precio })),
    [carrito]
  );
  const totales = useMemo(
    () => totalesDeSeleccion(lineasSeleccion, carrito.map((l) => l.servicio), config, descuento),
    [lineasSeleccion, carrito, config, descuento]
  );

  const vaciar = useCallback(() => {
    setCarrito([]);
    setCliente(null);
    setDescuento(null);
    setSeleccion(0);
    setUltimaAgregada(null);
  }, []);

  const registrarFrecuentes = () => {
    const mapa = leerJson<Record<string, number>>(CLAVE_FRECUENTES, {});
    for (const l of carrito) mapa[l.servicio.id] = (mapa[l.servicio.id] ?? 0) + 1;
    guardarJson(CLAVE_FRECUENTES, mapa);
  };

  /** Los productos que más se venden en este equipo, para tenerlos a un toque. */
  const frecuentes = useMemo(() => {
    const mapa = leerJson<Record<string, number>>(CLAVE_FRECUENTES, {});
    return catalogo
      .filter((s) => mapa[s.id])
      .sort((a, b) => (mapa[b.id] ?? 0) - (mapa[a.id] ?? 0))
      .slice(0, 18);
    // Se recalcula al cargar el catálogo y tras cada venta (ordenACobrar cambia).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo, ordenACobrar]);

  const crearOrden = async (): Promise<Orden | null> => {
    if (carrito.length === 0) {
      toast.error("Agrega al menos un producto.");
      return null;
    }
    if (!cliente && clienteObligatorio) {
      toast.error(`Selecciona un ${et.clienteMin}.`);
      return null;
    }
    setGuardando(true);
    try {
      const res = await ordenesService.create({
        clienteId: cliente?.id ?? null,
        entregaInmediata: true,
        estado: "PENDIENTE",
        descuento: descuento && descuento.valor > 0 ? descuento : null,
        servicios: carrito.map((l) => ({
          servicioId: l.servicio.id,
          cantidad: l.cantidad,
          ...(precioEditable && l.precio !== undefined ? { precio: l.precio } : {}),
        })),
      });
      return res.data;
    } catch (err) {
      toast.error(errorDe(err, "No se pudo registrar la venta."));
      return null;
    } finally {
      setGuardando(false);
    }
  };

  /** Cobro completo: abre el modal de pago (varias monedas, vueltos, métodos). */
  const cobrar = async () => {
    const orden = await crearOrden();
    if (!orden) return;
    setOrdenACobrar(orden);
    cargar();
  };

  /** Efectivo exacto en moneda principal: una tecla y se despacha. */
  const cobroRapidoEfectivo = async () => {
    const orden = await crearOrden();
    if (!orden) return;
    setGuardando(true);
    try {
      if (orden.total > 0) {
        await pagosService.create({ ordenId: orden.id, monto: orden.total, moneda, metodoPago: "EFECTIVO" });
      }
      registrarFrecuentes();
      toast.success(`${et.orden} #${orden.id} cobrada en efectivo.`);
      vaciar();
      cargar();
    } catch (err) {
      // La venta ya existe: se ofrece cobrarla por el camino normal.
      toast.error(errorDe(err, "No se pudo registrar el pago."));
      setOrdenACobrar(orden);
      cargar();
    } finally {
      setGuardando(false);
    }
  };

  const cerrarCobro = () => {
    if (!ordenACobrar) return;
    if (cobradaRef.current) registrarFrecuentes();
    else toast.info(`${et.orden} #${ordenACobrar.id} guardada sin cobrar. Puedes cobrarla desde ${et.ordenes}.`);
    cobradaRef.current = false;
    setOrdenACobrar(null);
    vaciar();
  };

  const marcarCobrada = () => {
    cobradaRef.current = true;
    if (ordenACobrar) toast.success(`${et.orden} #${ordenACobrar.id} cobrada.`);
  };

  // --- Ventas en espera / cotizaciones ---
  const persistirEspera = (lista: VentaEnEspera[]) => {
    setEnEspera(lista);
    guardarJson(CLAVE_ESPERA, lista);
  };

  const ponerEnEspera = (etiqueta?: string) => {
    if (carrito.length === 0) {
      toast.info("No hay nada que dejar en espera.");
      return false;
    }
    const nueva: VentaEnEspera = {
      id: `${Date.now()}`,
      etiqueta: etiqueta?.trim() || cliente?.nombre || `Venta ${enEspera.length + 1}`,
      fecha: new Date().toISOString(),
      cliente,
      descuento,
      lineas: carrito.map((l) => ({ servicioId: l.servicio.id, cantidad: l.cantidad, precio: l.precio })),
    };
    persistirEspera([nueva, ...enEspera]);
    vaciar();
    return true;
  };

  const recuperar = (id: string) => {
    const v = enEspera.find((e) => e.id === id);
    if (!v) return;
    const lineas: LineaVenta[] = [];
    let faltantes = 0;
    for (const l of v.lineas) {
      const s = catalogo.find((x) => x.id === l.servicioId);
      if (!s) {
        faltantes += 1;
        continue;
      }
      lineas.push({ servicio: s, cantidad: Math.min(l.cantidad, disponible(s)), precio: l.precio });
    }
    if (faltantes > 0) toast.warning(`${faltantes} artículo(s) ya no existen y se omitieron.`);
    setCarrito(lineas.filter((l) => l.cantidad > 0));
    setCliente(v.cliente);
    setDescuento(v.descuento);
    setSeleccion(0);
    persistirEspera(enEspera.filter((e) => e.id !== id));
  };

  const descartarEspera = (id: string) => persistirEspera(enEspera.filter((e) => e.id !== id));

  return {
    config,
    et,
    moneda,
    tasas,
    inventario,
    clienteObligatorio,
    catalogo,
    cargando,
    carrito,
    seleccion,
    setSeleccion,
    cliente,
    setCliente,
    descuento,
    setDescuento,
    guardando,
    ordenACobrar,
    cajaCerrada,
    enEspera,
    ultimaAgregada,
    totales,
    frecuentes,
    disponible,
    enCarrito,
    agregar,
    agregarPorTexto,
    cambiarCantidad,
    fijarPrecio,
    quitar,
    filtrar,
    vaciar,
    cobrar,
    cobroRapidoEfectivo,
    cerrarCobro,
    marcarCobrada,
    ponerEnEspera,
    recuperar,
    descartarEspera,
    recargar: cargar,
  };
}

export type VentaApi = ReturnType<typeof useVenta>;
