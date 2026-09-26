import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useReactToPrint } from "react-to-print";
import { FaArrowLeft, FaBarcode, FaPrint, FaSearch } from "react-icons/fa";
import { servicioService, type ServicioConCategoria } from "../services/serviciosService";
import { formatearMoneda, normalizarMoneda } from "../utils/monedaHelpers";
import { codigoDeProducto, FORMATOS_ETIQUETA, type FormatoEtiqueta } from "../utils/etiquetas";
import { MM_A_PX } from "../impresion/preferencias";
import { useConfiguracion, useEtiquetas } from "../context/configuracionCore";
import Button from "../components/ui/Button";
import Interruptor from "../components/ui/Interruptor";
import Etiqueta from "../components/etiquetas/Etiqueta";
import { TableSkeleton } from "../components/Skeleton";

const CLAVE = "mostrador.etiquetas";
const MAX_COPIAS = 500;
const tarjeta = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";

interface Preferencias {
  formato: string;
  precio: boolean;
  negocio: boolean;
}

function leerPreferencias(): Preferencias {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? "{}") as Partial<Preferencias>;
    return {
      formato: FORMATOS_ETIQUETA.some((f) => f.id === p.formato) ? p.formato! : FORMATOS_ETIQUETA[1].id,
      precio: p.precio ?? true,
      negocio: p.negocio ?? false,
    };
  } catch {
    return { formato: FORMATOS_ETIQUETA[1].id, precio: true, negocio: false };
  }
}

const plano = (t: string | null | undefined) => (t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Etiquetas con código de barras para los productos: se eligen, se ve cómo quedan y se imprimen. */
export default function PantallaEtiquetas() {
  const et = useEtiquetas();
  const { config } = useConfiguracion();
  const moneda = normalizarMoneda(config?.monedaPrincipal ?? "USD");
  const inventario = !!config?.moduloInventario;

  const [productos, setProductos] = useState<ServicioConCategoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [copias, setCopias] = useState<Record<number, number>>({});
  const [prefs, setPrefs] = useState<Preferencias>(leerPreferencias);
  const impresion = useRef<HTMLDivElement>(null);

  useEffect(() => {
    servicioService
      .getAll()
      .then((r) => setProductos(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error("No se pudo cargar el catálogo."))
      .finally(() => setCargando(false));
  }, []);

  const cambiarPrefs = (cambio: Partial<Preferencias>) => {
    const nuevo = { ...prefs, ...cambio };
    setPrefs(nuevo);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(nuevo));
    } catch {
      /* sin almacenamiento */
    }
  };

  const formato: FormatoEtiqueta = FORMATOS_ETIQUETA.find((f) => f.id === prefs.formato) ?? FORMATOS_ETIQUETA[1];

  const visibles = useMemo(() => {
    const q = plano(buscar.trim());
    return productos.filter((p) => !q || plano(p.nombreServicio).includes(q) || plano(p.sku).includes(q) || plano(p.codigoBarras).includes(q));
  }, [productos, buscar]);
  const conCodigo = (p: ServicioConCategoria) => codigoDeProducto(p) !== "";

  const marcar = (id: number, marcado: boolean) =>
    setCopias((c) => {
      const n = { ...c };
      if (marcado) n[id] = n[id] ?? 1;
      else delete n[id];
      return n;
    });

  const marcarVisibles = () =>
    setCopias((c) => {
      const n = { ...c };
      for (const p of visibles) if (conCodigo(p)) n[p.id] = n[p.id] ?? 1;
      return n;
    });

  const copiasComoExistencias = () =>
    setCopias((c) => {
      const n = { ...c };
      for (const p of productos) if (n[p.id] !== undefined && p.controlaStock) n[p.id] = Math.min(MAX_COPIAS, Math.max(1, Math.round(p.stockActual)));
      return n;
    });

  // Una etiqueta por copia.
  const etiquetas = useMemo(() => {
    const lista: { clave: string; nombre: string; codigo: string; precio?: string }[] = [];
    for (const p of productos) {
      const n = copias[p.id];
      if (!n || !conCodigo(p)) continue;
      for (let i = 0; i < n; i++) {
        lista.push({ clave: `${p.id}-${i}`, nombre: p.nombreServicio, codigo: codigoDeProducto(p), precio: prefs.precio ? formatearMoneda(p.precioBase, moneda) : undefined });
      }
    }
    return lista;
  }, [productos, copias, prefs.precio, moneda]);

  const seleccionados = Object.keys(copias).length;

  // En hoja, las etiquetas se reparten en páginas A4 completas; en rollo, cada una es su propia página.
  const paginas = useMemo(() => {
    if (formato.tipo === "rollo") return [];
    const porHoja = (formato.columnas ?? 1) * (formato.filas ?? 1);
    const hojas: (typeof etiquetas)[] = [];
    for (let i = 0; i < etiquetas.length; i += porHoja) hojas.push(etiquetas.slice(i, i + porHoja));
    return hojas;
  }, [etiquetas, formato]);

  const pageStyle = useMemo(
    () =>
      formato.tipo === "rollo"
        ? `@page { size: ${formato.ancho}mm ${formato.alto}mm; margin: 0; } html, body { margin: 0; } .etiqueta { break-after: page; } .etiqueta:last-child { break-after: auto; }`
        : `@page { size: A4; margin: 0; } html, body { margin: 0; } .hoja-etiquetas { break-after: page; } .hoja-etiquetas:last-child { break-after: auto; }`,
    [formato]
  );

  const imprimir = useReactToPrint({ contentRef: impresion, documentTitle: "Etiquetas", pageStyle });

  const negocio = prefs.negocio ? config?.nombreNegocio ?? undefined : undefined;
  const vistaPrevia = etiquetas.slice(0, 12);
  const escala = Math.min(1.3, 150 / (formato.ancho * MM_A_PX));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header>
        <Link to="/servicios" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 mb-1">
          <FaArrowLeft size={11} /> {et.servicios}
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <FaBarcode className="text-blue-600 dark:text-blue-400" /> Etiquetas con código de barras
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Elige los productos y cuántas etiquetas de cada uno. Solo salen los que tienen código o código de barras en su ficha.</p>
      </header>

      <div className="grid lg:grid-cols-[1fr_22rem] gap-5 items-start">
        <section className={`${tarjeta} overflow-hidden`}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar por nombre o código"
                className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={marcarVisibles}>
              Marcar los que tienen código
            </Button>
            {seleccionados > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCopias({})}>
                Quitar todos
              </Button>
            )}
            {inventario && seleccionados > 0 && (
              <Button variant="ghost" size="sm" onClick={copiasComoExistencias} title="Una etiqueta por cada unidad que hay en existencia">
                Copias = existencias
              </Button>
            )}
          </div>

          {cargando ? (
            <div className="p-4">
              <TableSkeleton rows={6} cols={3} />
            </div>
          ) : visibles.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-500">No hay productos con ese filtro.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[62dvh] overflow-y-auto">
              {visibles.slice(0, 400).map((p) => {
                const codigo = codigoDeProducto(p);
                const marcado = copias[p.id] !== undefined;
                return (
                  <li key={p.id} className={`px-4 py-2.5 flex items-center gap-3 ${!codigo ? "opacity-50" : ""}`}>
                    <input type="checkbox" checked={marcado} disabled={!codigo} onChange={(e) => marcar(p.id, e.target.checked)} className="accent-blue-600 w-5 h-5 shrink-0 cursor-pointer disabled:cursor-not-allowed" aria-label={`Etiquetar ${p.nombreServicio}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.nombreServicio}</p>
                      <p className="text-xs text-gray-500 truncate">{codigo || "sin código: agrégalo en su ficha"}</p>
                    </div>
                    <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400 shrink-0 max-sm:hidden">{formatearMoneda(p.precioBase, moneda)}</span>
                    {marcado && (
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                        copias
                        <input
                          type="number"
                          min={1}
                          max={MAX_COPIAS}
                          value={copias[p.id]}
                          onChange={(e) => setCopias((c) => ({ ...c, [p.id]: Math.min(MAX_COPIAS, Math.max(1, Math.round(Number(e.target.value)) || 1)) }))}
                          className="w-16 h-9 text-center tabular-nums rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100"
                        />
                      </label>
                    )}
                  </li>
                );
              })}
              {visibles.length > 400 && <li className="px-4 py-3 text-center text-xs text-gray-500">Se muestran 400 de {visibles.length}: usa el buscador.</li>}
            </ul>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <div className={`${tarjeta} p-4 space-y-4`}>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Tamaño de la etiqueta</label>
              <select
                value={prefs.formato}
                onChange={(e) => cambiarPrefs({ formato: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100"
              >
                {FORMATOS_ETIQUETA.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.etiqueta}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                {formato.tipo === "rollo" ? "Impresora de etiquetas: en el diálogo de impresión elige tu impresora y deja la escala al 100 %." : "Hoja adhesiva: imprime a tamaño real, sin «ajustar a la página»."}
              </p>
            </div>
            <div className="space-y-1">
              <Interruptor activo={prefs.precio} onChange={(v) => cambiarPrefs({ precio: v })} titulo="Mostrar el precio" />
              <Interruptor activo={prefs.negocio} onChange={(v) => cambiarPrefs({ negocio: v })} titulo="Nombre del negocio" />
            </div>
          </div>

          <div className={`${tarjeta} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vista previa</h2>
              <span className="text-xs text-gray-500">{etiquetas.length} etiqueta{etiquetas.length === 1 ? "" : "s"}</span>
            </div>
            {etiquetas.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Marca productos para ver cómo quedan.</p>
            ) : (
              <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-950 rounded-lg p-3 max-h-80 overflow-y-auto">
                {vistaPrevia.map((e) => (
                  <div key={e.clave} className="shadow-sm ring-1 ring-black/10" style={{ zoom: escala }}>
                    <Etiqueta formato={formato} datos={e} negocio={negocio} />
                  </div>
                ))}
                {etiquetas.length > vistaPrevia.length && <p className="text-xs text-gray-500 w-full text-center">… y {etiquetas.length - vistaPrevia.length} más</p>}
              </div>
            )}
            <Button className="w-full" variant="primary" size="lg" leftIcon={<FaPrint />} onClick={() => imprimir()} disabled={etiquetas.length === 0}>
              Imprimir {etiquetas.length > 0 ? etiquetas.length : ""} etiqueta{etiquetas.length === 1 ? "" : "s"}
            </Button>
            {formato.tipo === "hoja" && etiquetas.length > 0 && (
              <p className="text-xs text-gray-500 text-center">
                {paginas.length} hoja{paginas.length === 1 ? "" : "s"} A4 ({(formato.columnas ?? 1) * (formato.filas ?? 1)} etiquetas por hoja)
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Lo que realmente se imprime: fuera de pantalla, con las medidas reales. */}
      <div className="hidden">
        <div ref={impresion}>
          {formato.tipo === "rollo"
            ? etiquetas.map((e) => <Etiqueta key={e.clave} formato={formato} datos={e} negocio={negocio} />)
            : paginas.map((hoja, i) => (
                <div
                  key={i}
                  className="hoja-etiquetas"
                  style={{
                    width: "210mm",
                    height: "297mm",
                    boxSizing: "border-box",
                    padding: `${formato.margenSup ?? 0}mm 0 0 ${formato.margenIzq ?? 0}mm`,
                    display: "grid",
                    gridTemplateColumns: `repeat(${formato.columnas}, ${formato.ancho}mm)`,
                    gridAutoRows: `${formato.alto}mm`,
                    alignContent: "start",
                  }}
                >
                  {hoja.map((e) => (
                    <Etiqueta key={e.clave} formato={formato} datos={e} negocio={negocio} />
                  ))}
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
