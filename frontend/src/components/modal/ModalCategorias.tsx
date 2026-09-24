import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaTags, FaPlus, FaPen, FaTrashAlt } from "react-icons/fa";
import { categoriasService } from "../../services/categoriasService";
import { Categoria } from "@lavanderia/shared/types/types";
import { AxiosError } from "axios";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { ModalEncabezado, ModalPie, campo } from "../ui/Formulario";
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
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="h-[80dvh] max-h-[620px] flex flex-col overflow-hidden">
      <ModalEncabezado icono={<FaTags />} titulo="Categorías" subtitulo={cargando ? undefined : `${categorias.length} en total`} onClose={onClose} />

      <form onSubmit={handleSubmit} className="px-4 sm:px-6 pt-4 pb-3 flex gap-2.5 items-center">
        <input
          type="text"
          placeholder={modoEdicion ? "Nuevo nombre de la categoría" : "Nombre de la nueva categoría"}
          value={formState.nombre}
          onChange={(e) => setFormState({ ...formState, nombre: e.target.value })}
          className={`${campo} flex-1`}
          autoFocus
        />
        <Button type="submit" variant="primary" leftIcon={modoEdicion ? <FaPen /> : <FaPlus />} isLoading={estaGuardando} disabled={estaGuardando}>
          {modoEdicion ? "Guardar" : "Añadir"}
        </Button>
        {modoEdicion && (
          <Button type="button" onClick={cancelarEdicion} variant="secondary">
            Cancelar
          </Button>
        )}
      </form>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 min-h-0">
        {cargando ? (
          <p className="text-center text-sm text-gray-500 py-10">Cargando categorías…</p>
        ) : errorCarga ? (
          <p className="text-center text-sm text-red-600 dark:text-red-400 py-10">{errorCarga}</p>
        ) : categorias.length === 0 ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">Aún no hay categorías. Crea la primera arriba.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
            {categorias.map((categoria) => (
              <li key={categoria.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${formState.id === categoria.id ? "bg-blue-50/60 dark:bg-blue-500/10" : ""}`}>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{categoria.nombre}</span>
                <span className="flex gap-1.5 shrink-0">
                  <Button onClick={() => iniciarEdicion(categoria)} title="Editar categoría" variant="iconInfo" size="icon">
                    <FaPen />
                  </Button>
                  <Button onClick={() => confirmarEliminar(categoria.id)} title="Eliminar categoría" variant="iconDanger" size="icon">
                    <FaTrashAlt />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModalPie>
        <Button onClick={onClose} variant="secondary">
          Cerrar
        </Button>
      </ModalPie>

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