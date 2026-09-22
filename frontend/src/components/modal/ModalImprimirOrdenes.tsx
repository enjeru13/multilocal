import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { FaPrint } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { OrdenesPrintable } from "../OrdenesPrintable";
import type {
  Moneda,
  Orden,
  Configuracion,
  EstadoOrden,
  EstadoPagoRaw,
} from "@lavanderia/shared/types/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  ordenes: Orden[];
  monedaPrincipal: Moneda;
  configuracion: Configuracion | null;
  filtros: {
    estado: EstadoOrden | "TODOS" | "";
    pago: EstadoPagoRaw | "TODOS" | "";
  };
}

export default function ModalImprimirOrdenes({
  visible,
  onClose,
  ordenes,
  monedaPrincipal,
  configuracion,
  filtros,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const imprimir = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Reporte_Ordenes_${new Date().toISOString().split("T")[0]}`,
    pageStyle: `
      @page { size: auto; margin: 15mm; }
      @media print { body { -webkit-print-color-adjust: exact; } }
    `,
  });

  return (
    <Modal
      open={visible}
      onClose={onClose}
      maxWidth="max-w-5xl"
      className="flex flex-col h-[90vh] overflow-hidden print:hidden"
    >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 transition-colors">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaPrint className="text-blue-600 dark:text-blue-400" /> Vista Previa de Reporte
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400 cursor-pointer"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-800 p-6 transition-colors">
          <div className="bg-white shadow-lg mx-auto max-w-[210mm] min-h-[297mm] p-8 print:shadow-none print:m-0 print:p-0 print:max-w-none print:min-h-0">
            <OrdenesPrintable
              ref={printRef}
              ordenes={ordenes}
              monedaPrincipal={monedaPrincipal}
              configuracion={configuracion}
              filtros={filtros}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3 transition-colors">
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>

          <Button
            onClick={() => imprimir()}
            variant="primary"
            leftIcon={<FaPrint />}
          >
            Imprimir
          </Button>
        </div>
    </Modal>
  );
}
