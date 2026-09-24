import { useEffect, useState } from "react";
import { FaTruck } from "react-icons/fa";
import { toast } from "react-toastify";
import type {
  Proveedor,
  ProveedorCreate,
  ProveedorUpdatePayload,
} from "@lavanderia/shared/types/types";
import { AxiosError } from "axios";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

type Props = {
  proveedor?: Proveedor;
  onClose: () => void;
  onSubmit: (
    data: ProveedorCreate | (ProveedorUpdatePayload & { id: number })
  ) => Promise<void>;
};

export default function FormularioProveedor({ proveedor, onClose, onSubmit }: Props) {
  const [nombre, setNombre] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNombre(proveedor?.nombre ?? "");
    setIdentificacion(proveedor?.identificacion ?? "");
    setTelefono(proveedor?.telefono ?? "");
    setDireccion(proveedor?.direccion ?? "");
    setEmail(proveedor?.email ?? "");
    setError("");
  }, [proveedor]);

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("El nombre del proveedor es obligatorio.");
      return;
    }
    setCargando(true);
    try {
      const data = {
        nombre: nombre.trim(),
        identificacion: identificacion.trim() || null,
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        email: email.trim() || null,
      };
      if (proveedor?.id) {
        await onSubmit({ ...data, id: proveedor.id });
      } else {
        await onSubmit(data);
      }
    } catch (err) {
      console.error("Error al guardar proveedor:", err);
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Error al guardar proveedor"
          : "Error al guardar proveedor";
      toast.error(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md">
      <div className="border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 px-6 py-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-3">
          <FaTruck className="text-xl" />
          {proveedor ? "Editar Proveedor" : "Nuevo Proveedor"}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">
          &times;
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Nombre
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="Ej. Repuestos Andinos CA"
            disabled={cargando}
          />
          {error && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{error}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            RIF / identificación (opcional)
          </label>
          <input
            type="text"
            value={identificacion}
            onChange={(e) => setIdentificacion(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            disabled={cargando}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Teléfono
            </label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              disabled={cargando}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Correo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              disabled={cargando}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Dirección
          </label>
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            disabled={cargando}
          />
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
        <Button type="button" onClick={onClose} variant="secondary" disabled={cargando}>
          Cancelar
        </Button>
        <Button onClick={guardar} variant="primary" isLoading={cargando}>
          Guardar
        </Button>
      </div>
    </Modal>
  );
}
