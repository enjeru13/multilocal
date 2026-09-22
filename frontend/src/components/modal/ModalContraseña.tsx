import { useState } from "react";
import { toast } from "react-toastify";
import { authService } from "../../services/authService";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

interface ModalContraseñaProps {
  onConfirmado: () => void;
  onCancelar: () => void;
  visible: boolean;
  titulo?: string;
}

export default function ModalContraseña({
  onConfirmado,
  onCancelar,
  visible,
  titulo = "Acción protegida",
}: ModalContraseñaProps) {
  const [claveIngresada, setClaveIngresada] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const validarClave = async () => {
    setError("");
    if (!claveIngresada.trim()) {
      setError("Por favor, ingresa la contraseña.");
      return;
    }

    setCargando(true);
    try {
      const esValida = await authService.validarAdminPassword(claveIngresada);

      if (esValida) {
        onConfirmado();
        setClaveIngresada("");
        setError("");
      } else {
        setError("La contraseña ingresada no es válida.");
        toast.error("Contraseña incorrecta.");
      }
    } catch (err) {
      console.error("Error en la validación de contraseña:", err);
      setError("Ocurrió un error al validar la contraseña.");
      toast.error("Error de conexión o del servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal open={visible} onClose={onCancelar} maxWidth="max-w-sm" className="p-6 text-sm space-y-5">
      <h3 className="text-lg font-semibold text-center text-gray-900 dark:text-gray-100">
        {titulo}
      </h3>

      <input
        type="password"
        placeholder="Contraseña"
        value={claveIngresada}
        onChange={(e) => setClaveIngresada(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            validarClave();
          }
        }}
        className={`w-full border px-3 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:ring-red-300"
            : "border-gray-300 dark:border-gray-700 focus:ring-indigo-300"
        }`}
        disabled={cargando}
        autoFocus
      />

      {error && <p className="text-red-500 text-xs text-center">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancelar} variant="ghost" size="sm" disabled={cargando}>
          Cancelar
        </Button>
        <Button onClick={validarClave} variant="primary" size="sm" isLoading={cargando}>
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
