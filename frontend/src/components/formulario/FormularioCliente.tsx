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

export default function FormularioCliente({
  cliente,
  onClose,
  onSubmit,
}: Props) {
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
        toast.success("Cliente actualizado correctamente.");
      } else {
        const createData: ClienteCreate = {
          ...datosParaBackend,
        };
        await onSubmit(createData);
        toast.success("Cliente registrado correctamente.");
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
      } else {
        toast.error("Error inesperado al guardar el cliente.");
      }
    } finally {
      setEstaGuardando(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-indigo-600 dark:bg-indigo-800 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <FaUserEdit className="text-2xl" />
            {cliente ? "Editar Cliente" : "Registrar Cliente"}
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl leading-none cursor-pointer"
            title="Cerrar"
          >
            &times;
          </button>
        </div>

        <form
          id="cliente-form"
          onSubmit={handleSubmit}
          className="px-6 py-6 flex-1 overflow-y-auto space-y-6 text-base text-gray-800 dark:text-gray-200"
        >
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Identificación
            </label>
            <div className="flex gap-3">
              <select
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-base font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                value={form.identificacion.slice(0, 2)}
                onChange={(e) => {
                  const prefijo = e.target.value as "V-" | "J-" | "E-";
                  const sinPrefijo = form.identificacion.replace(
                    /^(V-|J-|E-)/,
                    ""
                  );
                  handleIdentificacionChange(prefijo, sinPrefijo);
                }}
              >
                <option value="V-">V</option>
                <option value="E-">E</option>
                <option value="J-">J</option>
              </select>
              <input
                name="identificacion"
                value={form.identificacion.replace(/^(V-|J-|E-)/, "")}
                onChange={(e) => {
                  const prefijo = form.identificacion.slice(0, 2) as
                    | "V-"
                    | "J-"
                    | "E-";
                  handleIdentificacionChange(prefijo, e.target.value);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                placeholder="Número sin prefijo (Ej: 12345678-0, 9876543)"
                required
              />
            </div>
            {errores.identificacion && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                {errores.identificacion}
              </p>
            )}
          </div>

          {form.tipo === "EMPRESA" ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Razón Social
              </label>
              <input
                name="razon_social"
                value={form.razon_social || ""}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                placeholder="Ej. Prado Expres C.A."
                required
              />
              {errores.razon_social && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                  {errores.razon_social}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Nombre
                </label>
                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                  required
                />
                {errores.nombre && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                    {errores.nombre}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Apellido
                </label>
                <input
                  name="apellido"
                  value={form.apellido}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                  required
                />
                {errores.apellido && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                    {errores.apellido}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Teléfono principal
              </label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                required
              />
              {errores.telefono && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                  {errores.telefono}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Teléfono secundario (Opcional)
              </label>
              <input
                name="telefono_secundario"
                value={form.telefono_secundario || ""}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                placeholder="Ej. +58 412 1234567"
              />
              {errores.telefono_secundario && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                  {errores.telefono_secundario}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Dirección
            </label>
            <textarea
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200 resize-y"
              required
            ></textarea>
            {errores.direccion && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                {errores.direccion}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Correo electrónico (Opcional)
            </label>
            <input
              name="email"
              type="email"
              value={form.email || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
              placeholder="Ej. cliente@email.com"
            />
            {errores.email && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                {errores.email}
              </p>
            )}
          </div>
        </form>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 text-sm font-medium">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            disabled={estaGuardando}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="cliente-form"
            variant="primary"
            isLoading={estaGuardando}
          >
            {cliente ? "Actualizar Cliente" : "Registrar Cliente"}
          </Button>
        </div>
    </Modal>
  );
}
