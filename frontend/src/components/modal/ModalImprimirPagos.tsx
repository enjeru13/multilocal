import { FaPrint } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { PagosPrintable } from "../PagosPrintable"; // Asegúrate que la ruta sea correcta
import type { Moneda, Pago, Orden, Configuracion } from "@lavanderia/shared/types/types";

// Actualizamos la interfaz para incluir la tasa
interface PagoConOrden extends Pago {
  orden?: Orden & { cliente?: { nombre: string; apellido: string } };
  tasa?: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  pagos: PagoConOrden[];
  monedaPrincipal: Moneda;
  totalIngresos: number;
  configuracion?: Configuracion | null; // Nueva prop para configuración
}

export default function ModalImprimirPagos({
  visible,
  onClose,
  pagos,
  monedaPrincipal,
  totalIngresos,
  configuracion
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const imprimir = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Reporte_Pagos_${new Date().toISOString().split('T')[0]}`,
    // Ajustamos los márgenes del papel aquí
    pageStyle: `
      @page {
        size: auto;
        margin: 15mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
        }
      }
    `,
  });

  return (
    <Modal
      open={visible}
      onClose={onClose}
      maxWidth="max-w-5xl"
      className="!bg-white flex flex-col h-[90vh] overflow-hidden print:hidden"
    >
        {/* Header del Modal (Solo visible en pantalla) */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FaPrint className="text-blue-600" />
            Vista Previa
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
            title="Cerrar"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Área de Contenido (Lo que se ve y se imprime) */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          {/* Contenedor blanco centrado que simula la hoja de papel */}
          <div className="bg-white shadow-lg mx-auto max-w-[210mm] min-h-[297mm] p-8 print:shadow-none print:m-0 print:p-0 print:max-w-none print:min-h-0">
            <PagosPrintable
              ref={printRef}
              pagos={pagos}
              monedaPrincipal={monedaPrincipal}
              totalIngresos={totalIngresos}
              configuracion={configuracion}
            />
          </div>
        </div>

        {/* Footer del Modal (Botones de acción) */}
        <div className="p-5 border-t border-gray-200 bg-white flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>

          <Button
            onClick={() => imprimir()}
            variant="primary"
            leftIcon={<FaPrint />}
          >
            Imprimir Reporte
          </Button>
        </div>
    </Modal>
  );
}