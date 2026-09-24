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
import { Campo, ModalEncabezado, ModalPie, campo, campoError } from "../ui/Formulario";
import { useConfiguracion } from "../../context/configuracionCore";

type Props = {
  cliente?: Cliente;
  onClose: () => void;
  onSubmit: (data: ClienteCreate | (ClienteUpdatePayload & { id: number })) => Promise<void>;
};

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

  const error = (clave: string) => errores[clave];

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="max-h-[92dvh] overflow-hidden flex flex-col">
      <ModalEncabezado
        icono={<FaUserEdit />}
        titulo={cliente ? `Editar ${t("clienteUno").toLowerCase()}` : `Nuevo ${t("clienteUno").toLowerCase()}`}
        subtitulo={cliente ? undefined : "Solo el nombre es obligatorio"}
        onClose={onClose}
      />

      <form id="cliente-simple-form" onSubmit={guardar} className="px-4 sm:px-6 py-5 flex-1 overflow-y-auto space-y-5">
        <Campo etiqueta="Nombre o razón social" error={error("nombre")}>
          <input className={`${campo} ${error("nombre") ? campoError : ""}`} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Ej. María Pérez" />
        </Campo>
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Teléfono" opcional error={error("telefono")}>
            <input className={`${campo} ${error("telefono") ? campoError : ""}`} value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="0412-1234567" />
          </Campo>
          <Campo etiqueta="Documento" opcional error={error("identificacion")} ayuda="Cédula, RIF, NIT, pasaporte…">
            <input className={`${campo} ${error("identificacion") ? campoError : ""}`} value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Correo" opcional error={error("email")}>
          <input className={`${campo} ${error("email") ? campoError : ""}`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
        </Campo>
        <Campo etiqueta="Dirección" opcional>
          <input className={campo} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </Campo>
      </form>

      <ModalPie>
        <Button type="button" variant="secondary" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" form="cliente-simple-form" variant="primary" isLoading={guardando}>
          {cliente ? "Guardar cambios" : "Guardar"}
        </Button>
      </ModalPie>
    </Modal>
  );
}
