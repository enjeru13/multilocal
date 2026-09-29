import { FaPen, FaTrashAlt, FaExclamationTriangle, FaCamera } from "react-icons/fa";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import type { Servicio } from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import Button from "../ui/Button";
import TarjetaRegistro from "../ui/TarjetaRegistro";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";
import { estadoStock } from "../../utils/stockHelpers";
import { urlImagenServicio } from "../../utils/apiClient";

function MiniaturaServicio({ imagen, tamano = "w-9 h-9" }: { imagen: string | null; tamano?: string }) {
  const url = urlImagenServicio(imagen);
  return (
    <div className={`${tamano} shrink-0 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 overflow-hidden flex items-center justify-center`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <FaCamera className="text-gray-300 dark:text-gray-700" size={13} />}
    </div>
  );
}

type Props = {
  servicios: Servicio[];
  onEditar: (servicio: Servicio) => void;
  onEliminar: (id: number) => void;
  monedaPrincipal: Moneda;
};

const th = "px-6 py-3 text-left";

export default function TablaServicios({ servicios, onEditar, onEliminar, monedaPrincipal }: Props) {
  const et = useEtiquetas();
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const inventario = !!config?.moduloInventario;
  const veCosto = inventario && hasRole(["ADMIN", "EMPLOYEE"]);
  const columnas = 3 + (inventario ? (veCosto ? 3 : 1) : 1) + 1;

  return (
    <>
    <ul className="md:hidden space-y-2.5">
      {servicios.length === 0 && <li className="text-center text-sm text-gray-500 dark:text-gray-400 italic py-8">No hay {et.serviciosMin} registrados.</li>}
      {servicios.map((s) => {
        const stock = estadoStock(s);
        const margen = s.costoBase !== null && s.costoBase !== undefined && s.precioBase > 0 ? ((s.precioBase - s.costoBase) / s.precioBase) * 100 : null;
        const datos: { k: string; v: React.ReactNode }[] = [];
        if (inventario && stock !== null) datos.push({ k: "Existencias", v: s.stockActual });
        if (veCosto && s.costoBase !== null && s.costoBase !== undefined) datos.push({ k: "Costo", v: formatearMoneda(s.costoBase, monedaPrincipal) });
        if (veCosto && margen !== null) datos.push({ k: "Margen", v: `${margen.toFixed(1)}%` });
        return (
          <TarjetaRegistro
            key={s.id}
            titulo={
              <span className="flex items-center gap-2.5">
                <MiniaturaServicio imagen={s.imagen} />
                {s.nombreServicio}
              </span>
            }
            destacado={<span className="text-indigo-700 dark:text-indigo-400">{formatearMoneda(s.precioBase, monedaPrincipal)}</span>}
            subtitulo={[s.categoria?.nombre || "Sin categoría", inventario ? s.sku || s.codigoBarras : null].filter(Boolean).join(" · ")}
            chips={
              <>
                {stock === "bajo" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[11px] font-semibold"><FaExclamationTriangle size={9} /> Stock bajo</span>}
                {stock === "sin" && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 px-2 py-0.5 text-[11px] font-semibold"><FaExclamationTriangle size={9} /> Agotado</span>}
                {config?.impuestoActivo && s.exentoImpuesto && <span className="rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 text-[11px] font-semibold">Exento</span>}
              </>
            }
            datos={datos}
            acciones={
              hasRole(["ADMIN"]) ? (
                <>
                  <Button onClick={() => onEditar(s)} variant="secondary" size="sm" className="flex-1" leftIcon={<FaPen size={11} />}>
                    Editar
                  </Button>
                  <Button onClick={() => onEliminar(s.id)} title={`Eliminar ${et.servicioMin}`} aria-label="Eliminar" variant="iconDanger" size="icon">
                    <FaTrashAlt size={12} />
                  </Button>
                </>
              ) : undefined
            }
          />
        );
      })}
    </ul>

    <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all">
      <table className="min-w-full text-sm transition-colors">
        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
          <tr>
            <th className={th}>{et.servicio}</th>
            <th className={th}>Categoría</th>
            <th className={th}>Precio</th>
            {inventario ? (
              <>
                {veCosto && (
                  <>
                    <th className={th}>Costo</th>
                    <th className={th}>Margen</th>
                  </>
                )}
                <th className={th}>Stock</th>
              </>
            ) : (
              <th className={th}>Descripción</th>
            )}
            <th className="px-6 py-3 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {servicios.length === 0 && (
            <tr>
              <td colSpan={columnas} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic">
                No hay {et.serviciosMin} registrados.
              </td>
            </tr>
          )}
          {servicios.map((s) => {
            const stock = estadoStock(s);
            const margen =
              s.costoBase !== null && s.costoBase !== undefined && s.precioBase > 0
                ? ((s.precioBase - s.costoBase) / s.precioBase) * 100
                : null;
            return (
              <tr
                key={s.id}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-150 text-gray-700 dark:text-gray-300"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <MiniaturaServicio imagen={s.imagen} />
                    <div>
                      <div className="text-gray-800 dark:text-gray-100 font-semibold">{s.nombreServicio}</div>
                      {inventario && (s.sku || s.codigoBarras) && (
                        <div className="text-xs text-gray-400 font-normal tabular-nums">
                          {[s.sku, s.codigoBarras].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-400">{s.categoria?.nombre || "Sin Categoría"}</td>
                <td className="px-6 py-4 text-indigo-700 dark:text-indigo-400 font-extrabold tabular-nums">
                  {formatearMoneda(s.precioBase, monedaPrincipal)}
                  {config?.impuestoActivo && s.exentoImpuesto && (
                    <span className="ml-2 text-[10px] font-semibold uppercase text-gray-400">exento</span>
                  )}
                </td>

                {inventario ? (
                  <>
                    {veCosto && (
                      <>
                        <td className="px-6 py-4 tabular-nums text-gray-600 dark:text-gray-400">
                          {s.costoBase !== null && s.costoBase !== undefined ? formatearMoneda(s.costoBase, monedaPrincipal) : "—"}
                        </td>
                        <td
                          className={`px-6 py-4 tabular-nums font-semibold ${
                            margen === null
                              ? "text-gray-400"
                              : margen >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {margen === null ? "—" : `${margen.toFixed(1)}%`}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4">
                      {stock === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 tabular-nums font-semibold ${
                            stock === "ok"
                              ? "text-gray-700 dark:text-gray-300"
                              : stock === "bajo"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {stock !== "ok" && <FaExclamationTriangle size={11} />}
                          {s.stockActual}
                          {stock === "sin" && <span className="text-xs font-normal">agotado</span>}
                          {stock === "bajo" && <span className="text-xs font-normal">bajo</span>}
                        </span>
                      )}
                    </td>
                  </>
                ) : (
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400 max-w-[250px] truncate" title={s.descripcion || undefined}>
                    {s.descripcion || <span className="text-gray-400 dark:text-gray-600 italic">Sin descripción</span>}
                  </td>
                )}

                <td className="px-6 py-4 text-center">
                  <div className="inline-flex gap-2">
                    {hasRole(["ADMIN"]) && (
                      <Button onClick={() => onEditar(s)} title={`Editar ${et.servicioMin}`} variant="iconInfo" size="icon">
                        <FaPen size={12} />
                      </Button>
                    )}
                    {hasRole(["ADMIN"]) && (
                      <Button onClick={() => onEliminar(s.id)} title={`Eliminar ${et.servicioMin}`} variant="iconDanger" size="icon">
                        <FaTrashAlt size={12} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
