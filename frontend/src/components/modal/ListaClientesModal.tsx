import { useEffect, useState } from "react";
import { clientesService } from "../../services/clientesService";
import { FaUser, FaBuilding, FaSearch, FaChevronRight } from "react-icons/fa";
import type { Cliente } from "@lavanderia/shared/types/types";
import { toast } from "react-toastify";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { ModalEncabezado, ModalPie, campo } from "../ui/Formulario";
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
        setErrorCarga(`No se pudieron cargar ${et.clientesMin}. Inténtalo de nuevo más tarde.`);
        toast.error(`Error al cargar ${et.clientesMin}.`);
      })
      .finally(() => {
        setCargando(false);
      });
  }, [et]);

  const clientesFiltrados = clientes.filter((c) => {
    const texto = `${c.nombre} ${c.apellido} ${c.identificacion} ${c.telefono}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="h-[80dvh] max-h-[640px] flex flex-col overflow-hidden">
      <ModalEncabezado icono={<FaUser />} titulo={`Elegir ${et.clienteMin}`} subtitulo={cargando ? undefined : `${clientes.length} registrados`} onClose={onClose} />

      <div className="px-4 sm:px-6 pt-4 pb-3">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, documento o teléfono"
            className={`${campo} pl-9`}
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {cargando ? (
          <p className="text-center text-sm text-gray-500 py-10">Cargando {et.clientesMin}…</p>
        ) : errorCarga ? (
          <p className="text-center text-sm text-red-600 dark:text-red-400 py-10">{errorCarga}</p>
        ) : clientesFiltrados.length === 0 ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">Ningún {et.clienteMin} coincide con la búsqueda.</p>
        ) : (
          <ul>
            {clientesFiltrados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer group"
                >
                  <span className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm shrink-0">
                    {c.tipo === "EMPRESA" ? <FaBuilding /> : <FaUser />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {c.nombre} {c.apellido}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                      {[c.identificacion, c.telefono].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <FaChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 text-xs shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModalPie>
        <Button onClick={onClose} variant="secondary">
          Cerrar
        </Button>
      </ModalPie>
    </Modal>
  );
}
