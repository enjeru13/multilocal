import { useState, useEffect } from "react";
import { FaUserEdit } from "react-icons/fa";
import type {
  Cliente,
  ClienteCreate,
  ClienteUpdatePayload,
  TipoCliente,
} from "@lavanderia/shared/types/types";
import { isAxiosError } from "axios";
import { toast } from "react-toastify";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { Campo, Seccion, Segmentado, ModalEncabezado, ModalPie, campo, campoError } from "../ui/Formulario";
import FormularioClienteSimple from "./FormularioClienteSimple";
import { useConfiguracion } from "../../context/configuracionCore";
import { useEtiquetas } from "../../context/configuracionCore";

type ClienteFormState = ClienteCreate & {
  id?: number;
  razon_social?: string | null;
};

type Props = {
  cliente?: Cliente;
  onClose: () => void;
  onSubmit: (
    data: ClienteCreate | (ClienteUpdatePayload & { id: number })
  ) => Promise<void>;
};

function FormularioClienteCompleto({
  cliente,
  onClose,
  onSubmit,
}: Props) {
  const et = useEtiquetas();
  const [form, setForm] = useState<ClienteFormState>({
    nombre: "",
    apellido: "",
    razon_social: null,
    tipo: "NATURAL",
    telefono: "",
    telefono_secundario: null,
    direccion: "",
    identificacion: "V-",
    email: null,
  });

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [estaGuardando, setEstaGuardando] = useState(false);

  useEffect(() => {
    if (cliente) {
      setForm({
        id: cliente.id,
        nombre: cliente.tipo === "EMPRESA" ? "" : cliente.nombre,
        apellido: cliente.tipo === "EMPRESA" ? "" : cliente.apellido,
        razon_social: cliente.tipo === "EMPRESA" ? cliente.nombre : null,
        tipo: cliente.tipo,
        telefono: cliente.telefono,
        telefono_secundario:
          cliente.telefono_secundario === ""
            ? null
            : cliente.telefono_secundario,
        direccion: cliente.direccion,
        identificacion: cliente.identificacion,
        email: cliente.email === "" ? null : cliente.email,
      });
    } else {
      setForm({
        nombre: "",
        apellido: "",
        razon_social: null,
        tipo: "NATURAL",
        telefono: "",
        telefono_secundario: null,
        direccion: "",
        identificacion: "V-",
        email: null,
      });
    }
    setErrores({});
  }, [cliente]);

  const handleIdentificacionChange = (
    prefijo: "V-" | "J-" | "E-",
    valorSinPrefijo: string
  ) => {
    const tipoMap: Record<"V-" | "J-" | "E-", TipoCliente> = {
      "V-": "NATURAL",
      "J-": "EMPRESA",
      "E-": "NATURAL",
    };
    const nuevoTipo = tipoMap[prefijo];

    setForm((prev) => ({
      ...prev,
      tipo: nuevoTipo,
      identificacion: prefijo + valorSinPrefijo,
      nombre: nuevoTipo === "EMPRESA" ? "" : prev.nombre,
      apellido: nuevoTipo === "EMPRESA" ? "" : prev.apellido,
      razon_social: nuevoTipo === "EMPRESA" ? prev.razon_social : null,
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    const newValue =
      (name === "telefono_secundario" || name === "email") && value === ""
        ? null
        : value;
    setForm((prev) => ({ ...prev, [name]: newValue }));
  };

  function validarFormularioLocal(
    data: ClienteFormState
  ): Record<string, string> {
    const errores: Record<string, string> = {};
    const soloLetras = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
    const regexTelefono = /^[0-9()+\-.\s]{6,20}$/;
    const regexIdentificacion = /^(V|J|E)-[\d-]{6,15}$/;

    if (data.tipo === "EMPRESA") {
      if (!data.razon_social || !data.razon_social.trim()) {
        errores.razon_social = "La razón social es obligatoria.";
      } else if (data.razon_social.trim().length < 2) {
        errores.razon_social =
          "La razón social debe tener al menos 2 caracteres.";
      }
    } else {
      if (!data.nombre || !data.nombre.trim()) {
        errores.nombre = "El nombre es obligatorio.";
      } else if (!soloLetras.test(data.nombre)) {
        errores.nombre = "El nombre solo puede contener letras.";
      } else if (data.nombre.trim().length < 2) {
        errores.nombre = "El nombre debe tener al menos 2 caracteres.";
      }

      if (!data.apellido || !data.apellido.trim()) {
        errores.apellido = "El apellido es obligatorio.";
      } else if (!soloLetras.test(data.apellido)) {
        errores.apellido = "El apellido solo puede contener letras.";
      } else if (data.apellido.trim().length < 2) {
        errores.apellido = "El apellido debe tener al menos 2 caracteres.";
      }
    }

    if (!data.telefono.trim()) {
      errores.telefono = "El teléfono principal es obligatorio.";
    } else if (!regexTelefono.test(data.telefono)) {
      errores.telefono =
        "Formato de teléfono inválido (solo números, +, -, ., (, )).";
    }

    if (
      data.telefono_secundario &&
      data.telefono_secundario.trim() !== "" &&
      !regexTelefono.test(data.telefono_secundario)
    ) {
      errores.telefono_secundario = "Formato de teléfono secundario inválido.";
    }

    if (!data.direccion.trim()) {
      errores.direccion = "La dirección es obligatoria.";
    } else if (data.direccion.trim().length < 4) {
      errores.direccion = "La dirección debe tener al menos 4 caracteres.";
    }

    if (!data.identificacion.trim()) {
      errores.identificacion = "La identificación es obligatoria.";
    } else if (!regexIdentificacion.test(data.identificacion)) {
      errores.identificacion =
        "Formato de identificación inválido (Ej: V-12345678, J-12345678-0).";
    }

    if (
      data.email &&
      data.email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
      errores.email = "Formato de correo electrónico inválido.";
    }

    return errores;
  }

  const resetForm = () => {
    setForm({
      nombre: "",
      apellido: "",
      razon_social: null,
      tipo: "NATURAL",
      telefono: "",
      telefono_secundario: null,
      direccion: "",
      identificacion: "V-",
      email: null,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const erroresDetectados = validarFormularioLocal(form);
    setErrores(erroresDetectados);

    if (Object.keys(erroresDetectados).length > 0) {
      toast.error("Por favor, corrige los errores del formulario.");
      return;
    }

    let datosParaBackend:
      | ClienteCreate
      | (ClienteUpdatePayload & { id: number });

    if (form.tipo === "EMPRESA") {
      datosParaBackend = {
        nombre: form.razon_social || "",
        apellido: "",
        tipo: form.tipo,
        telefono: form.telefono,
        telefono_secundario:
          form.telefono_secundario === "" ? null : form.telefono_secundario,
        direccion: form.direccion,
        identificacion: form.identificacion,
        email: form.email === "" ? null : form.email,
      };
    } else {
      datosParaBackend = {
        nombre: form.nombre,
        apellido: form.apellido,
        tipo: form.tipo,
        telefono: form.telefono,
        telefono_secundario:
          form.telefono_secundario === "" ? null : form.telefono_secundario,
        direccion: form.direccion,
        identificacion: form.identificacion,
        email: form.email === "" ? null : form.email,
      };
    }

    setEstaGuardando(true);
    try {
      if (cliente && cliente.id) {
        const updateData: ClienteUpdatePayload & { id: number } = {
          id: cliente.id,
          ...datosParaBackend,
        };
        await onSubmit(updateData);
        toast.success(`${et.cliente} actualizado correctamente.`);
      } else {
        const createData: ClienteCreate = {
          ...datosParaBackend,
        };
        await onSubmit(createData);
        toast.success(`${et.cliente} registrado correctamente.`);
      }
      resetForm();
      onClose();
    } catch (error: unknown) {
      if (
        isAxiosError(error) &&
        error.response?.status === 400 &&
        error.response.data?.detalles
      ) {
        const detalles = error.response.data.detalles;
        const erroresFormateados: Record<string, string> = {};
        for (const campo in detalles) {
          erroresFormateados[campo] =
            detalles[campo]?._errors?.[0] || "Campo inválido";
        }
        setErrores(erroresFormateados);
        toast.error("Error en la validación de datos.");
      } else if (isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error(`Error inesperado al guardar ${et.clienteMin}.`);
      }
    } finally {
      setEstaGuardando(false);
    }
  };

  const esEmpresa = form.tipo === "EMPRESA";
  const prefijo = form.identificacion.slice(0, 2) as "V-" | "J-" | "E-";
  const numeroDoc = form.identificacion.replace(/^(V-|J-|E-)/, "");
  const conError = (k: string) => (errores[k] ? campoError : "");

  return (
    <Modal open onClose={onClose} maxWidth="max-w-xl" className="max-h-[92dvh] overflow-hidden flex flex-col">
      <ModalEncabezado
        icono={<FaUserEdit />}
        titulo={cliente ? `Editar ${et.clienteMin}` : `Nuevo ${et.clienteMin}`}
        subtitulo={cliente ? undefined : "Completa los datos de contacto y de identificación"}
        onClose={onClose}
      />

      <form id="cliente-form" onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 flex-1 overflow-y-auto space-y-6">
        <Seccion titulo="Identificación">
          <div className="flex flex-wrap items-end gap-3">
            <Segmentado
              ariaLabel="Tipo de cliente"
              valor={esEmpresa ? "EMPRESA" : "NATURAL"}
              onChange={(t) => handleIdentificacionChange(t === "EMPRESA" ? "J-" : "V-", numeroDoc)}
              opciones={[
                { id: "NATURAL", label: "Persona" },
                { id: "EMPRESA", label: "Empresa" },
              ]}
            />
          </div>
          <Campo etiqueta={esEmpresa ? "RIF" : "Cédula / documento"} error={errores.identificacion} ayuda={esEmpresa ? "Ej. J-12345678-0" : "Ej. V-12345678"}>
            <div className="flex gap-2">
              {!esEmpresa && (
                <select
                  aria-label="Prefijo del documento"
                  className={`${campo} w-20!`}
                  value={prefijo}
                  onChange={(e) => handleIdentificacionChange(e.target.value as "V-" | "E-", numeroDoc)}
                >
                  <option value="V-">V</option>
                  <option value="E-">E</option>
                </select>
              )}
              {esEmpresa && <span className={`${campo} w-14! flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500`}>J</span>}
              <input
                name="identificacion"
                value={numeroDoc}
                onChange={(e) => handleIdentificacionChange(prefijo, e.target.value)}
                className={`${campo} flex-1 ${conError("identificacion")}`}
                placeholder={esEmpresa ? "12345678-0" : "12345678"}
                inputMode="numeric"
                autoFocus={!cliente}
                required
              />
            </div>
          </Campo>
        </Seccion>

        <Seccion titulo={esEmpresa ? "Empresa" : "Datos personales"}>
          {esEmpresa ? (
            <Campo etiqueta="Razón social" error={errores.razon_social}>
              <input name="razon_social" value={form.razon_social || ""} onChange={handleChange} className={`${campo} ${conError("razon_social")}`} placeholder="Ej. Prado Expres C.A." required />
            </Campo>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo etiqueta="Nombre" error={errores.nombre}>
                <input name="nombre" value={form.nombre} onChange={handleChange} className={`${campo} ${conError("nombre")}`} required />
              </Campo>
              <Campo etiqueta="Apellido" error={errores.apellido}>
                <input name="apellido" value={form.apellido} onChange={handleChange} className={`${campo} ${conError("apellido")}`} required />
              </Campo>
            </div>
          )}
        </Seccion>

        <Seccion titulo="Contacto">
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo etiqueta="Teléfono principal" error={errores.telefono}>
              <input name="telefono" value={form.telefono} onChange={handleChange} className={`${campo} ${conError("telefono")}`} placeholder="0412-1234567" inputMode="tel" required />
            </Campo>
            <Campo etiqueta="Teléfono secundario" opcional error={errores.telefono_secundario}>
              <input name="telefono_secundario" value={form.telefono_secundario || ""} onChange={handleChange} className={`${campo} ${conError("telefono_secundario")}`} placeholder="+58 412 1234567" inputMode="tel" />
            </Campo>
          </div>
          <Campo etiqueta="Correo electrónico" opcional error={errores.email}>
            <input name="email" type="email" value={form.email || ""} onChange={handleChange} className={`${campo} ${conError("email")}`} placeholder="cliente@email.com" />
          </Campo>
        </Seccion>

        <Seccion titulo="Dirección">
          <Campo etiqueta="Dirección" error={errores.direccion}>
            <textarea name="direccion" value={form.direccion} onChange={handleChange} rows={2} className={`${campo} h-auto! py-2 resize-y ${conError("direccion")}`} required />
          </Campo>
        </Seccion>
      </form>

      <ModalPie>
        <Button type="button" onClick={onClose} variant="secondary" disabled={estaGuardando}>
          Cancelar
        </Button>
        <Button type="submit" form="cliente-form" variant="primary" isLoading={estaGuardando}>
          {cliente ? "Guardar cambios" : `Registrar ${et.clienteMin}`}
        </Button>
      </ModalPie>
    </Modal>
  );
}

// El perfil decide la ficha: con "tipo de cliente" (lavandería) se pide la
// ficha completa; sin él, una ficha simple con solo el nombre obligatorio.
export default function FormularioCliente(props: Props) {
  const { config } = useConfiguracion();
  if (config && config.moduloClienteTipo === false) {
    return <FormularioClienteSimple {...props} />;
  }
  return <FormularioClienteCompleto {...props} />;
}
