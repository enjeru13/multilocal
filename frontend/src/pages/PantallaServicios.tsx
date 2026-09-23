import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { FaPlus, FaTags, FaSearch } from "react-icons/fa";
import TablaServicios from "../components/tabla/TablaServicios";
import FormularioServicio from "../components/formulario/FormularioServicio";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import { servicioService } from "../services/serviciosService";
import { configuracionService } from "../services/configuracionService";
import { categoriasService } from "../services/categoriasService";
import { useAuth } from "../hooks/useAuth";
import type {
  Servicio,
  ServicioCreate,
  ServicioUpdatePayload,
  Moneda,
  Categoria,
} from "@lavanderia/shared/types/types";
import CategoriasModal from "../components/modal/ModalCategorias";
import ControlesPaginacion from "../components/ControlesPaginacion";
import { TableSkeleton } from "../components/Skeleton";
import { useEtiquetas } from "../context/configuracionCore";
import Button from "../components/ui/Button"; // 1. Importamos el Button

export default function PantallaServicios() {
  const et = useEtiquetas();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<
    Servicio | undefined
  >();
  const [mostrarConfirmacionEliminar, setMostrarConfirmacionEliminar] =
    useState(false);
  const [servicioAEliminarId, setServicioAEliminarId] = useState<
    number | undefined
  >();
  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [mostrarCategoriasModal, setMostrarCategoriasModal] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [totalFilteredItems, setTotalFilteredItems] = useState(0);

  const { hasRole } = useAuth();

  const cargarServicios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await servicioService.getAll();
      setServicios(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error al cargar servicios:", error);
      toast.error(`No se pudieron cargar ${et.serviciosMin}`);
    } finally {
      setLoading(false);
    }
  }, [et]);

  const cargarCategoriasEnPantalla = useCallback(async () => {
    setCargandoCategorias(true);
    try {
      const res = await categoriasService.getAll();
      setCategorias(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("Error al cargar categorías en PantallaServicios:", error);
      toast.error("No se pudieron cargar las categorías.");
    } finally {
      setCargandoCategorias(false);
    }
  }, []);

  const cargarConfiguracion = useCallback(async () => {
    try {
      const res = await configuracionService.get();
      setMonedaPrincipal(res.data.monedaPrincipal);
    } catch (error) {
      console.error("Error al cargar configuración:", error);
      toast.error("Error al cargar la configuración de moneda.");
    }
  }, []);

  useEffect(() => {
    cargarConfiguracion();
    cargarCategoriasEnPantalla();
    cargarServicios();
  }, [cargarServicios, cargarConfiguracion, cargarCategoriasEnPantalla]);

  useEffect(() => {
    setCurrentPage(1);
  }, [busqueda]);

  const serviciosFiltradosYPaginados = useMemo(() => {
    const serviciosProcesados = servicios.filter((s) => {
      const nombreServicio = (s.nombreServicio || "").toLowerCase();
      const descripcion = (s.descripcion || "").toLowerCase();
      const categoria = (s.categoria?.nombre || "").toLowerCase();
      const terminoBusqueda = busqueda.toLowerCase();

      return (
        nombreServicio.includes(terminoBusqueda) ||
        descripcion.includes(terminoBusqueda) ||
        categoria.includes(terminoBusqueda)
      );
    });

    setTotalFilteredItems(serviciosProcesados.length);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return serviciosProcesados.slice(startIndex, endIndex);
  }, [servicios, busqueda, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(totalFilteredItems / itemsPerPage);
  }, [totalFilteredItems, itemsPerPage]);

  const abrirNuevoServicio = useCallback(() => {
    if (hasRole(["ADMIN"])) {
      setServicioSeleccionado(undefined);
      setMostrarFormulario(true);
    } else {
      toast.error(`No tienes permiso para registrar ${et.serviciosMin}.`);
    }
  }, [et, hasRole]);

  const editarServicio = useCallback(
    (servicio: Servicio) => {
      if (hasRole(["ADMIN"])) {
        setServicioSeleccionado(servicio);
        setMostrarFormulario(true);
      } else {
        toast.error(`No tienes permiso para editar ${et.serviciosMin}.`);
      }
    },
    [et, hasRole]
  );

  const guardarServicio = useCallback(
    async (data: ServicioCreate | (ServicioUpdatePayload & { id: number })) => {
      try {
        if ("id" in data && data.id) {
          await servicioService.update(data.id, data as ServicioUpdatePayload);
          toast.success(`${et.servicio} actualizado correctamente`);
        } else {
          await servicioService.create(data as ServicioCreate);
          toast.success(`${et.servicio} registrado correctamente`);
        }
        setMostrarFormulario(false);
        setServicioSeleccionado(undefined);
        cargarServicios();
        cargarCategoriasEnPantalla();
      } catch (error) {
        console.error("Error al guardar servicio:", error);
        toast.error(`Error al guardar ${et.servicioMin}`);
      }
    },
    [et, cargarServicios, cargarCategoriasEnPantalla]
  );

  const confirmarEliminarServicio = useCallback(
    (id: number) => {
      if (hasRole(["ADMIN"])) {
        setServicioAEliminarId(id);
        setMostrarConfirmacionEliminar(true);
      } else {
        toast.error(`No tienes permiso para eliminar ${et.serviciosMin}.`);
      }
    },
    [et, hasRole]
  );

  const ejecutarEliminarServicio = useCallback(async () => {
    if (servicioAEliminarId === undefined) return;

    try {
      await servicioService.delete(servicioAEliminarId);
      toast.success(`${et.servicio} eliminado correctamente`);
      cargarServicios();
    } catch (error) {
      console.error("Error al eliminar servicio:", error);
      toast.error(`Error al eliminar ${et.servicioMin}`);
    } finally {
      setMostrarConfirmacionEliminar(false);
      setServicioAEliminarId(undefined);
    }
  }, [et, servicioAEliminarId, cargarServicios]);

  const abrirCategoriasModal = useCallback(() => {
    if (hasRole(["ADMIN"])) {
      setMostrarCategoriasModal(true);
    } else {
      toast.error("No tienes permiso para gestionar categorías.");
    }
  }, [hasRole]);

  const cerrarCategoriasModal = useCallback(() => {
    setMostrarCategoriasModal(false);
    cargarCategoriasEnPantalla();
    cargarServicios();
  }, [cargarCategoriasEnPantalla, cargarServicios]);

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton rows={10} cols={5} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{et.servicios}</h1>

        {/* 2. Botones actualizados */}
        <div className="flex gap-4 flex-wrap">
          <Button
            onClick={abrirCategoriasModal}
            variant="secondary"
            leftIcon={<FaTags className="w-4 h-4" />}
          >
            Gestionar Categorías
          </Button>

          <Button
            onClick={abrirNuevoServicio}
            variant="primary"
            leftIcon={<FaPlus className="w-4 h-4" />}
          >
            Nuevo {et.servicio}
          </Button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3 font-semibold">
        <div className="flex flex-col">
          <label
            htmlFor="filtroBusquedaServicio"
            className="text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            Buscar por Nombre, Descripción o Categoría
          </label>
          <div className="relative w-72">
            <FaSearch className="absolute top-2.5 left-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              id="filtroBusquedaServicio"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, descripción o categoría"
              className="pl-9 pr-3 py-2 w-full rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-900 text-sm dark:text-gray-200"
            />
          </div>
        </div>
      </div>

      {serviciosFiltradosYPaginados.length === 0 && totalFilteredItems > 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No se encontraron {et.serviciosMin} en esta página con los filtros aplicados.
        </p>
      ) : serviciosFiltradosYPaginados.length === 0 &&
        totalFilteredItems === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No se encontraron {et.serviciosMin} con los filtros aplicados.
        </p>
      ) : (
        <>
          <TablaServicios
            servicios={serviciosFiltradosYPaginados}
            onEditar={editarServicio}
            onEliminar={confirmarEliminarServicio}
            monedaPrincipal={monedaPrincipal}
          />
          {totalPages > 1 && (
            <div className="mt-6">
              <ControlesPaginacion
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {mostrarFormulario && (
        <FormularioServicio
          servicio={servicioSeleccionado}
          onClose={() => {
            setMostrarFormulario(false);
            setServicioSeleccionado(undefined);
            cargarServicios();
            cargarCategoriasEnPantalla();
          }}
          onSubmit={guardarServicio}
          categorias={categorias}
          cargandoCategorias={cargandoCategorias}
        />
      )}

      {mostrarConfirmacionEliminar && (
        <ConfirmacionModal
          mensaje={`¿Eliminar ${et.servicioMin}? Esta acción no se puede deshacer.`}
          onConfirm={ejecutarEliminarServicio}
          onCancel={() => {
            setMostrarConfirmacionEliminar(false);
            setServicioAEliminarId(undefined);
          }}
        />
      )}

      {mostrarCategoriasModal && (
        <CategoriasModal onClose={cerrarCategoriasModal} />
      )}
    </div>
  );
}