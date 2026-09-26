import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaArrowLeft, FaArrowRight, FaCheck, FaDownload, FaExclamationTriangle, FaFileExcel, FaUpload } from "react-icons/fa";
import type { Moneda } from "@lavanderia/shared/types/types";
import { servicioService, type FilaImportacion, type ResultadoImportacion } from "../services/serviciosService";
import { CAMPOS, descargarTexto, detectarColumnas, detectarEncabezado, leerArchivo, plantillaCsv, type CampoId, type HojaLeida } from "../utils/importarArchivo";
import { useMonedas } from "../context/useMonedas";
import { useConfiguracion, useEtiquetas } from "../context/configuracionCore";
import Button from "../components/ui/Button";
import { Segmentado } from "../components/ui/Formulario";

type Paso = "archivo" | "columnas" | "vista" | "listo";
const PASOS: { id: Paso; titulo: string }[] = [
  { id: "archivo", titulo: "Archivo" },
  { id: "columnas", titulo: "Columnas" },
  { id: "vista", titulo: "Revisar" },
  { id: "listo", titulo: "Listo" },
];

const tarjeta = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";
const selector = "w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50";
const POR_PAGINA = 100;

const mensaje = (err: unknown, defecto: string) => (isAxiosError(err) ? err.response?.data?.message ?? defecto : err instanceof Error ? err.message : defecto);

/**
 * Carga masiva de productos desde Excel o CSV: se elige el archivo, se confirman las columnas,
 * se revisa qué se creará y actualizará, y solo entonces se guarda.
 */
export default function PantallaImportarProductos() {
  const navigate = useNavigate();
  const et = useEtiquetas();
  const { config } = useConfiguracion();
  const monedas = useMonedas();
  const entrada = useRef<HTMLInputElement>(null);

  const [paso, setPaso] = useState<Paso>("archivo");
  const [leyendo, setLeyendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [hojas, setHojas] = useState<HojaLeida[]>([]);
  const [hoja, setHoja] = useState(0);
  const [filaTitulos, setFilaTitulos] = useState(0);
  const [mapeo, setMapeo] = useState<Record<CampoId, number | null>>(() => detectarColumnas([]));
  const [moneda, setMoneda] = useState<Moneda>(monedas.principal);

  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [filtro, setFiltro] = useState<"TODAS" | "CREAR" | "ACTUALIZAR" | "ERROR">("TODAS");
  const [visibles, setVisibles] = useState(POR_PAGINA);

  const filas = useMemo(() => hojas[hoja]?.filas ?? [], [hojas, hoja]);
  const titulos = filas[filaTitulos] ?? [];
  const datos = useMemo(() => filas.slice(filaTitulos + 1), [filas, filaTitulos]);

  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setLeyendo(true);
    try {
      const leidas = await leerArchivo(archivo);
      if (leidas.length === 0 || leidas.every((h) => h.filas.length < 2)) {
        toast.error("El archivo está vacío o solo tiene una fila.");
        return;
      }
      setNombreArchivo(archivo.name);
      setHojas(leidas);
      const mejor = Math.max(0, leidas.findIndex((h) => h.filas.length > 1));
      aplicarHoja(leidas, mejor);
      setPaso("columnas");
    } catch (err) {
      toast.error(mensaje(err, "No se pudo leer el archivo."));
    } finally {
      setLeyendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const aplicarHoja = (lista: HojaLeida[], indice: number) => {
    setHoja(indice);
    const f = lista[indice].filas;
    const encabezado = detectarEncabezado(f);
    setFilaTitulos(encabezado);
    setMapeo(detectarColumnas(f[encabezado] ?? []));
  };

  const cambiarFilaTitulos = (n: number) => {
    setFilaTitulos(n);
    setMapeo(detectarColumnas(filas[n] ?? []));
  };

  const filasParaEnviar = (): FilaImportacion[] =>
    datos.map((f, i) => {
      const fila: FilaImportacion = { fila: filaTitulos + i + 2 };
      for (const c of CAMPOS) {
        const col = mapeo[c.id];
        if (col !== null) (fila as unknown as Record<string, unknown>)[c.id] = f[col] ?? null;
      }
      return fila;
    });

  const faltantes = CAMPOS.filter((c) => c.obligatorio && mapeo[c.id] === null);
  const columnasRepetidas = useMemo(() => {
    const usadas = Object.values(mapeo).filter((v): v is number => v !== null);
    return usadas.length !== new Set(usadas).size;
  }, [mapeo]);

  const revisar = async () => {
    setTrabajando(true);
    try {
      const res = await servicioService.importar(filasParaEnviar(), moneda, true);
      setResultado(res.data);
      setFiltro(res.data.resumen.errores > 0 ? "ERROR" : "TODAS");
      setVisibles(POR_PAGINA);
      setPaso("vista");
    } catch (err) {
      toast.error(mensaje(err, "No se pudo revisar el archivo."));
    } finally {
      setTrabajando(false);
    }
  };

  const importar = async () => {
    setTrabajando(true);
    try {
      const res = await servicioService.importar(filasParaEnviar(), moneda, false);
      setResultado(res.data);
      setPaso("listo");
      toast.success("Importación terminada.");
    } catch (err) {
      toast.error(mensaje(err, "No se pudo importar. No se guardó nada."));
    } finally {
      setTrabajando(false);
    }
  };

  const mostradas = useMemo(() => (resultado?.filas ?? []).filter((f) => filtro === "TODAS" || f.accion === filtro), [resultado, filtro]);
  const aImportar = resultado ? resultado.resumen.crear + resultado.resumen.actualizar : 0;

  const descargarErrores = () => {
    if (!resultado) return;
    const lineas = ["Fila;Producto;Problema", ...resultado.filas.filter((f) => f.accion === "ERROR").map((f) => `${f.fila};"${f.nombre.replace(/"/g, '""')}";"${f.errores.join(" ").replace(/"/g, '""')}"`)];
    descargarTexto("filas_con_error.csv", "\uFEFF" + lineas.join("\r\n"));
  };

  const indice = PASOS.findIndex((p) => p.id === paso);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <header>
        <Link to="/servicios" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 mb-1">
          <FaArrowLeft size={11} /> {et.servicios}
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <FaFileExcel className="text-emerald-600" /> Importar desde Excel o CSV
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Carga tu catálogo o inventario de una vez. Antes de guardar nada verás exactamente qué se creará y qué se actualizará.</p>
      </header>

      <ol className="grid grid-cols-4 gap-2 sm:gap-3">
        {PASOS.map((p, i) => (
          <li key={p.id} aria-current={p.id === paso ? "step" : undefined}>
            <span className={`block h-1.5 rounded-full ${i <= indice ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-800"}`} />
            <span className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold ${p.id === paso ? "text-gray-900 dark:text-gray-100" : i < indice ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
              {i < indice ? <FaCheck size={9} /> : <span>{i + 1}.</span>} {p.titulo}
            </span>
          </li>
        ))}
      </ol>

      {paso === "archivo" && (
        <section className={`${tarjeta} p-5 sm:p-6 space-y-5`}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              void elegirArchivo(e.dataTransfer.files[0]);
            }}
            className={`rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${arrastrando ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10" : "border-gray-300 dark:border-gray-700"}`}
          >
            <FaUpload className="mx-auto text-3xl text-gray-300 dark:text-gray-600 mb-3" />
            <p className="font-medium text-gray-800 dark:text-gray-200">Arrastra aquí tu archivo</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Excel (.xlsx) o CSV. Si tienes un .xls antiguo, guárdalo como .xlsx desde Excel.</p>
            <input ref={entrada} type="file" accept=".xlsx,.csv,.txt,text/csv" className="hidden" onChange={(e) => void elegirArchivo(e.target.files?.[0])} />
            <Button className="mt-4" variant="primary" onClick={() => entrada.current?.click()} isLoading={leyendo} leftIcon={<FaFileExcel />}>
              Elegir archivo
            </Button>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p className="font-semibold text-gray-800 dark:text-gray-200">¿Cómo debe venir el archivo?</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Una fila por producto y una primera fila con los títulos de las columnas. No tiene que seguir un orden: en el siguiente paso confirmas qué es cada columna.</li>
              <li>Lo mínimo: <strong>nombre</strong> y <strong>precio</strong>. Con <strong>código</strong> puedes volver a importar para actualizar precios y existencias sin duplicar.</li>
              <li>Los precios pueden venir como 12,50 · 12.50 · 1.250,00 · $ 12.</li>
            </ul>
            <Button variant="secondary" size="sm" leftIcon={<FaDownload />} onClick={() => descargarTexto("plantilla_productos.csv", plantillaCsv())}>
              Descargar una plantilla de ejemplo
            </Button>
          </div>
        </section>
      )}

      {paso === "columnas" && (
        <section className={`${tarjeta} p-5 sm:p-6 space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-gray-100">{nombreArchivo}</strong> · {datos.length} fila{datos.length === 1 ? "" : "s"} de datos
            </p>
            <div className="flex flex-wrap gap-3">
              {hojas.length > 1 && (
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  Hoja
                  <select className={`${selector} w-auto`} value={hoja} onChange={(e) => aplicarHoja(hojas, Number(e.target.value))}>
                    {hojas.map((h, i) => (
                      <option key={h.nombre + i} value={i}>
                        {h.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                Títulos en la fila
                <select className={`${selector} w-auto`} value={filaTitulos} onChange={(e) => cambiarFilaTitulos(Number(e.target.value))}>
                  {filas.slice(0, 15).map((_, i) => (
                    <option key={i} value={i}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {monedas.usables.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Los precios del archivo están en</span>
              <Segmentado ariaLabel="Moneda de los precios" valor={moneda} onChange={setMoneda} opciones={monedas.usables.map((m) => ({ id: m, label: m }))} />
              {moneda !== monedas.principal && <span className="text-xs text-gray-500">Se convierten a {monedas.principal} con la tasa actual.</span>}
            </div>
          )}

          <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
            {CAMPOS.map((c) => {
              const col = mapeo[c.id];
              const ejemplo = col !== null ? datos.slice(0, 3).map((f) => f[col]).filter((v) => v !== null && v !== "").join(" · ") : "";
              return (
                <div key={c.id} className="grid sm:grid-cols-[1fr_1fr] gap-x-6 gap-y-1.5 px-4 py-3 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {c.etiqueta} {c.obligatorio && <span className="text-red-500">*</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.ayuda}</p>
                  </div>
                  <div className="min-w-0">
                    <select className={selector} value={col ?? ""} onChange={(e) => setMapeo((m) => ({ ...m, [c.id]: e.target.value === "" ? null : Number(e.target.value) }))} aria-label={`Columna para ${c.etiqueta}`}>
                      <option value="">— No importar —</option>
                      {titulos.map((t, i) => (
                        <option key={i} value={i}>
                          {t === null || t === "" ? `Columna ${i + 1}` : String(t)}
                        </option>
                      ))}
                    </select>
                    {ejemplo && <p className="text-xs text-gray-400 mt-1 truncate">Ej.: {ejemplo}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {faltantes.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <FaExclamationTriangle /> Falta indicar: {faltantes.map((f) => f.etiqueta.toLowerCase()).join(" y ")}. Solo se pueden actualizar productos existentes sin esas columnas si traen código.
            </p>
          )}
          {columnasRepetidas && (
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <FaExclamationTriangle /> Elegiste la misma columna para más de un dato.
            </p>
          )}
          {!config?.moduloInventario && mapeo.stock !== null && <p className="text-xs text-gray-500">El inventario está apagado en Configuración: las existencias del archivo no se cargarán.</p>}

          <div className="flex justify-between gap-3 pt-2">
            <Button variant="ghost" leftIcon={<FaArrowLeft />} onClick={() => setPaso("archivo")}>
              Cambiar archivo
            </Button>
            <Button variant="primary" rightIcon={<FaArrowRight />} onClick={revisar} isLoading={trabajando} disabled={trabajando || (mapeo.nombre === null && mapeo.sku === null && mapeo.codigoBarras === null) || (mapeo.precio === null && mapeo.stock === null && mapeo.costo === null)}>
              Revisar antes de guardar
            </Button>
          </div>
        </section>
      )}

      {paso === "vista" && resultado && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: "CREAR", titulo: "Se crearán", valor: resultado.resumen.crear, color: "text-emerald-600 dark:text-emerald-400" },
              { id: "ACTUALIZAR", titulo: "Se actualizarán", valor: resultado.resumen.actualizar, color: "text-sky-600 dark:text-sky-400" },
              { id: "SIN", titulo: "Sin cambios", valor: resultado.resumen.sinCambios, color: "text-gray-500" },
              { id: "ERROR", titulo: "Con problemas", valor: resultado.resumen.errores, color: resultado.resumen.errores > 0 ? "text-red-600 dark:text-red-400" : "text-gray-500" },
            ].map((k) => (
              <div key={k.id} className={`${tarjeta} p-4`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{k.titulo}</p>
                <p className={`text-2xl font-bold tabular-nums mt-1 ${k.color}`}>{k.valor}</p>
              </div>
            ))}
          </div>

          {resultado.resumen.errores > 0 && (
            <p className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-2.5">
              <FaExclamationTriangle className="mt-0.5 shrink-0" />
              <span>
                Las {resultado.resumen.errores} filas con problemas <strong>no se importarán</strong>; el resto sí. Puedes corregir el archivo y volver a cargarlo, o continuar así.
              </span>
            </p>
          )}

          <div className={`${tarjeta} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              {(["TODAS", "CREAR", "ACTUALIZAR", "ERROR"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFiltro(f);
                    setVisibles(POR_PAGINA);
                  }}
                  className={`h-8 px-3 rounded-full text-xs font-medium border cursor-pointer ${filtro === f ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"}`}
                >
                  {f === "TODAS" ? "Todas" : f === "CREAR" ? "Nuevas" : f === "ACTUALIZAR" ? "Actualizaciones" : "Con problemas"}
                </button>
              ))}
              {resultado.resumen.errores > 0 && (
                <button type="button" onClick={descargarErrores} className="ml-auto text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer">
                  <FaDownload size={10} /> Descargar las filas con problemas
                </button>
              )}
            </div>
            {mostradas.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500">No hay filas en esta vista.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[55dvh] overflow-y-auto">
                {mostradas.slice(0, visibles).map((f) => (
                  <li key={f.fila} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                    <span className="w-12 shrink-0 text-xs text-gray-400 tabular-nums pt-0.5">#{f.fila}</span>
                    <span className={`shrink-0 mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.accion === "CREAR" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : f.accion === "ACTUALIZAR" ? "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"}`}>
                      {f.accion === "CREAR" ? "Nuevo" : f.accion === "ACTUALIZAR" ? (f.cambios?.length ? "Actualiza" : "Igual") : "Problema"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{f.nombre}</p>
                      {f.coincide && <p className="text-xs text-gray-500">Coincide con «{f.coincide.nombre}» por {f.coincide.por}.</p>}
                      {f.cambios && f.cambios.length > 0 && <p className="text-xs text-sky-700 dark:text-sky-300">{f.cambios.join(" · ")}</p>}
                      {f.errores.map((e) => (
                        <p key={e} className="text-xs text-red-600 dark:text-red-400">
                          {e}
                        </p>
                      ))}
                      {f.avisos.map((a) => (
                        <p key={a} className="text-xs text-amber-700 dark:text-amber-400">
                          {a}
                        </p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {mostradas.length > visibles && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-center">
                <Button variant="secondary" size="sm" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
                  Mostrar más ({mostradas.length - visibles} restantes)
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="ghost" leftIcon={<FaArrowLeft />} onClick={() => setPaso("columnas")} disabled={trabajando}>
              Volver a las columnas
            </Button>
            <Button variant="primary" leftIcon={<FaCheck />} onClick={importar} isLoading={trabajando} disabled={trabajando || aImportar === 0}>
              {aImportar === 0 ? "Nada que importar" : `Importar ${aImportar} producto${aImportar === 1 ? "" : "s"}`}
            </Button>
          </div>
        </section>
      )}

      {paso === "listo" && resultado && (
        <section className={`${tarjeta} p-6 sm:p-8 text-center space-y-4`}>
          <span className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl">
            <FaCheck />
          </span>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Importación terminada</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Se crearon <strong>{resultado.resumen.crear}</strong> y se actualizaron <strong>{resultado.resumen.actualizar}</strong>
            {resultado.resumen.errores > 0 && (
              <>
                ; <strong>{resultado.resumen.errores}</strong> filas con problemas no se importaron
              </>
            )}
            .
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {resultado.resumen.errores > 0 && (
              <Button variant="secondary" leftIcon={<FaDownload />} onClick={descargarErrores}>
                Descargar las filas con problemas
              </Button>
            )}
            <Button variant="secondary" onClick={() => setPaso("archivo")}>
              Importar otro archivo
            </Button>
            <Button variant="primary" onClick={() => navigate("/servicios")}>
              Ver el catálogo
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
