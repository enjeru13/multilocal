import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { FaFileSignature, FaPlus, FaSearch, FaChevronRight } from "react-icons/fa";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import type { Presupuesto } from "@lavanderia/shared/types/types";
import { presupuestosService } from "../services/presupuestosService";
import { destinatarioPresupuesto } from "../utils/presupuestoHelpers";
import EtiquetaEstado from "../components/presupuesto/EtiquetaEstado";
import { formatearMoneda, normalizarMoneda } from "../utils/monedaHelpers";
import { useConfiguracion } from "../context/configuracionCore";
import Button from "../components/ui/Button";
import TarjetaRegistro from "../components/ui/TarjetaRegistro";
import { TableSkeleton } from "../components/Skeleton";

const FILTROS = [
  { id: "", label: "Todos" },
  { id: "BORRADOR", label: "Borradores" },
  { id: "ENVIADO", label: "Enviados" },
  { id: "ACEPTADO", label: "Aceptados" },
  { id: "VENCIDO", label: "Vencidos" },
  { id: "CONVERTIDO", label: "Convertidos" },
  { id: "RECHAZADO", label: "Rechazados" },
] as const;

export default function PantallaPresupuestos() {
  const navigate = useNavigate();
  const { config } = useConfiguracion();
  const moneda = normalizarMoneda(config?.monedaPrincipal ?? "USD");
  const [estado, setEstado] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [lista, setLista] = useState<Presupuesto[]>([]);
  const [cargando, setCargando] = useState(true);
  const peticion = useRef(0);

  useEffect(() => {
    const n = ++peticion.current;
    const espera = setTimeout(async () => {
      setCargando(true);
      try {
        const res = await presupuestosService.getAll({ estado: estado || undefined, q: busqueda.trim() || undefined });
        if (n === peticion.current) setLista(res.data);
      } catch (err) {
        if (n === peticion.current) toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudieron cargar los presupuestos." : "No se pudieron cargar los presupuestos.");
      } finally {
        if (n === peticion.current) setCargando(false);
      }
    }, busqueda ? 250 : 0);
    return () => clearTimeout(espera);
  }, [estado, busqueda]);

  const abrir = (p: Presupuesto) => navigate(`/presupuestos/${p.id}`);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FaFileSignature className="text-blue-600 dark:text-blue-400" /> Presupuestos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Cotiza a tus clientes y conviértelo en venta cuando acepten.</p>
        </div>
        <Link to="/presupuestos/nuevo">
          <Button variant="primary" leftIcon={<FaPlus />}>
            Nuevo presupuesto
          </Button>
        </Link>
      </header>

      <div className="space-y-3">
        <div className="relative max-w-md">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente o número"
            className="w-full h-11 sm:h-10 pl-10 pr-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 max-sm:-mx-4 max-sm:px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Estado">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={estado === f.id}
              onClick={() => setEstado(f.id)}
              className={`shrink-0 h-9 px-3.5 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                estado === f.id ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {cargando && lista.length === 0 ? (
        <TableSkeleton rows={6} cols={5} />
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 py-14 text-center">
          <FaFileSignature className="mx-auto text-3xl text-gray-300 dark:text-gray-600 mb-3" />
          <p className="font-medium text-gray-700 dark:text-gray-300">{busqueda || estado ? "No hay presupuestos con ese filtro." : "Aún no has hecho ningún presupuesto."}</p>
          {!busqueda && !estado && (
            <Link to="/presupuestos/nuevo" className="inline-block mt-4">
              <Button variant="primary" leftIcon={<FaPlus />}>
                Hacer el primero
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="md:hidden space-y-3">
            {lista.map((p) => (
              <TarjetaRegistro
                key={p.id}
                titulo={destinatarioPresupuesto(p)}
                subtitulo={`Presupuesto N.º ${p.id}`}
                destacado={formatearMoneda(p.total, moneda)}
                chips={<EtiquetaEstado p={p} />}
                datos={[
                  { k: "Fecha", v: dayjs(p.fecha).format("DD/MM/YYYY") },
                  { k: "Válido hasta", v: dayjs(p.validoHasta).format("DD/MM/YYYY") },
                ]}
                onClick={() => abrir(p)}
              />
            ))}
          </ul>

          <div className="max-md:hidden overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">N.º</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Válido hasta</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {lista.map((p) => (
                  <tr key={p.id} onClick={() => abrir(p)} className="hover:bg-blue-50/60 dark:hover:bg-blue-900/10 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-semibold tabular-nums text-gray-900 dark:text-gray-100">#{p.id}</td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                      {destinatarioPresupuesto(p)}
                      {!p.cliente && <span className="ml-2 text-[11px] text-gray-400">sin ficha</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{dayjs(p.fecha).format("DD/MM/YYYY")}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{dayjs(p.validoHasta).format("DD/MM/YYYY")}</td>
                    <td className="px-4 py-3">
                      <EtiquetaEstado p={p} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatearMoneda(p.total, moneda)}</td>
                    <td className="pr-3 text-gray-300 dark:text-gray-600">
                      <FaChevronRight size={11} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
