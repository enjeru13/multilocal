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
import { Campo, ModalEncabezado, ModalPie, campo, campoError } from "../ui/Formulario";
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
    <Modal open onClose={onClose} maxWidth="max-w-lg">
      <ModalEncabezado icono={<FaTruck />} titulo={proveedor ? "Editar proveedor" : "Nuevo proveedor"} subtitulo={proveedor ? proveedor.nombre : "Solo el nombre es obligatorio"} onClose={onClose} />

      <form
        id="proveedor-form"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
        className="px-4 sm:px-6 py-5 space-y-4"
      >
        <Campo etiqueta="Nombre" error={error}>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={`${campo} ${error ? campoError : ""}`} placeholder="Ej. Repuestos Andinos CA" disabled={cargando} autoFocus />
        </Campo>
        <Campo etiqueta="RIF / identificación" opcional>
          <input type="text" value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={campo} disabled={cargando} />
        </Campo>
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Teléfono" opcional>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={campo} inputMode="tel" disabled={cargando} />
          </Campo>
          <Campo etiqueta="Correo" opcional>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} disabled={cargando} />
          </Campo>
        </div>
        <Campo etiqueta="Dirección" opcional>
          <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className={campo} disabled={cargando} />
        </Campo>
      </form>

      <ModalPie>
        <Button type="button" onClick={onClose} variant="secondary" disabled={cargando}>
          Cancelar
        </Button>
        <Button type="submit" form="proveedor-form" variant="primary" isLoading={cargando}>
          Guardar
        </Button>
      </ModalPie>
    </Modal>
  );
}
