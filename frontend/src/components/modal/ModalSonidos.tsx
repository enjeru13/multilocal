import { FaVolumeUp } from "react-icons/fa";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { ModalEncabezado, ModalPie } from "../ui/Formulario";
import PanelSonidos from "../config/PanelSonidos";

/** Sonidos de este equipo, al alcance de cualquier usuario desde su menú. */
export default function ModalSonidos({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="max-h-[92dvh] flex flex-col overflow-hidden">
      <ModalEncabezado icono={<FaVolumeUp />} titulo="Sonidos" subtitulo="Solo para este equipo. Se guardan al cambiarlos." onClose={onClose} />
      <div className="px-4 sm:px-6 py-4 flex-1 overflow-y-auto">
        <PanelSonidos />
      </div>
      <ModalPie>
        <Button onClick={onClose} variant="secondary">
          Cerrar
        </Button>
      </ModalPie>
    </Modal>
  );
}
