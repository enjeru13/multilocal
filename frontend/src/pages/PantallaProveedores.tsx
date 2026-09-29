import { useEffect, useState, useCallback } from "react";
import TarjetaRegistro from "../components/ui/TarjetaRegistro";
import { toast } from "react-toastify";
import { FaPlus, FaPen, FaTrashAlt, FaBoxOpen } from "react-icons/fa";
import { proveedoresService } from "../services/proveedoresService";
import { servicioService } from "../services/serviciosService";
import { configuracionService } from "../services/configuracionService";
import FormularioProveedor from "../components/formulario/FormularioProveedor";
import ModalRegistrarCompra from "../components/modal/ModalRegistrarCompra";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import Button from "../components/ui/Button";
import { TableSkeleton } from "../components/Skeleton";
import { useConfiguracion } from "../context/configuracionCore";
import type {
  Proveedor,
  ProveedorCreate,
  ProveedorUpdatePayload,
  Servicio,
  Moneda,
} from "@lavanderia/shared/types/types";

export default function PantallaProveedores() {
  const { t } = useConfiguracion();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Servicio[]>([]);
  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [loading, setLoading] = useState(true);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | undefined>();
  const [proveedorParaCompra, setProveedorParaCompra] = useState<Proveedor | undefined>();
  const [proveedorAEliminar, setProveedorAEliminar] = useState<number | undefined>();

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [resProv, resServ, resConfig] = await Promise.all([
        proveedoresService.getAll(),
        servicioService.getAll(),
        configuracionService.get(),
      ]);
      setProveedores(resProv.data);
      setProductos(resServ.data.filter((s) => s.controlaStock));
      setMonedaPrincipal(resConfig.data.monedaPrincipal);
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
      toast.error("No se pudieron cargar los proveedores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarProveedor = useCallback(
    async (data: ProveedorCreate | (ProveedorUpdatePayload & { id: number })) => {
      if ("id" in data && data.id) {
        await proveedoresService.update(data.id, data);
        toast.success("Proveedor actualizado.");
      } else {
        await proveedoresService.create(data as ProveedorCreate);
        toast.success("Proveedor registrado.");
      }
      setMostrarFormulario(false);
      setProveedorSeleccionado(undefined);
      cargar();
    },
    [cargar]
  );

  const eliminarProveedor = useCallback(async () => {
    if (proveedorAEliminar === undefined) return;
    try {
      await proveedoresService.delete(proveedorAEliminar);
      toast.success("Proveedor eliminado.");
      cargar();
    } catch (error) {
      console.error("Error al eliminar proveedor:", error);
      toast.error("No se pudo eliminar el proveedor.");
    } finally {
      setProveedorAEliminar(undefined);
    }
  }, [proveedorAEliminar, cargar]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <TableSkeleton rows={6} cols={4} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Proveedores</h1>
        <Button
          onClick={() => {
            setProveedorSeleccionado(undefined);
            setMostrarFormulario(true);
          }}
          variant="primary"
          leftIcon={<FaPlus className="w-4 h-4" />}
        >
          Nuevo Proveedor
        </Button>
      </div>

      {proveedores.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No hay proveedores registrados.</p>
      ) : (
        <>
        <ul className="md:hidden space-y-2.5">
          {proveedores.map((p) => (
            <TarjetaRegistro
              key={p.id}
              titulo={p.nombre}
              subtitulo={[p.identificacion, p.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}
              acciones={
                <>
                  <Button onClick={() => setProveedorParaCompra(p)} variant="whatsapp" size="sm" className="flex-1" leftIcon={<FaBoxOpen size={12} />} disabled={productos.length === 0}>
                    Registrar compra
                  </Button>
                  <Button
                    onClick={() => {
                      setProveedorSeleccionado(p);
                      setMostrarFormulario(true);
                    }}
                    title="Editar proveedor"
                    aria-label="Editar"
                    variant="iconInfo"
                    size="icon"
                  >
                    <FaPen size={12} />
                  </Button>
                  <Button onClick={() => setProveedorAEliminar(p.id)} title="Eliminar proveedor" aria-label="Eliminar" variant="iconDanger" size="icon">
                    <FaTrashAlt size={12} />
                  </Button>
                </>
              }
            />
          ))}
        </ul>
        <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <table className="min-w-full bg-white dark:bg-gray-900 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 text-left">Nombre</th>
                <th className="px-6 py-3 text-left">Teléfono</th>
                <th className="px-6 py-3 text-left">Identificación</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <td className="px-6 py-4 font-semibold text-gray-800 dark:text-gray-100">
                    {p.nombre}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {p.telefono ?? <span className="text-gray-400 italic">N/A</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {p.identificacion ?? <span className="text-gray-400 italic">N/A</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex gap-2">
                      <Button
                        onClick={() => setProveedorParaCompra(p)}
                        title={`Registrar compra de ${t("servicio").toLowerCase()}`}
                        variant="iconSuccess"
                        size="icon"
                        disabled={productos.length === 0}
                      >
                        <FaBoxOpen size={12} />
                      </Button>
                      <Button
                        onClick={() => {
                          setProveedorSeleccionado(p);
                          setMostrarFormulario(true);
                        }}
                        title="Editar proveedor"
                        variant="iconInfo"
                        size="icon"
                      >
                        <FaPen size={12} />
                      </Button>
                      <Button
                        onClick={() => setProveedorAEliminar(p.id)}
                        title="Eliminar proveedor"
                        variant="iconDanger"
                        size="icon"
                      >
                        <FaTrashAlt size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {productos.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No hay {t("servicio").toLowerCase()} con control de stock activado — actívalo al crear o
          editar uno para poder registrarle compras.
        </p>
      )}

      {mostrarFormulario && (
        <FormularioProveedor
          proveedor={proveedorSeleccionado}
          onClose={() => {
            setMostrarFormulario(false);
            setProveedorSeleccionado(undefined);
          }}
          onSubmit={guardarProveedor}
        />
      )}

      {proveedorParaCompra && (
        <ModalRegistrarCompra
          proveedor={proveedorParaCompra}
          productos={productos}
          monedaPrincipal={monedaPrincipal}
          onClose={() => setProveedorParaCompra(undefined)}
          onGuardada={() => {
            setProveedorParaCompra(undefined);
            cargar();
          }}
        />
      )}

      {proveedorAEliminar !== undefined && (
        <ConfirmacionModal
          mensaje="¿Eliminar este proveedor? Esta acción no se puede deshacer."
          onConfirm={eliminarProveedor}
          onCancel={() => setProveedorAEliminar(undefined)}
        />
      )}
    </div>
  );
}
