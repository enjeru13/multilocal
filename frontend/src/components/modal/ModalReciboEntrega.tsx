import type { ReciboData } from "@lavanderia/shared/types/types";
import ImprimirRecibo from "../../impresion/informes/InformeRecibo";

interface ModalReciboEntregaProps {
  visible: boolean;
  onClose: () => void;
  datosRecibo: ReciboData;
}

/** Vista previa e impresión del recibo (ticket u hoja) con el diálogo de impresión del sistema. */
export default function ModalReciboEntrega({ visible, onClose, datosRecibo }: ModalReciboEntregaProps) {
  return <ImprimirRecibo open={visible} onClose={onClose} datos={datosRecibo} />;
}
