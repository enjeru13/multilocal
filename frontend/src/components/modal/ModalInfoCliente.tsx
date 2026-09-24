import { FaUser, FaBuilding, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";
import type { ReactNode } from "react";
import type { Cliente } from "@lavanderia/shared/types/types";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { ModalEncabezado, ModalPie } from "../ui/Formulario";
import { useEtiquetas } from "../../context/configuracionCore";

type Props = {
  cliente: Cliente;
  onClose: () => void;
};

function Dato({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs shrink-0">{icono}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{etiqueta}</p>
        <div className="text-sm text-gray-900 dark:text-gray-100 break-words">{children}</div>
      </div>
    </div>
  );
}

export default function ModalInfoCliente({ cliente, onClose }: Props) {
  const et = useEtiquetas();
  const nombre = [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") || "Sin nombre";
  const vacio = <span className="text-gray-400">—</span>;

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md" className="max-h-[92dvh] flex flex-col overflow-hidden">
      <ModalEncabezado
        icono={cliente.tipo === "EMPRESA" ? <FaBuilding /> : <FaUser />}
        titulo={nombre}
        subtitulo={`${et.cliente} · ${cliente.identificacion || "sin documento"}`}
        onClose={onClose}
      />
      <div className="px-4 sm:px-6 py-2 flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        <Dato icono={<FaPhoneAlt />} etiqueta="Teléfono">
          {cliente.telefono || vacio}
        </Dato>
        {cliente.telefono_secundario && (
          <Dato icono={<FaPhoneAlt />} etiqueta="Teléfono secundario">
            {cliente.telefono_secundario}
          </Dato>
        )}
        <Dato icono={<FaEnvelope />} etiqueta="Correo">
          {cliente.email || vacio}
        </Dato>
        <Dato icono={<FaMapMarkerAlt />} etiqueta="Dirección">
          {cliente.direccion || vacio}
        </Dato>
      </div>
      <ModalPie>
        <Button onClick={onClose} variant="secondary">
          Cerrar
        </Button>
      </ModalPie>
    </Modal>
  );
}
