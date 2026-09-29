import { useEffect, useState, useMemo, useCallback } from "react";
import { clientesService } from "../services/clientesService";
import type {
  Cliente,
  ClienteCreate,
  ClienteUpdatePayload,
} from "@lavanderia/shared/types/types";
import FormularioCliente from "../components/formulario/FormularioCliente";
import ModalInfoCliente from "../components/modal/ModalInfoCliente";
import TablaClientes from "../components/tabla/TablaClientes";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import { toast } from "react-toastify";
import { FaPlus, FaSearch, FaDownload } from "react-icons/fa";
import { exportarExcel, fechaArchivo } from "../utils/exportarExcel";
import { useAuth } from "../hooks/useAuth";
import ControlesPaginacion from "../components/ControlesPaginacion";
import { TableSkeleton } from "../components/Skeleton";
import Button from "../components/ui/Button";
import { useEtiquetas } from "../context/configuracionCore";

export default function PantallaClientes() {
  const et = useEtiquetas();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<
    Cliente | undefined
  >();
  const [clienteInfo, setClienteInfo] = useState<Cliente | undefined>();
  const [mostrarConfirmacionEliminar, setMostrarConfirmacionEliminar] =
    useState(false);
  const [clienteAEliminarId, setClienteAEliminarId] = useState<
    number | undefined
  >();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [totalFilteredItems, setTotalFilteredItems] = useState(0);

  const { hasRole } = useAuth();

  const exportar = async () => {
    try {
      await exportarExcel(
        `clientes_${fechaArchivo()}.xlsx`,
        "Clientes",
        [
          { titulo: "Nombre", ancho: 24, valor: (c: Cliente) => c.nombre },
          { titulo: "Apellido", ancho: 20, valor: (c) => c.apellido },
          { titulo: "Tipo", ancho: 12, valor: (c) => (c.tipo === "EMPRESA" ? "Empresa" : c.tipo === "NATURAL" ? "Persona" : null) },
          { titulo: "Documento", ancho: 16, valor: (c) => c.identificacion },
          { titulo: "Teléfono", ancho: 16, valor: (c) => c.telefono },
          { titulo: "Teléfono 2", ancho: 16, valor: (c) => c.telefono_secundario },
          { titulo: "Correo", ancho: 28, valor: (c) => c.email },
          { titulo: "Dirección", ancho: 40, valor: (c) => c.direccion },
        ],
        clientes
      );
      toast.success(`${clientes.length} cliente(s) exportados a Excel.`);
    } catch {
      toast.error("No se pudo crear el archivo de Excel.");
    }
  };

  const cargarClientes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await clientesService.getAll();
      setClientes(res.data);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      toast.error(`Error al cargar ${et.clientesMin}`);
    } finally {
      setLoading(false);
    }
  }, [et]);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [busqueda]);

  const clientesFiltradosYPaginados = useMemo(() => {
    const clientesProcesados = clientes.filter((c) => {
      const nombreCompleto = `${c.nombre} ${c.apellido}`.toLowerCase();
      const cedula = (c.identificacion || "").toLowerCase();
      const telefono = (c.telefono || "").toLowerCase();
      const terminoBusqueda = busqueda.toLowerCase();

      return (
        nombreCompleto.includes(terminoBusqueda) ||
        cedula.includes(terminoBusqueda) ||
        telefono.includes(terminoBusqueda)
      );
    });

    setTotalFilteredItems(clientesProcesados.length);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return clientesProcesados.slice(startIndex, endIndex);
  }, [clientes, busqueda, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(totalFilteredItems / itemsPerPage);
  }, [totalFilteredItems, itemsPerPage]);

  const abrirNuevoCliente = useCallback(() => {
    if (hasRole(["ADMIN", "EMPLOYEE"])) {
      setClienteSeleccionado(undefined);
      setMostrarFormulario(true);
    } else {
      toast.error(`No tienes permiso para registrar ${et.clientesMin}.`);
    }
  }, [et, hasRole]);

  // El formulario muestra los avisos de éxito/error; aquí solo se guarda y
  // se deja propagar el error para que el formulario no se cierre en falso.
  const guardarCliente = useCallback(
    async (data: ClienteCreate | (ClienteUpdatePayload & { id: number })) => {
      if ("id" in data && data.id) {
        await clientesService.update(data.id, data as ClienteUpdatePayload);
      } else {
        await clientesService.create(data as ClienteCreate);
      }
      setMostrarFormulario(false);
      setClienteSeleccionado(undefined);
      cargarClientes();
    },
    [cargarClientes]
  );

  const handleEditarCliente = useCallback(
    (cliente: Cliente) => {
      if (hasRole(["ADMIN", "EMPLOYEE"])) {
        setClienteSeleccionado(cliente);
        setMostrarFormulario(true);
      } else {
        toast.error(`No tienes permiso para editar ${et.clientesMin}.`);
      }
    },
    [et, hasRole]
  );

  const handleEliminarCliente = useCallback(
    (id: number) => {
      if (hasRole(["ADMIN"])) {
        setClienteAEliminarId(id);
        setMostrarConfirmacionEliminar(true);
      } else {
        toast.error(`No tienes permiso para eliminar ${et.clientesMin}.`);
      }
    },
    [et, hasRole]
  );

  const ejecutarEliminarCliente = useCallback(async () => {
    if (clienteAEliminarId === undefined) return;

    try {
      await clientesService.delete(clienteAEliminarId);
      toast.success(`${et.cliente} eliminado correctamente`);
      cargarClientes();
    } catch (error) {
      console.error("Error al eliminar cliente:", error);
      toast.error(`Error al eliminar ${et.clienteMin}`);
    } finally {
      setMostrarConfirmacionEliminar(false);
      setClienteAEliminarId(undefined);
    }
  }, [et, clienteAEliminarId, cargarClientes]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{et.clientes}</h1>

        <div className="flex gap-3 flex-wrap">
          {hasRole(["ADMIN", "EMPLOYEE"]) && (
            <Button onClick={exportar} variant="secondary" leftIcon={<FaDownload className="w-4 h-4" />} disabled={clientes.length === 0}>
              Exportar a Excel
            </Button>
          )}
          <Button
            onClick={abrirNuevoCliente}
            variant="primary"
            leftIcon={<FaPlus className="w-4 h-4" />}
          >
            Nuevo {et.cliente}
          </Button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3 font-semibold">
        <div className="flex flex-col w-full sm:w-auto">
          <label
            htmlFor="filtroBusquedaCliente"
            className="text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            Buscar por Nombre, Apellido, Cédula o Teléfono
          </label>
          <div className="relative w-full sm:w-72">
            <FaSearch className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              id="filtroBusquedaCliente"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, apellido, cédula o teléfono"
              className="pl-9 pr-3 py-2 w-full rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-900 text-sm dark:text-gray-200"
            />
          </div>
        </div>
      </div>

      {clientesFiltradosYPaginados.length === 0 && totalFilteredItems > 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No se encontraron {et.clientesMin} en esta página con los filtros aplicados.
        </p>
      ) : clientesFiltradosYPaginados.length === 0 &&
        totalFilteredItems === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No se encontraron {et.clientesMin} con los filtros aplicados.
        </p>
      ) : (
        <>
          <TablaClientes
            clientes={clientesFiltradosYPaginados}
            onVerInfo={(c) => setClienteInfo(c)}
            onEditar={handleEditarCliente}
            onEliminar={handleEliminarCliente}
          />
          {totalPages > 1 && (
            <ControlesPaginacion
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {mostrarFormulario && (
        <FormularioCliente
          cliente={clienteSeleccionado}
          onClose={() => setMostrarFormulario(false)}
          onSubmit={guardarCliente}
        />
      )}

      {clienteInfo && (
        <ModalInfoCliente
          cliente={clienteInfo}
          onClose={() => setClienteInfo(undefined)}
        />
      )}

      {mostrarConfirmacionEliminar && (
        <ConfirmacionModal
          mensaje={`¿Eliminar ${et.clienteMin}? Esta acción no se puede deshacer.`}
          onConfirm={ejecutarEliminarCliente}
          onCancel={() => {
            setMostrarConfirmacionEliminar(false);
            setClienteAEliminarId(undefined);
          }}
        />
      )}
    </div>
  );
}