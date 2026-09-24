import { useEffect, useState } from "react";
import { clientesService } from "../../services/clientesService";
import { FaUser } from "react-icons/fa";
import type { Cliente } from "@lavanderia/shared/types/types";
import { toast } from "react-toastify";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { useEtiquetas } from "../../context/configuracionCore";

type Props = {
  onSelect: (cliente: Cliente) => void;
  onClose: () => void;
};

export default function ListaClientesModal({ onSelect, onClose }: Props) {
  const et = useEtiquetas();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setErrorCarga(null);
    clientesService
      .getAll()
      .then((res) => {
        setClientes(res.data);
      })
      .catch((err) => {
        console.error("Error al cargar clientes:", err);
        setErrorCarga(
          `No se pudieron cargar ${et.clientesMin}. Inténtalo de nuevo más tarde.`
        );
        toast.error(`Error al cargar ${et.clientesMin}.`);
      })
      .finally(() => {
        setCargando(false);
      });
  }, [et]);

  const clientesFiltrados = clientes.filter((c) => {
    const nombreCompleto =
      `${c.nombre} ${c.apellido} ${c.identificacion} ${c.telefono}`.toLowerCase();
    return nombreCompleto.includes(busqueda.toLowerCase());
  });

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-3">
            <FaUser className="text-2xl" />
            Seleccionar {et.cliente}
          </h2>
          <button
            onClick={onClose}
            title="Cerrar"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex-1 flex flex-col space-y-5 text-base text-gray-800 dark:text-gray-200 overflow-hidden transition-colors">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, apellido, identificación o teléfono"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
          />

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {cargando ? (
              <p className="text-center text-indigo-600 dark:text-indigo-400 font-semibold py-8">
                Cargando {et.clientesMin}...
              </p>
            ) : errorCarga ? (
              <p className="text-center text-red-600 dark:text-red-400 font-semibold py-8">
                {errorCarga}
              </p>
            ) : clientesFiltrados.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-500 italic text-center py-8">
                No se encontraron {et.clientesMin} que coincidan con la búsqueda.
              </p>
            ) : (
              clientesFiltrados.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200 ease-in-out shadow-sm hover:shadow-md cursor-pointer"
                  onClick={() => onSelect(c)}
                >
                  <div className="mb-2 sm:mb-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-lg transition-colors">
                      {c.nombre} {c.apellido}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{c.identificacion}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                      <span className="font-medium">Tel:</span> {c.telefono}
                    </p>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(c);
                    }}
                    variant="primary"
                    size="sm"
                  >
                    Seleccionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex justify-end">
          <Button onClick={onClose} variant="secondary">
            Cerrar
          </Button>
        </div>
    </Modal>
  );
}
