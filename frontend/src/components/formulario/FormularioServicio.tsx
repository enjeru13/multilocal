import { useEffect, useState } from "react";
import { MdOutlineLocalLaundryService } from "react-icons/md";
import { toast } from "react-toastify";
import type {
  Servicio,
  ServicioCreate,
  ServicioUpdatePayload,
  Categoria,
} from "@lavanderia/shared/types/types";
import { AxiosError } from "axios";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useConfiguracion } from "../../context/ConfiguracionContext";

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
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState<number | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [permiteDecimales, setPermiteDecimales] = useState(false);
  const [categoriaSeleccionadaId, setCategoriaSeleccionadaId] = useState<
    string | ""
  >("");

  const { config } = useConfiguracion();
  const inventarioActivo = !!config?.moduloInventario;

  const [controlaStock, setControlaStock] = useState(false);
  const [sku, setSku] = useState("");
  const [stockActual, setStockActual] = useState<number | null>(0);
  const [stockMinimo, setStockMinimo] = useState<number | null>(null);

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
      setStockActual(servicio.stockActual ?? 0);
      setStockMinimo(servicio.stockMinimo ?? null);
    } else {
      setNombre("");
      setPrecio(null);
      setDescripcion("");
      setPermiteDecimales(false);
      setCategoriaSeleccionadaId("");
      setControlaStock(false);
      setSku("");
      setStockActual(0);
      setStockMinimo(null);
    }
    setErrores({});
  }, [servicio]);

  const guardar = async () => {
    const nuevosErrores: typeof errores = {};
    if (!nombre.trim()) {
      nuevosErrores.nombre = "El nombre del servicio es obligatorio.";
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
        ...camposInventario,
      };
    } else {
      data = {
        nombreServicio: nombre.trim(),
        precioBase: precio as number,
        descripcion: descripcionFinal,
        permiteDecimales,
        categoriaId: categoriaSeleccionadaId,
        ...camposInventario,
      };
    }

    setCargando(true);
    try {
      await onSubmit(data);
    } catch (error: unknown) {
      console.error("Error al guardar servicio:", error);
      let errorMessage = "Ocurrió un error al guardar el servicio.";
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

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md" className="max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-blue-600 dark:bg-blue-800 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <MdOutlineLocalLaundryService className="text-2xl" />
            {servicio ? "Editar Servicio" : "Registrar Servicio"}
          </h2>
          <button
            onClick={onClose}
            title="Cerrar"
            className="text-white/80 hover:text-white text-2xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-6 flex-1 overflow-y-auto space-y-6 text-base text-gray-800 dark:text-gray-200">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Nombre del servicio:
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 shadow-sm"
              placeholder="Ej. Lavado y Secado por Kg"
              disabled={cargando}
            />
            {errores.nombre && (
              <p className="text-red-600 dark:text-red-400 text-xs font-medium mt-1">
                {errores.nombre}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Categoría:
            </label>
            {cargandoCategorias ? (
              <p className="text-gray-500 dark:text-gray-400 italic">Cargando categorías...</p>
            ) : categorias.length === 0 ? (
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                No hay categorías disponibles. Por favor, crea una en "Gestionar
                Categorías".
              </p>
            ) : (
              <select
                value={categoriaSeleccionadaId}
                onChange={(e) => setCategoriaSeleccionadaId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 shadow-sm"
                disabled={cargando}
              >
                <option value="">Selecciona una categoría</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            )}
            {errores.categoria && (
              <p className="text-red-600 dark:text-red-400 text-xs font-medium mt-1">
                {errores.categoria}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Precio base:
            </label>
            <input
              type="number"
              step="any"
              value={precio ?? ""}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value);
                setPrecio(isNaN(parsed) ? null : parsed);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 shadow-sm"
              placeholder="Ej. 12.50"
              disabled={cargando}
            />
            {errores.precio && (
              <p className="text-red-600 dark:text-red-400 text-xs font-medium mt-1">
                {errores.precio}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Descripción (opcional):
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 resize-y min-h-[80px] shadow-sm"
              rows={3}
              placeholder="Ej. Incluye lavado, secado y doblado de ropa."
              disabled={cargando}
            />
          </div>

          <div>
            <label className="flex items-center space-x-3 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={permiteDecimales}
                onChange={(e) => setPermiteDecimales(e.target.checked)}
                className="accent-blue-600 dark:accent-blue-500 w-5 h-5 cursor-pointer"
                disabled={cargando}
              />
              <span>¿Permite cantidades decimales?</span>
            </label>
          </div>

          {inventarioActivo && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
              <label className="flex items-center space-x-3 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={controlaStock}
                  onChange={(e) => setControlaStock(e.target.checked)}
                  className="accent-blue-600 dark:accent-blue-500 w-5 h-5 cursor-pointer"
                  disabled={cargando}
                />
                <span>Controlar stock de este ítem</span>
              </label>

              {controlaStock && (
                <div className="grid grid-cols-2 gap-4 pl-8">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                      SKU / código (opcional)
                    </label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                      placeholder="Ej. FIL-001"
                      disabled={cargando}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                      Stock mínimo (alerta)
                    </label>
                    <input
                      type="number"
                      value={stockMinimo ?? ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setStockMinimo(isNaN(v) ? null : v);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                      placeholder="Ej. 5"
                      disabled={cargando}
                    />
                  </div>
                  {!servicio && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        Stock inicial
                      </label>
                      <input
                        type="number"
                        value={stockActual ?? ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setStockActual(isNaN(v) ? 0 : v);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                        placeholder="0"
                        disabled={cargando}
                      />
                    </div>
                  )}
                  {servicio && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        Stock actual
                      </p>
                      <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {servicio.stockActual} — usa "Registrar compra" en Proveedores para sumar stock.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 text-sm font-medium">
          <Button type="button" onClick={onClose} variant="secondary" disabled={cargando}>
            Cancelar
          </Button>
          <Button onClick={guardar} variant="primary" isLoading={cargando}>
            Guardar Servicio
          </Button>
        </div>
    </Modal>
  );
}
