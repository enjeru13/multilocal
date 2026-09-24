import { useEffect, useState, useMemo, useCallback } from "react";
import {
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaPrint,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  normalizarMoneda,
  type Moneda,
  type TasasConversion,
} from "../utils/monedaHelpers";
import { ordenesService } from "../services/ordenesService";
import { configuracionService } from "../services/configuracionService";
import { calcularResumenPago } from "@lavanderia/shared/utils/pagoFinance";
import { badgeEstado, badgePago } from "../utils/badgeHelpers";
import ModalDetalleOrden from "../components/modal/ModalDetalleOrden";
import ModalPago from "../components/modal/ModalPago";
import Button from "../components/ui/Button";
import ImprimirOrdenes from "../impresion/informes/InformeOrdenes";
import ControlesPaginacion from "../components/ControlesPaginacion";
import { TableSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import type {
  Orden,
  SortDirection,
  EstadoOrden,
  EstadoPagoRaw,
  Configuracion,
} from "@lavanderia/shared/types/types";
import { useAuth } from "../hooks/useAuth";
import { useEtiquetas } from "../context/configuracionCore";

type SortKeys = "id" | "cliente" | "estado" | "estadoPago";

export default function PantallaEstadoOrdenes() {
  const et = useEtiquetas();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [sortColumn, setSortColumn] = useState<SortKeys | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(
    null
  );
  const [tasas, setTasas] = useState<TasasConversion>({});
  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [cargandoOrdenDetalle, setCargandoOrdenDetalle] = useState(false);

  // Filtros
  const [filtroEstadoEntrega, setFiltroEstadoEntrega] = useState<
    EstadoOrden | "" | "TODOS"
  >("TODOS");
  const [filtroEstadoPago, setFiltroEstadoPago] = useState<
    EstadoPagoRaw | "" | "TODOS"
  >("TODOS");

  // Modales y Configuración
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [mostrarModalImprimir, setMostrarModalImprimir] = useState(false); // <--- NUEVO ESTADO
  const [configNegocio, setConfigNegocio] = useState<Configuracion | null>(
    null
  ); // <--- NUEVO ESTADO

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [totalFilteredItems, setTotalFilteredItems] = useState(0);

  const { hasRole } = useAuth();

  const cargarConfiguracion = useCallback(async () => {
    try {
      const res = await configuracionService.get();
      const config = res.data;

      // 1. GUARDAR CONFIGURACIÓN DEL NEGOCIO
      setConfigNegocio(config);

      const newMonedaPrincipal = normalizarMoneda(
        config.monedaPrincipal ?? "USD"
      );
      const newTasas = {
        VES: config.tasaVES ?? null,
        COP: config.tasaCOP ?? null,
      };
      setMonedaPrincipal((prevMoneda) => {
        if (prevMoneda !== newMonedaPrincipal) {
          return newMonedaPrincipal;
        }
        return prevMoneda;
      });
      setTasas((prevTasas) => {
        if (prevTasas.VES !== newTasas.VES || prevTasas.COP !== newTasas.COP) {
          return newTasas;
        }
        return prevTasas;
      });
    } catch (err) {
      console.error("Error al cargar configuración:", err);
      toast.error("Error al cargar configuración");
    }
  }, []);

  const cargarOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordenesService.getAll();
      const ordenesConEstadoPago = res.data.map((orden: Orden) => {
        const resumen = calcularResumenPago(orden, tasas, monedaPrincipal);
        return { ...orden, ...resumen };
      });
      setOrdenes(ordenesConEstadoPago);
    } catch (err) {
      console.error("Error al cargar órdenes:", err);
      toast.error(`Error al cargar ${et.ordenesMin}.`);
    } finally {
      setLoading(false);
    }
  }, [et, tasas, monedaPrincipal]);

  useEffect(() => {
    cargarConfiguracion().then(() => {
      cargarOrdenes();
    });
  }, [cargarConfiguracion, cargarOrdenes]);

  useEffect(() => {
    if (Object.keys(tasas).length > 0 && monedaPrincipal) {
      cargarOrdenes();
    }
  }, [tasas, monedaPrincipal, cargarOrdenes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [busqueda, filtroEstadoEntrega, filtroEstadoPago]);

  const handleSort = (column: SortKeys) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortKeys) => {
    if (sortColumn === column) {
      return sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />;
    }
    return <FaSort />;
  };

  // --- MEMO DE FILTRADO (Sin cambios en lógica, solo se usa para pasar al reporte) ---
  const ordenesFiltradasYSorteadas = useMemo(() => {
    let ordenesProcesadas = [...ordenes];

    if (busqueda.trim() !== "") {
      const terminoBusqueda = busqueda.trim().toLowerCase();
      ordenesProcesadas = ordenesProcesadas.filter((o) => {
        const matchId = String(o.id).includes(terminoBusqueda);
        const nombreCliente = `${o.cliente?.nombre ?? ""} ${o.cliente?.apellido ?? ""
          }`.toLowerCase();
        const matchCliente = nombreCliente.includes(terminoBusqueda);
        return matchId || matchCliente;
      });
    }

    if (filtroEstadoEntrega !== "" && filtroEstadoEntrega !== "TODOS") {
      ordenesProcesadas = ordenesProcesadas.filter(
        (o) => o.estado === filtroEstadoEntrega
      );
    }

    if (filtroEstadoPago !== "" && filtroEstadoPago !== "TODOS") {
      ordenesProcesadas = ordenesProcesadas.filter(
        (o) => o.estadoPago === filtroEstadoPago
      );
    }

    if (sortColumn) {
      ordenesProcesadas.sort((a, b) => {
        let valA: number | string;
        let valB: number | string;

        if (sortColumn === "id") {
          valA = a.id;
          valB = b.id;
        } else if (sortColumn === "cliente") {
          valA = `${a.cliente?.nombre ?? ""} ${a.cliente?.apellido ?? ""
            }`.toLowerCase();
          valB = `${b.cliente?.nombre ?? ""} ${b.cliente?.apellido ?? ""
            }`.toLowerCase();
        } else if (sortColumn === "estado") {
          valA = a.estado;
          valB = b.estado;
        } else if (sortColumn === "estadoPago") {
          valA = a.estadoPago;
          valB = b.estadoPago;
        } else {
          valA = "";
          valB = "";
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    setTotalFilteredItems(ordenesProcesadas.length);
    return ordenesProcesadas;
    // Nota: Retornamos TODAS las procesadas aquí para usarlas en el reporte
    // La paginación la aplicamos abajo solo para mostrar en pantalla
  }, [
    ordenes,
    busqueda,
    sortColumn,
    sortDirection,
    filtroEstadoEntrega,
    filtroEstadoPago,
  ]);

  const ordenesPaginadas = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return ordenesFiltradasYSorteadas.slice(startIndex, endIndex);
  }, [ordenesFiltradasYSorteadas, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(totalFilteredItems / itemsPerPage);
  }, [totalFilteredItems, itemsPerPage]);

  const handleVerDetallesOrden = async (ordenId: number) => {
    setCargandoOrdenDetalle(true);
    try {
      const res = await ordenesService.getById(ordenId);
      const ordenCompleta = res.data;

      if (ordenCompleta) {
        const resumen = calcularResumenPago(
          ordenCompleta,
          tasas,
          monedaPrincipal
        );
        setOrdenSeleccionada({ ...ordenCompleta, ...resumen });
      } else {
        toast.error("No se pudo cargar la información completa de la orden.");
      }
    } catch (error) {
      console.error("Error al cargar detalles de la orden:", error);
      toast.error("Error al cargar los detalles de la orden.");
    } finally {
      setCargandoOrdenDetalle(false);
    }
  };

  const handleAbrirPagoExtra = useCallback(
    (orden: Orden) => {
      if (hasRole(["ADMIN", "EMPLOYEE"])) {
        setOrdenSeleccionada(orden);
        setMostrarModalPago(true);
      } else {
        toast.error("No tienes permiso para registrar pagos adicionales.");
      }
    },
    [hasRole]
  );

  const handlePagoRegistrado = useCallback(
    (actualizada: Orden) => {
      const resumenActualizado = calcularResumenPago(
        actualizada,
        tasas,
        monedaPrincipal
      );
      const ordenParaActualizarEstado = {
        ...actualizada,
        ...resumenActualizado,
      };

      setOrdenes((prevOrdenes) => {
        const index = prevOrdenes.findIndex(
          (o) => o.id === ordenParaActualizarEstado.id
        );
        if (index > -1) {
          const newOrdenes = [...prevOrdenes];
          newOrdenes[index] = ordenParaActualizarEstado;
          return newOrdenes;
        }
        return prevOrdenes;
      });

      setMostrarModalPago(false);
      setOrdenSeleccionada(null);
      toast.success(`${et.orden} actualizada con el nuevo pago.`);
    },
    [et, tasas, monedaPrincipal]
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <TableSkeleton rows={10} cols={5} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-6">
        Estado de {et.ordenes}
      </h1>

      <div className="mb-5 flex flex-wrap items-center gap-4 font-semibold">
        <div className="flex flex-col">
          <label
            htmlFor="filtroBusquedaOrdenes"
            className="text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            Buscar
          </label>
          <div className="relative w-64">
            <FaSearch className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              id="filtroBusquedaOrdenes"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={`N° ${et.orden} o ${et.cliente}`}
              className="pl-9 pr-3 py-2 w-full rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-900 text-sm dark:text-gray-200"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label
            htmlFor="filtroEstadoEntrega"
            className="text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            Entrega
          </label>
          <select
            id="filtroEstadoEntrega"
            value={filtroEstadoEntrega}
            onChange={(e) =>
              setFiltroEstadoEntrega(e.target.value as EstadoOrden | "TODOS")
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-900 text-sm bg-white dark:bg-gray-950 dark:text-gray-200 cursor-pointer"
          >
            <option value="TODOS">Todas</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="ENTREGADO">Entregado</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label
            htmlFor="filtroEstadoPago"
            className="text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            Pago
          </label>
          <select
            id="filtroEstadoPago"
            value={filtroEstadoPago}
            onChange={(e) =>
              setFiltroEstadoPago(e.target.value as EstadoPagoRaw | "TODOS")
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-900 text-sm bg-white dark:bg-gray-950 dark:text-gray-200 cursor-pointer"
          >
            <option value="TODOS">Todos</option>
            <option value="COMPLETO">Completo</option>
            <option value="INCOMPLETO">Incompleto</option>
          </select>
        </div>

        {/* 2. BOTÓN DE IMPRIMIR REPORTE */}
        <div className="flex flex-col mt-5">
          <Button
            onClick={() => setMostrarModalImprimir(true)}
            variant="secondary"
            leftIcon={<FaPrint size={14} />}
          >
            Generar Reporte
          </Button>
        </div>
      </div>

      {loading || cargandoOrdenDetalle ? (
        <p className="text-gray-500 dark:text-gray-400">Cargando {et.ordenesMin}...</p>
      ) : ordenesFiltradasYSorteadas.length === 0 ? (
        <EmptyState
          title={`No se encontraron ${et.ordenesMin}`}
          description="Ajusta los filtros de búsqueda para ver resultados."
          icon={FaSearch}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 mb-4 bg-white dark:bg-gray-900">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
                <tr className="text-left">
                  <th
                    className="px-4 py-2 font-semibold cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center gap-1">
                      Orden {getSortIcon("id")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 font-semibold cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("cliente")}
                  >
                    <div className="flex items-center gap-1">
                      {et.cliente} {getSortIcon("cliente")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 font-semibold cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("estado")}
                  >
                    <div className="flex items-center gap-1">
                      Estado de Entrega {getSortIcon("estado")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 font-semibold cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("estadoPago")}
                  >
                    <div className="flex items-center gap-1">
                      Estado de Pago {getSortIcon("estadoPago")}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-center whitespace-nowrap">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordenesPaginadas.map(
                  (
                    o // Usamos ordenesPaginadas para la tabla
                  ) => (
                    <tr
                      key={o.id}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors duration-150 text-gray-700 dark:text-gray-300 font-semibold"
                    >
                      <td className="px-4 py-3 font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                        #{o.id}
                      </td>
                      <td className="px-4 py-3">
                        {o.cliente?.nombre} {o.cliente?.apellido}
                      </td>
                      <td className="px-4 py-3">{badgeEstado(o.estado)}</td>
                      <td className="px-4 py-3">{badgePago(o.estadoPago)}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          onClick={() => handleVerDetallesOrden(o.id)}
                          title={`Ver detalles de ${et.ordenMin}`}
                          variant="iconInfo"
                          size="icon"
                        >
                          <FaSearch size={14} />
                        </Button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <ControlesPaginacion
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {ordenSeleccionada && (
        <ModalDetalleOrden
          orden={ordenSeleccionada!}
          tasas={tasas}
          monedaPrincipal={monedaPrincipal}
          onClose={() => setOrdenSeleccionada(null)}
          onPagoRegistrado={handlePagoRegistrado}
          onAbrirPagoExtra={handleAbrirPagoExtra}
        />
      )}

      {mostrarModalPago && ordenSeleccionada && (
        <ModalPago
          orden={ordenSeleccionada!}
          tasas={tasas}
          monedaPrincipal={monedaPrincipal}
          onClose={() => setMostrarModalPago(false)}
          onPagoRegistrado={handlePagoRegistrado}
        />
      )}

      {/* 3. MODAL DE IMPRESIÓN */}
      <ImprimirOrdenes
        open={mostrarModalImprimir}
        onClose={() => setMostrarModalImprimir(false)}
        ordenes={ordenesFiltradasYSorteadas} // Todas las filtradas, no solo las de la página actual
        monedaPrincipal={monedaPrincipal}
        configuracion={configNegocio}
        filtros={[
          `Estado: ${!filtroEstadoEntrega || filtroEstadoEntrega === "TODOS" ? "todos" : String(filtroEstadoEntrega).toLowerCase()}`,
          `Pago: ${!filtroEstadoPago || filtroEstadoPago === "TODOS" ? "todos" : filtroEstadoPago === "COMPLETO" ? "pagados" : "con saldo"}`,
          ...(busqueda.trim() ? [`Búsqueda: «${busqueda.trim()}»`] : []),
        ]}
      />
    </div>
  );
}
