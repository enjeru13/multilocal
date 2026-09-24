import { useState } from "react";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import { FaKey } from "react-icons/fa";
import { usuariosService } from "../../services/usuariosService";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Campo, ModalEncabezado, ModalPie, campo, campoError } from "../ui/Formulario";

export default function ModalCambiarPassword({ onClose }: { onClose: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);

  const nuevaCorta = nueva.length > 0 && nueva.length < 6;
  const noCoincide = repetir.length > 0 && nueva !== repetir;

  const guardar = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    <Modal open onClose={onClose} maxWidth="max-w-sm">
      <ModalEncabezado icono={<FaKey />} titulo="Cambiar mi contraseña" subtitulo="Usarás la nueva la próxima vez que entres" onClose={onClose} />
      <form id="password-form" onSubmit={guardar} className="px-4 sm:px-6 py-5 space-y-4">
        <Campo etiqueta="Contraseña actual">
          <input className={campo} type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus autoComplete="current-password" />
        </Campo>
        <Campo etiqueta="Contraseña nueva" ayuda="Mínimo 6 caracteres." error={nuevaCorta ? "Muy corta: mínimo 6 caracteres." : undefined}>
          <input className={`${campo} ${nuevaCorta ? campoError : ""}`} type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" />
        </Campo>
        <Campo etiqueta="Repite la nueva" error={noCoincide ? "No coincide con la nueva." : undefined}>
          <input className={`${campo} ${noCoincide ? campoError : ""}`} type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
        </Campo>
      </form>
      <ModalPie>
        <Button variant="secondary" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" form="password-form" variant="primary" isLoading={guardando}>
          Guardar
        </Button>
      </ModalPie>
    </Modal>
  );
}
