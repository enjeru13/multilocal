import React from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

interface ConfirmacionModalProps {
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
}

const ConfirmacionModal: React.FC<ConfirmacionModalProps> = ({
  mensaje,
  onConfirm,
  onCancel,
  titulo = "Confirmar acción",
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
}) => {
  return (
    <Modal open onClose={onCancel} maxWidth="max-w-sm">
      <div className="px-6 pt-6 pb-5 text-center">
        <span className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center text-xl mb-4">
          <FaExclamationTriangle />
        </span>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{titulo}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{mensaje}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/30 rounded-b-2xl">
        <Button onClick={onCancel} variant="secondary">
          {textoCancelar}
        </Button>
        <Button onClick={onConfirm} variant="danger" autoFocus>
          {textoConfirmar}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmacionModal;
