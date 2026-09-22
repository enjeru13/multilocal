import { useState } from "react";
import { FiX } from "react-icons/fi";
import { FaPrint } from "react-icons/fa";
import { toast } from "react-toastify";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import ReciboEntrega from "../ReciboEntrega";
import type { ReciboData } from "@lavanderia/shared/types/types";

const API_URL = import.meta.env.VITE_PRINT_SERVER_URL;

interface ModalReciboEntregaProps {
  visible: boolean;
  onClose: () => void;
  datosRecibo: ReciboData;
}

export default function ModalReciboEntrega({
  visible,
  onClose,
  datosRecibo,
}: ModalReciboEntregaProps) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const imprimirConServidor = async () => {
    setImprimiendo(true);
    try {
      const response = await fetch(`${API_URL}/imprimir-recibo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(datosRecibo),
      });

      if (response.ok) {
        toast.success("Recibo enviado a la impresora.");
        onClose();
      } else {
        const errorData = await response.json();
        console.error("Error del servidor de impresión:", errorData);
        toast.error("Error al imprimir. Revisa el servidor de impresión.");
      }
    } catch (error) {
      console.error("No se pudo conectar al servidor de impresión:", error);
      toast.error(
        "No se pudo conectar con la impresora. ¿Está el servidor activo?"
      );
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <Modal
      open={visible}
      onClose={onClose}
      maxWidth="max-w-md"
      className="!bg-white flex flex-col h-[90vh]"
    >
        <div className="shrink-0 flex justify-between items-center p-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FaPrint size={28} className="text-blue-600" /> Vista previa de
            recibo
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-3xl transition-transform transform hover:rotate-90 p-2 rounded-full hover:bg-gray-100"
            title="Cerrar"
          >
            <FiX size={28} />
          </button>
        </div>

        <div className="overflow-y-auto grow p-6">
          <ReciboEntrega
            clienteInfo={datosRecibo.clienteInfo}
            items={datosRecibo.items}
            abono={datosRecibo.abono}
            total={datosRecibo.total}
            lavanderiaInfo={datosRecibo.lavanderiaInfo}
            numeroOrden={datosRecibo.numeroOrden}
            observaciones={datosRecibo.observaciones}
            mensajePieRecibo={datosRecibo.mensajePieRecibo}
            monedaPrincipal={datosRecibo.monedaPrincipal}
            totalCantidadPiezas={datosRecibo.totalCantidadPiezas}
          />
        </div>

        <div className="shrink-0 pt-6 px-6 pb-6 flex justify-end border-t border-gray-200">
          <Button
            onClick={imprimirConServidor}
            variant="whatsapp"
            size="lg"
            leftIcon={<FaPrint size={20} />}
            className="w-full sm:w-auto"
            isLoading={imprimiendo}
            disabled={imprimiendo}
          >
            Imprimir
          </Button>
        </div>
    </Modal>
  );
}
