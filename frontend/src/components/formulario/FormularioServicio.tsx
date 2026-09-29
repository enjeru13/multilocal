import { useEffect, useRef, useState } from "react";
import { MdOutlineLocalLaundryService } from "react-icons/md";
import { FaCamera, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import type {
  Servicio,
  ServicioCreate,
  ServicioUpdatePayload,
  Categoria,
  Moneda,
} from "@lavanderia/shared/types/types";
import { AxiosError } from "axios";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { CampoMontoNumero } from "../ui/CampoMonto";
import { Campo, Seccion, ModalEncabezado, ModalPie, Opcion, campo, campoError } from "../ui/Formulario";
import { useConfiguracion } from "../../context/configuracionCore";
import { useEtiquetas } from "../../context/configuracionCore";
import { urlImagenServicio } from "../../utils/apiClient";
import { servicioService } from "../../services/serviciosService";

type FormularioServicioProps = {
  servicio?: Servicio;
  onClose: () => void;
  onSubmit: (
    data: ServicioCreate | (ServicioUpdatePayload & { id: number })
  ) => Promise<void>;
  categorias: Categoria[];
  cargandoCategorias: boolean;
};

export default function FormularioServicio({
  servicio,
  onClose,
  onSubmit,
  categorias,
  cargandoCategorias,
}: FormularioServicioProps) {
  const et = useEtiquetas();
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState<number | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [permiteDecimales, setPermiteDecimales] = useState(false);
  const [categoriaSeleccionadaId, setCategoriaSeleccionadaId] = useState<
    string | ""
  >("");

  const { config } = useConfiguracion();
  const inventarioActivo = !!config?.moduloInventario;
  const monedaPrincipal = (config?.monedaPrincipal ?? "USD") as Moneda;

  const [controlaStock, setControlaStock] = useState(false);
  const [sku, setSku] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [costo, setCosto] = useState<number | null>(null);
  const [exentoImpuesto, setExentoImpuesto] = useState(false);
  const [stockActual, setStockActual] = useState<number | null>(0);
  const [stockMinimo, setStockMinimo] = useState<number | null>(null);

  const [imagenActual, setImagenActual] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const inputImagenRef = useRef<HTMLInputElement>(null);

  const [errores, setErrores] = useState<{
    nombre?: string;
    precio?: string;
    categoria?: string;
  }>({});
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (servicio) {
      setNombre(servicio.nombreServicio || "");
      setPrecio(servicio.precioBase || null);
      setDescripcion(servicio.descripcion || "");
      setPermiteDecimales(servicio.permiteDecimales ?? false);
      setCategoriaSeleccionadaId(servicio.categoriaId || "");
      setControlaStock(servicio.controlaStock ?? false);
      setSku(servicio.sku || "");
      setCodigoBarras(servicio.codigoBarras || "");
      setCosto(servicio.costoBase ?? null);
      setExentoImpuesto(servicio.exentoImpuesto ?? false);
      setStockActual(servicio.stockActual ?? 0);
      setStockMinimo(servicio.stockMinimo ?? null);
      setImagenActual(servicio.imagen ?? null);
    } else {
      setNombre("");
      setPrecio(null);
      setDescripcion("");
      setPermiteDecimales(false);
      setCategoriaSeleccionadaId("");
      setControlaStock(false);
      setSku("");
      setCodigoBarras("");
      setCosto(null);
      setExentoImpuesto(false);
      setStockActual(0);
      setStockMinimo(null);
      setImagenActual(null);
    }
    setErrores({});
  }, [servicio]);

  const elegirImagen = () => inputImagenRef.current?.click();

  const subirImagen = async (archivo: File) => {
    if (!servicio?.id) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
      toast.error("La foto debe ser JPG, PNG o WEBP.");
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      toast.error("La foto pesa demasiado (máximo 5 MB).");
      return;
    }
    setSubiendoImagen(true);
    try {
      const { data } = await servicioService.subirImagen(servicio.id, archivo);
      setImagenActual(data.imagen);
      toast.success("Foto actualizada.");
    } catch {
      toast.error("No se pudo subir la foto.");
    } finally {
      setSubiendoImagen(false);
      if (inputImagenRef.current) inputImagenRef.current.value = "";
    }
  };

  const quitarImagen = async () => {
    if (!servicio?.id) return;
    setSubiendoImagen(true);
    try {
      await servicioService.eliminarImagen(servicio.id);
      setImagenActual(null);
      toast.success("Foto eliminada.");
    } catch {
      toast.error("No se pudo eliminar la foto.");
    } finally {
      setSubiendoImagen(false);
    }
  };

  const guardar = async () => {
    const nuevosErrores: typeof errores = {};
    if (!nombre.trim()) {
      nuevosErrores.nombre = `El nombre del ${et.servicioMin} es obligatorio.`;
    }
    if (precio === null || isNaN(precio) || precio < 0) {
      nuevosErrores.precio = "El precio base debe ser un número positivo.";
    }
    if (!categoriaSeleccionadaId) {
      nuevosErrores.categoria = "Debe seleccionar una categoría.";
    }

    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return;

    let data: ServicioCreate | (ServicioUpdatePayload & { id: number });

    const descripcionFinal = descripcion.trim() || null;

    const camposInventario = inventarioActivo
      ? {
          tipo: "PRODUCTO" as const,
          controlaStock,
          sku: sku.trim() || null,
          codigoBarras: codigoBarras.trim() || null,
          costoBase: costo,
          ...(controlaStock && {
            stockActual: stockActual ?? 0,
            stockMinimo: stockMinimo ?? null,
          }),
        }
      : {};

    if (servicio?.id) {
      data = {
        id: servicio.id,
        nombreServicio: nombre.trim(),
        precioBase: precio as number,
        descripcion: descripcionFinal,
        permiteDecimales,
        categoriaId: categoriaSeleccionadaId,
        exentoImpuesto,
        ...camposInventario,
      };
    } else {
      data = {
        nombreServicio: nombre.trim(),
        precioBase: precio as number,
        descripcion: descripcionFinal,
        permiteDecimales,
        categoriaId: categoriaSeleccionadaId,
        exentoImpuesto,
        ...camposInventario,
      };
    }

    setCargando(true);
    try {
      await onSubmit(data);
    } catch (error: unknown) {
      console.error("Error al guardar servicio:", error);
      let errorMessage = `Ocurrió un error al guardar ${et.servicioMin}.`;
      if (error instanceof AxiosError) {
        errorMessage = error.response?.data?.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setCargando(false);
    }
  };

  const margen = costo !== null && precio !== null && precio > 0 ? ((precio - costo) / precio) * 100 : null;
  const conError = (k: keyof typeof errores) => (errores[k] ? campoError : "");

  return (
    <Modal open onClose={onClose} maxWidth="max-w-xl" className="max-h-[92dvh] flex flex-col overflow-hidden">
      <ModalEncabezado
        icono={<MdOutlineLocalLaundryService />}
        titulo={servicio ? `Editar ${et.servicioMin}` : `Nuevo ${et.servicioMin}`}
        subtitulo={servicio ? servicio.nombreServicio : "Nombre, precio y categoría bastan para empezar"}
        onClose={onClose}
      />

      <div className="px-4 sm:px-6 py-5 flex-1 overflow-y-auto space-y-6">
        {servicio?.id ? (
          <Seccion titulo="Foto">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 overflow-hidden flex items-center justify-center shrink-0">
                {imagenActual ? (
                  <img src={urlImagenServicio(imagenActual) ?? undefined} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FaCamera className="text-gray-400 dark:text-gray-600" size={22} />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={inputImagenRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && subirImagen(e.target.files[0])} />
                <Button type="button" size="sm" variant="secondary" onClick={elegirImagen} isLoading={subiendoImagen} disabled={subiendoImagen} leftIcon={<FaCamera />}>
                  {imagenActual ? "Cambiar foto" : "Subir foto"}
                </Button>
                {imagenActual && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void quitarImagen()} disabled={subiendoImagen} leftIcon={<FaTrash />}>
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          </Seccion>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/40 rounded-lg px-3 py-2">Guarda primero para poder agregarle una foto.</p>
        )}

        <Seccion titulo="Datos básicos">
          <Campo etiqueta={`Nombre del ${et.servicioMin}`} error={errores.nombre}>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={`${campo} ${conError("nombre")}`} placeholder="Ej. Lavado y secado por kilo" disabled={cargando} autoFocus />
          </Campo>

          <div className="grid sm:grid-cols-2 gap-4">
            <Campo etiqueta="Categoría" error={errores.categoria}>
              {cargandoCategorias ? (
                <p className="h-10 flex items-center text-sm text-gray-500">Cargando categorías…</p>
              ) : categorias.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                  Primero crea una categoría con «Gestionar Categorías».
                </p>
              ) : (
                <select value={categoriaSeleccionadaId} onChange={(e) => setCategoriaSeleccionadaId(e.target.value)} className={`${campo} ${conError("categoria")}`} disabled={cargando}>
                  <option value="">Elige una categoría</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo etiqueta="Precio de venta" error={errores.precio}>
              <CampoMontoNumero moneda={monedaPrincipal} valor={precio} onValor={setPrecio} className={`${campo} text-right tabular-nums ${conError("precio")}`} placeholder="0.00" disabled={cargando} />
            </Campo>
          </div>

          <Campo etiqueta="Descripción" opcional>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={`${campo} h-auto! py-2 resize-y`} rows={2} placeholder="Detalles que quieras recordar" disabled={cargando} />
          </Campo>
        </Seccion>

        <Seccion titulo="Cómo se vende">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2 divide-y divide-gray-100 dark:divide-gray-800">
            <Opcion activo={permiteDecimales} onChange={setPermiteDecimales} titulo="Se vende por peso o medida" detalle="Permite cantidades con decimales, como 2,5 kg." disabled={cargando} />
            {config?.impuestoActivo && (
              <Opcion activo={exentoImpuesto} onChange={setExentoImpuesto} titulo={`Exento de ${config.impuestoNombre || "impuesto"}`} detalle="No se le cobra impuesto en las ventas." disabled={cargando} />
            )}
          </div>
        </Seccion>

        {inventarioActivo && (
          <Seccion titulo="Inventario y costos">
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo etiqueta="Código de barras" opcional>
                <input type="text" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} className={campo} placeholder="Escanéalo o escríbelo" disabled={cargando} />
              </Campo>
              <Campo etiqueta="SKU / referencia" opcional>
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className={campo} placeholder="Ej. FIL-001" disabled={cargando} />
              </Campo>
              <Campo etiqueta="Costo" opcional ayuda="Se guarda con cada venta para calcular tu ganancia.">
                <CampoMontoNumero moneda={monedaPrincipal} valor={costo} onValor={setCosto} className={`${campo} text-right tabular-nums`} placeholder="0.00" disabled={cargando} />
              </Campo>
              <div className="flex items-end pb-1">
                {margen !== null && costo !== null && precio !== null && (
                  <p className={`text-sm font-semibold ${precio >= costo ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    Margen {margen.toFixed(1)}%
                    <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">ganas {(precio - costo).toFixed(2)} por unidad</span>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2">
              <Opcion activo={controlaStock} onChange={setControlaStock} titulo="Controlar existencias" detalle="Descuenta en cada venta y avisa cuando queda poco." disabled={cargando} />
              {controlaStock && (
                <div className="grid sm:grid-cols-2 gap-4 py-3 border-t border-gray-100 dark:border-gray-800 mt-1">
                  {!servicio ? (
                    <Campo etiqueta="Existencias iniciales">
                      <input
                        type="number"
                        value={stockActual ?? ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setStockActual(isNaN(v) ? 0 : v);
                        }}
                        className={`${campo} text-right tabular-nums`}
                        placeholder="0"
                        disabled={cargando}
                      />
                    </Campo>
                  ) : (
                    <Campo etiqueta="Existencias actuales" ayuda="Para sumar, registra una compra en Proveedores.">
                      <p className="h-10 flex items-center text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{servicio.stockActual}</p>
                    </Campo>
                  )}
                  <Campo etiqueta="Avisar cuando queden" opcional>
                    <input
                      type="number"
                      value={stockMinimo ?? ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setStockMinimo(isNaN(v) ? null : v);
                      }}
                      className={`${campo} text-right tabular-nums`}
                      placeholder="Ej. 5"
                      disabled={cargando}
                    />
                  </Campo>
                </div>
              )}
            </div>
          </Seccion>
        )}
      </div>

      <ModalPie>
        <Button type="button" onClick={onClose} variant="secondary" disabled={cargando}>
          Cancelar
        </Button>
        <Button onClick={guardar} variant="primary" isLoading={cargando}>
          {servicio ? "Guardar cambios" : `Registrar ${et.servicioMin}`}
        </Button>
      </ModalPie>
    </Modal>
  );
}
