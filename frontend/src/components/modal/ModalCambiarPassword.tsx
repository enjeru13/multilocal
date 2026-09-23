import { useState } from "react";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import { usuariosService } from "../../services/usuariosService";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const inputCls =
  "w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100";

export default function ModalCambiarPassword({ onClose }: { onClose: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (nueva.length < 6) return toast.error("La contraseña nueva debe tener al menos 6 caracteres.");
    if (nueva !== repetir) return toast.error("Las contraseñas nuevas no coinciden.");
    setGuardando(true);
    try {
      await usuariosService.cambiarMiPassword(actual, nueva);
      toast.success("Contraseña actualizada.");
      onClose();
    } catch (err) {
      toast.error(
        err instanceof AxiosError
          ? err.response?.data?.message ?? "No se pudo cambiar la contraseña."
          : "No se pudo cambiar la contraseña."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-sm" className="p-6 space-y-4">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Cambiar mi contraseña</h3>
      <input className={inputCls} type="password" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Contraseña actual" autoFocus />
      <input className={inputCls} type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Contraseña nueva (mín. 6)" />
      <input className={inputCls} type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} placeholder="Repite la nueva contraseña" />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={guardar} isLoading={guardando}>
          Guardar
        </Button>
      </div>
    </Modal>
  );
}
