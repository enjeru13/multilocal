import { useState } from "react";
import { FaPrint } from "react-icons/fa";
import { toast } from "react-toastify";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { ModalEncabezado, ModalPie } from "../ui/Formulario";
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
    <Modal open={visible} onClose={onClose} maxWidth="max-w-md" className="flex flex-col h-[90vh] overflow-hidden">
      <ModalEncabezado icono={<FaPrint />} titulo="Vista previa del recibo" subtitulo="Así saldrá en la impresora" onClose={onClose} />

      <div className="overflow-y-auto grow bg-gray-100 dark:bg-gray-950 p-5">
        <div className="bg-white text-gray-900 rounded-lg shadow-md p-4 mx-auto">
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
      </div>

      <ModalPie>
        <Button onClick={onClose} variant="secondary">
          Cerrar
        </Button>
        <Button onClick={imprimirConServidor} variant="primary" leftIcon={<FaPrint />} isLoading={imprimiendo} disabled={imprimiendo}>
          Imprimir
        </Button>
      </ModalPie>
    </Modal>
  );
}
