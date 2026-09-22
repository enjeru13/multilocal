import React from "react";
import {
  FaExclamationTriangle,
  FaTimesCircle,
  FaCheckCircle,
} from "react-icons/fa";
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
    <Modal open onClose={onCancel} maxWidth="max-w-md" className="p-8 text-center text-base">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-center gap-3">
        <FaExclamationTriangle size={28} className="text-yellow-500 dark:text-yellow-400" />
        {titulo}
      </h3>

      <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed mb-8">
        {mensaje}
      </p>
      <div className="flex justify-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-800 mt-6">
        <Button
          onClick={onCancel}
          variant="secondary"
          leftIcon={<FaTimesCircle size={18} />}
        >
          {textoCancelar}
        </Button>

        <Button
          onClick={onConfirm}
          variant="danger"
          leftIcon={<FaCheckCircle size={18} />}
        >
          {textoConfirmar}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmacionModal;
