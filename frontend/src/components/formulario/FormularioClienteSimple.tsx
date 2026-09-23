import { useEffect, useState } from "react";
import { FaUserEdit } from "react-icons/fa";
import { isAxiosError } from "axios";
import { toast } from "react-toastify";
import type {
  Cliente,
  ClienteCreate,
  ClienteUpdatePayload,
} from "@lavanderia/shared/types/types";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { useConfiguracion } from "../../context/configuracionCore";

type Props = {
  cliente?: Cliente;
  onClose: () => void;
  onSubmit: (data: ClienteCreate | (ClienteUpdatePayload & { id: number })) => Promise<void>;
};

const inputCls =
  "w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100";

// Ficha mínima: solo el nombre es obligatorio. El documento de identidad es
// texto libre porque varía por país (cédula, RIF, NIT, CC, pasaporte...).
export default function FormularioClienteSimple({ cliente, onClose, onSubmit }: Props) {
  const { t } = useConfiguracion();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setNombre(cliente ? `${cliente.nombre} ${cliente.apellido ?? ""}`.trim() : "");
    setTelefono(cliente?.telefono ?? "");
    setIdentificacion(cliente?.identificacion ?? "");
    setEmail(cliente?.email ?? "");
    setDireccion(cliente?.direccion ?? "");
    setErrores({});
  }, [cliente]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const nuevos: Record<string, string> = {};
    if (nombre.trim().length < 2) nuevos.nombre = "El nombre debe tener al menos 2 caracteres.";
    if (telefono.trim() && !/^[0-9()+\-.\s]{6,20}$/.test(telefono.trim())) {
      nuevos.telefono = "Teléfono inválido (solo números, +, -, ., paréntesis).";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nuevos.email = "Correo inválido.";
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    const datos = {
      nombre: nombre.trim(),
      apellido: "",
      telefono: telefono.trim(),
      identificacion: identificacion.trim(),
      email: email.trim() || null,
      direccion: direccion.trim(),
    };

    setGuardando(true);
    try {
      if (cliente?.id) {
        await onSubmit({ id: cliente.id, ...datos } as ClienteUpdatePayload & { id: number });
        toast.success(`${t("clienteUno")} actualizado correctamente.`);
      } else {
        await onSubmit({ tipo: "NATURAL", ...datos } as unknown as ClienteCreate);
        toast.success(`${t("clienteUno")} registrado correctamente.`);
      }
      onClose();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setErrores({ identificacion: error.response.data?.message ?? "Documento ya registrado." });
      } else if (isAxiosError(error) && error.response?.status === 400 && error.response.data?.detalles) {
        const detalles = error.response.data.detalles;
        const out: Record<string, string> = {};
        for (const campo in detalles) out[campo] = detalles[campo]?._errors?.[0] ?? "Campo inválido";
        setErrores(out);
      } else {
        toast.error("No se pudo guardar. Intenta de nuevo.");
      }
    } finally {
      setGuardando(false);
    }
  };

  const campo = (clave: string) =>
    errores[clave] ? <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errores[clave]}</p> : null;

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md" className="overflow-hidden">
      <div className="bg-indigo-600 dark:bg-indigo-800 text-white px-6 py-4 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <FaUserEdit className="text-2xl" />
          {cliente ? `Editar ${t("clienteUno")}` : `Nuevo ${t("clienteUno")}`}
        </h2>
        <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none" title="Cerrar">
          &times;
        </button>
      </div>

      <form onSubmit={guardar} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre</label>
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Nombre o razón social" />
          {campo("nombre")}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teléfono</label>
            <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Opcional" />
            {campo("telefono")}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Documento</label>
            <input className={inputCls} value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} placeholder="Opcional" />
            {campo("identificacion")}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Correo</label>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" />
          {campo("email")}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Dirección</label>
          <input className={inputCls} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Opcional" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={guardando}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
