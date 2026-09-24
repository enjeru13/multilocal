import { FaPrint } from "react-icons/fa";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { ModalEncabezado, ModalPie } from "../ui/Formulario";
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
    <Modal open={visible} onClose={onClose} maxWidth="max-w-5xl" className="flex flex-col h-[90vh] overflow-hidden print:hidden">
      <ModalEncabezado icono={<FaPrint />} titulo="Vista previa" subtitulo="Así saldrá en papel" onClose={onClose} />

      <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 p-6">
        <div className="bg-white text-gray-900 shadow-lg mx-auto max-w-[210mm] min-h-[297mm] p-8 print:shadow-none print:m-0 print:p-0 print:max-w-none print:min-h-0">
          <PagosPrintable
            ref={printRef}
            pagos={pagos}
            monedaPrincipal={monedaPrincipal}
            totalIngresos={totalIngresos}
            configuracion={configuracion}
          />
        </div>
      </div>

      <ModalPie>
        <Button onClick={onClose} variant="secondary">
          Cancelar
        </Button>
        <Button onClick={() => imprimir()} variant="primary" leftIcon={<FaPrint />}>
          Imprimir reporte
        </Button>
      </ModalPie>
    </Modal>
  );
}
