import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { FaPrint } from "react-icons/fa";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { ModalEncabezado, ModalPie } from "../ui/Formulario";
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
    <Modal open={visible} onClose={onClose} maxWidth="max-w-5xl" className="flex flex-col h-[90vh] overflow-hidden print:hidden">
      <ModalEncabezado icono={<FaPrint />} titulo="Vista previa" subtitulo="Así saldrá en papel" onClose={onClose} />

      <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 p-6">
        <div className="bg-white text-gray-900 shadow-lg mx-auto max-w-[210mm] min-h-[297mm] p-8 print:shadow-none print:m-0 print:p-0 print:max-w-none print:min-h-0">
          <OrdenesPrintable
            ref={printRef}
            ordenes={ordenes}
            monedaPrincipal={monedaPrincipal}
            configuracion={configuracion}
            filtros={filtros}
          />
        </div>
      </div>

      <ModalPie>
        <Button onClick={onClose} variant="secondary">
          Cancelar
        </Button>
        <Button onClick={() => imprimir()} variant="primary" leftIcon={<FaPrint />}>
          Imprimir
        </Button>
      </ModalPie>
    </Modal>
  );
}
