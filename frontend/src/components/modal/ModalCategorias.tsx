import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaTags, FaPlus, FaTimes, FaPen, FaTrashAlt } from "react-icons/fa";
import { categoriasService } from "../../services/categoriasService";
import { Categoria } from "@lavanderia/shared/types/types";
import { AxiosError } from "axios";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import ConfirmacionModal from "./ConfirmacionModal";
import { useEtiquetas } from "../../context/configuracionCore";

type Props = {
  onClose: () => void;
};

interface CategoriaFormState {
  id?: string;
  nombre: string;
}

export default function CategoriasModal({ onClose }: Props) {
  const et = useEtiquetas();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [formState, setFormState] = useState<CategoriaFormState>({
    nombre: "",
  });
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarConfirmacionEliminar, setMostrarConfirmacionEliminar] =
    useState(false);
  const [categoriaAEliminarId, setCategoriaAEliminarId] = useState<
    string | undefined
  >();
  const [estaGuardando, setEstaGuardando] = useState(false);

  const cargarCategorias = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await categoriasService.getAll();
      setCategorias(Array.isArray(res) ? res : []);
    } catch (error: unknown) {
      console.error("Error al cargar categorías:", error);
      let errorMessage = "Ocurrió un error desconocido al cargar categorías.";
      if (error instanceof AxiosError) {
        errorMessage =
          error.response?.data?.message ||
          "No se pudieron cargar las categorías.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      setErrorCarga(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.nombre.trim()) {
      toast.error("El nombre de la categoría no puede estar vacío.");
      return;
    }

    setEstaGuardando(true);
    try {
      if (modoEdicion && formState.id) {
        await categoriasService.update(formState.id, {
          nombre: formState.nombre,
        });
        toast.success("Categoría actualizada correctamente.");
      } else {
        await categoriasService.create({ nombre: formState.nombre });
        toast.success("Categoría creada correctamente.");
      }
      setFormState({ nombre: "" });
      setModoEdicion(false);
      cargarCategorias();
    } catch (error: unknown) {
      console.error("Error al guardar categoría:", error);
      let errorMessage = "Error al guardar categoría.";
      if (error instanceof AxiosError && error.response) {
        if (error.response.status === 409) {
          errorMessage =
            error.response.data.message ||
            "Ya existe una categoría con ese nombre.";
        } else {
          errorMessage = error.response.data.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setEstaGuardando(false);
    }
  };

  const iniciarEdicion = (categoria: Categoria) => {
    setFormState({ id: categoria.id, nombre: categoria.nombre });
    setModoEdicion(true);
  };

  const cancelarEdicion = () => {
    setFormState({ nombre: "" });
    setModoEdicion(false);
  };

  const confirmarEliminar = (id: string) => {
    setCategoriaAEliminarId(id);
    setMostrarConfirmacionEliminar(true);
  };

  const ejecutarEliminar = async () => {
    if (!categoriaAEliminarId) return;

    try {
      await categoriasService.remove(categoriaAEliminarId);
      toast.success("Categoría eliminada correctamente.");
      cargarCategorias();
    } catch (error: unknown) {
      console.error("Error al eliminar categoría:", error);
      let errorMessage = "Error al eliminar categoría.";
      if (error instanceof AxiosError && error.response) {
        if (error.response.status === 400) {
          errorMessage =
            error.response.data.message ||
            `No se pudo eliminar la categoría. Asegúrate de que no tenga ${et.serviciosMin} asociados.`;
        } else if (error.response.status === 404) {
          errorMessage =
            error.response.data.message ||
            "Categoría no encontrada para eliminar.";
        } else {
          errorMessage = error.response.data.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setMostrarConfirmacionEliminar(false);
      setCategoriaAEliminarId(undefined);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="max-h-[80vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-3">
            <FaTags className="text-2xl" />
            Gestionar Categorías
          </h2>
          <button
            onClick={onClose}
            title="Cerrar"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>

        {/* CONTENT */}
        <div className="px-6 py-6 flex-1 flex flex-col space-y-5 text-base text-gray-800 dark:text-gray-200 min-h-0">

          {/* FORMULARIO */}
          <form onSubmit={handleSubmit} className="flex gap-3 items-center">
            <input
              type="text"
              placeholder={
                modoEdicion
                  ? "Editar nombre de categoría"
                  : "Nombre de nueva categoría"
              }
              value={formState.nombre}
              onChange={(e) =>
                setFormState({ ...formState, nombre: e.target.value })
              }
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 shadow-sm"
            />

            {/* Botón Principal (Guardar/Añadir) */}
            <Button
              type="submit"
              variant="primary"
              leftIcon={modoEdicion ? <FaPen /> : <FaPlus />}
              isLoading={estaGuardando}
              disabled={estaGuardando}
            >
              {modoEdicion ? "Guardar" : "Añadir"}
            </Button>

            {/* Botón Cancelar Edición */}
            {modoEdicion && (
              <Button
                type="button"
                onClick={cancelarEdicion}
                variant="secondary"
              >
                Cancelar
              </Button>
            )}
          </form>

          {/* LISTA DE CATEGORÍAS */}
          {cargando ? (
            <p className="text-center text-purple-600 dark:text-purple-400 font-semibold py-8">
              Cargando categorías...
            </p>
          ) : errorCarga ? (
            <p className="text-center text-red-600 dark:text-red-400 font-semibold py-8">
              {errorCarga}
            </p>
          ) : categorias.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 italic text-center py-8">
              No hay categorías registradas.
            </p>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar transition-all">
              {categorias.map((categoria) => (
                <div
                  key={categoria.id}
                  className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-sm transition-colors"
                >
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                    {categoria.nombre}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => iniciarEdicion(categoria)}
                      title="Editar categoría"
                      variant="iconInfo"
                      size="icon"
                    >
                      <FaPen />
                    </Button>
                    <Button
                      onClick={() => confirmarEliminar(categoria.id)}
                      title="Eliminar categoría"
                      variant="iconDanger"
                      size="icon"
                    >
                      <FaTrashAlt />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex justify-end">
          <Button onClick={onClose} variant="secondary">
            Cerrar
          </Button>
        </div>

      {/* CONFIRMACIÓN ELIMINAR */}
      {mostrarConfirmacionEliminar && (
        <ConfirmacionModal
          titulo="Confirmar Eliminación"
          mensaje="¿Eliminar esta categoría? Si tiene elementos asociados, NO podrá eliminarse. Esta acción no se puede deshacer."
          textoConfirmar="Eliminar"
          onConfirm={ejecutarEliminar}
          onCancel={() => setMostrarConfirmacionEliminar(false)}
        />
      )}
    </Modal>
  );
}