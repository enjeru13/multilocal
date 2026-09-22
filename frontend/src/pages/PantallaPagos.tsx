import { useEffect, useState, useMemo, useCallback } from "react";
import { FaPrint, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import {
  formatearMoneda,
  convertirAmonedaPrincipal,
  normalizarMoneda,
  type Moneda,
  type TasasConversion,
} from "../utils/monedaHelpers";
import { pagosService } from "../services/pagosService";
import { configuracionService } from "../services/configuracionService";
import { ordenesService } from "../services/ordenesService";
import ControlesPaginacion from "../components/ControlesPaginacion";
import ModalDetalleOrden from "../components/modal/ModalDetalleOrden";
import TablaPagos from "../components/tabla/TablaPagos";
import ModalImprimirPagos from "../components/modal/ModalImprimirPagos";
import { TableSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { FaMoneyBillWave } from "react-icons/fa";
import type { Pago, Orden, Configuracion } from "@lavanderia/shared/types/types";
import Button from "../components/ui/Button";

interface PagoConOrden extends Pago {
  orden?: Orden & { cliente?: { nombre: string; apellido: string } };
  tasa?: number | null;
}

type SortKeys = "fechaPago" | "ordenId" | "monto";
type SortDirection = "asc" | "desc";

export default function PantallaPagos() {
  const [pagos, setPagos] = useState<PagoConOrden[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [configNegocio, setConfigNegocio] = useState<Configuracion | null>(null);

  const [mesSeleccionado, setMesSeleccionado] = useState(dayjs().month());
  const [anioSeleccionado, setAnioSeleccionado] = useState(dayjs().year());
  const [monedaFiltro, setMonedaFiltro] = useState<Moneda | "TODAS">("TODAS");

  const [sortColumn, setSortColumn] = useState<SortKeys | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(null);
  const [tasas, setTasas] = useState<TasasConversion>({});
  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [cargandoOrdenDetalle, setCargandoOrdenDetalle] = useState(false);
  const [mostrarModalImprimir, setMostrarModalImprimir] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  const cargarPagos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await pagosService.getAll();
      setPagos(res.data || []);
    } catch (err) {
      console.error("Error al cargar pagos:", err);
      toast.error("Error al cargar el historial de pagos.");
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarConfiguracion = useCallback(async () => {
    try {
      const res = await configuracionService.get();
      const config = res.data;
      setConfigNegocio(config);
      setMonedaPrincipal(normalizarMoneda(config.monedaPrincipal ?? "USD"));
      setTasas({
        VES: config.tasaVES ?? null,
        COP: config.tasaCOP ?? null,
      });
    } catch (err) {
      console.error("Error al cargar configuración:", err);
      toast.error("Error al cargar configuración");
    }
  }, []);

  useEffect(() => {
    cargarConfiguracion().then(cargarPagos);
  }, [cargarConfiguracion, cargarPagos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroBusqueda, mesSeleccionado, anioSeleccionado, monedaFiltro]);

  const handleSort = (column: SortKeys) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const pagosFiltradosYSorteadas = useMemo(() => {
    const pagosFiltrados = pagos.filter((pago) => {
      const termino = filtroBusqueda.trim().toLowerCase();
      const matchOrdenId = String(pago.ordenId).includes(termino);
      const nombreCliente = `${pago.orden?.cliente?.nombre ?? ""} ${pago.orden?.cliente?.apellido ?? ""
        }`.toLowerCase();
      const matchCliente = nombreCliente.includes(termino);

      const fechaPago = dayjs(pago.fechaPago);
      const coincideMes = fechaPago.month() === mesSeleccionado;
      const coincideAnio = fechaPago.year() === anioSeleccionado;
      const coincideMoneda = monedaFiltro === "TODAS" || pago.moneda === monedaFiltro;

      return (matchOrdenId || matchCliente) && coincideMes && coincideAnio && coincideMoneda;
    });

    const pagosProcesados = [...pagosFiltrados];

    if (sortColumn) {
      pagosProcesados.sort((a, b) => {
        let valA: number;
        let valB: number;

        if (sortColumn === "fechaPago") {
          valA = dayjs(a.fechaPago).valueOf();
          valB = dayjs(b.fechaPago).valueOf();
        } else if (sortColumn === "ordenId") {
          valA = a.ordenId;
          valB = b.ordenId;
        } else {
          // Default: monto
          const tasaEfectivaA = a.tasa && a.tasa > 0 ? a.tasa : tasas[a.moneda as keyof TasasConversion];
          const tasasSnapshotA = { ...tasas, [a.moneda]: tasaEfectivaA };
          const tasaEfectivaB = b.tasa && b.tasa > 0 ? b.tasa : tasas[b.moneda as keyof TasasConversion];
          const tasasSnapshotB = { ...tasas, [b.moneda]: tasaEfectivaB };

          valA = convertirAmonedaPrincipal(a.monto, a.moneda, tasasSnapshotA, monedaPrincipal);
          valB = convertirAmonedaPrincipal(b.monto, b.moneda, tasasSnapshotB, monedaPrincipal);
        }

        return sortDirection === "asc" ? valA - valB : valB - valA;
      });
    }

    const totalIngresos = pagosFiltrados.reduce((sum, pago) => {
      // Safeguard: If tasa is 1 and currency is not USD, it's a 1:1 bug.
      const tasaHistorica = (pago.tasa && pago.tasa > 1) || (pago.tasa === 1 && pago.moneda === "USD")
        ? pago.tasa
        : tasas[pago.moneda as keyof TasasConversion];

      const tasasSnapshot = { ...tasas, [pago.moneda]: tasaHistorica };
      const montoAbonado = convertirAmonedaPrincipal(pago.monto, pago.moneda, tasasSnapshot, monedaPrincipal);

      // Subtract vueltos if they exist
      const totalVueltos = (pago.vueltos ?? []).reduce((vSum, v) => {
        const vMoneda = v.moneda as Moneda;
        return vSum + convertirAmonedaPrincipal(v.monto, vMoneda, tasasSnapshot, monedaPrincipal);
      }, 0);

      return sum + (montoAbonado - totalVueltos);
    }, 0);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = pagosProcesados.slice(startIndex, startIndex + itemsPerPage);

    return {
      pagos: paginated,
      pagosCompletos: pagosProcesados,
      totalIngresos,
      totalFilteredItems: pagosProcesados.length,
    };
  }, [pagos, sortColumn, currentPage, itemsPerPage, filtroBusqueda, mesSeleccionado, anioSeleccionado, monedaFiltro, sortDirection, tasas, monedaPrincipal]);

  const {
    pagos: pagosParaMostrar,
    pagosCompletos,
    totalIngresos,
    totalFilteredItems,
  } = pagosFiltradosYSorteadas;

  const totalPages = useMemo(() => {
    return Math.ceil(totalFilteredItems / itemsPerPage);
  }, [totalFilteredItems, itemsPerPage]);

  const handleVerDetallesOrden = async (ordenId: number) => {
    setCargandoOrdenDetalle(true);
    try {
      const res = await ordenesService.getById(ordenId);
      setOrdenSeleccionada(res.data ?? null);
    } catch (error) {
      console.error("Error al cargar detalles de la orden:", error);
      toast.error("Error al cargar los detalles de la orden.");
    } finally {
      setCargandoOrdenDetalle(false);
    }
  };

  const handlePagoRegistrado = useCallback(() => {
    cargarPagos();
  }, [cargarPagos]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <TableSkeleton rows={10} cols={6} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Historial de pagos
      </h1>

      <div className="mb-5 flex flex-wrap items-center gap-4 font-semibold">
        <div className="flex flex-col">
          <label htmlFor="filtroBusqueda" className="text-xs text-gray-500 dark:text-gray-400 mb-1">Buscar</label>
          <div className="relative w-72">
            <FaSearch className="absolute top-2.5 left-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              id="filtroBusqueda"
              value={filtroBusqueda}
              onChange={(e) => setFiltroBusqueda(e.target.value)}
              placeholder="Orden o cliente"
              className="pl-9 pr-3 py-2 w-full rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-900 text-sm dark:text-gray-200"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mes</label>
          <select
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-900 text-sm bg-white dark:bg-gray-950 dark:text-gray-200 cursor-pointer"
          >
            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((mes, i) => (
              <option key={i} value={i}>{mes}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">Año</label>
          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-900 text-sm bg-white dark:bg-gray-950 dark:text-gray-200 cursor-pointer"
          >
            {[2024, 2025, 2026, 2027].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col mt-5">
          <Button
            onClick={() => setMostrarModalImprimir(true)}
            variant="secondary"
            leftIcon={<FaPrint size={14} />}
          >
            Imprimir reporte
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800/50 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <span className="text-blue-800 dark:text-blue-300 font-semibold text-lg">
            Total Ingresos ({dayjs().month(mesSeleccionado).format("MMMM")}):
          </span>
          <span className="text-blue-900 dark:text-blue-100 font-bold text-2xl">
            {formatearMoneda(totalIngresos, monedaPrincipal)}
          </span>
        </div>
      </div>

      {/* TABLA */}
      {loading || cargandoOrdenDetalle ? (
        <p className="text-gray-500">Cargando pagos...</p>
      ) : pagosParaMostrar.length === 0 ? (
        <EmptyState
          title="Sin pagos registrados"
          description="No se encontraron pagos para los filtros seleccionados en este periodo."
          icon={FaMoneyBillWave}
        />
      ) : (
        <>
          <TablaPagos
            pagos={pagosParaMostrar}
            monedaPrincipal={monedaPrincipal}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            monedaFiltro={monedaFiltro}
            setMonedaFiltro={setMonedaFiltro}
            cargandoOrdenDetalle={cargandoOrdenDetalle}
            onSort={handleSort}
            onVerDetallesOrden={handleVerDetallesOrden}
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

      {ordenSeleccionada && (
        <ModalDetalleOrden
          orden={ordenSeleccionada}
          tasas={tasas}
          monedaPrincipal={monedaPrincipal}
          onClose={() => setOrdenSeleccionada(null)}
          onPagoRegistrado={handlePagoRegistrado}
          onAbrirPagoExtra={() => { }}
        />
      )}

      <ModalImprimirPagos
        visible={mostrarModalImprimir}
        onClose={() => setMostrarModalImprimir(false)}
        pagos={pagosCompletos}
        monedaPrincipal={monedaPrincipal}
        totalIngresos={totalIngresos}
        configuracion={configNegocio}
      />
    </div>
  );
}