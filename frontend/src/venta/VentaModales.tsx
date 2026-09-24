import dayjs from "dayjs";
import { FaTrashAlt, FaPauseCircle } from "react-icons/fa";
import type { Cliente, ClienteCreate } from "@lavanderia/shared/types/types";
import { clientesService } from "../services/clientesService";
import ModalPago from "../components/modal/ModalPago";
import ListaClientesModal from "../components/modal/ListaClientesModal";
import FormularioCliente from "../components/formulario/FormularioCliente";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { formatearMoneda } from "../utils/monedaHelpers";
import type { VentaApi } from "./useVenta";

interface Props {
  venta: VentaApi;
  verClientes: boolean;
  nuevoCliente: boolean;
  verEspera: boolean;
  cerrarClientes: () => void;
  cerrarNuevoCliente: () => void;
  cerrarEspera: () => void;
  /** Palabra para las ventas guardadas: "en espera" en caja, "cotizaciones" en facturación. */
  nombreEspera?: string;
  onCliente?: (c: Cliente) => void;
}

/** Ventanas que comparten las pantallas de venta: clientes, pago y ventas en espera. */
export default function VentaModales({
  venta,
  verClientes,
  nuevoCliente,
  verEspera,
  cerrarClientes,
  cerrarNuevoCliente,
  cerrarEspera,
  nombreEspera = "en espera",
  onCliente,
}: Props) {
  const elegirCliente = (c: Cliente) => {
    venta.setCliente(c);
    onCliente?.(c);
  };

  return (
    <>
      {verClientes && (
        <ListaClientesModal
          onClose={cerrarClientes}
          onSelect={(c) => {
            elegirCliente(c);
            cerrarClientes();
          }}
        />
      )}

      {nuevoCliente && (
        <FormularioCliente
          onClose={cerrarNuevoCliente}
          onSubmit={async (data) => {
            const res = await clientesService.create(data as ClienteCreate);
            elegirCliente(res.data);
            cerrarNuevoCliente();
          }}
        />
      )}

      {verEspera && (
        <Modal open onClose={cerrarEspera} maxWidth="max-w-lg" className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3 mb-4">
            <FaPauseCircle className="text-amber-500" /> Ventas {nombreEspera}
          </h2>
          {venta.enEspera.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No hay ventas guardadas.</p>
          ) : (
            <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
              {venta.enEspera.map((e, i) => {
                const total = e.lineas.reduce((s, l) => {
                  const p = l.precio ?? venta.catalogo.find((x) => x.id === l.servicioId)?.precioBase ?? 0;
                  return s + p * l.cantidad;
                }, 0);
                return (
                  <li key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                    <span className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{e.etiqueta}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {e.lineas.length} artículo(s) · {formatearMoneda(total, venta.moneda)} · {dayjs(e.fecha).format("HH:mm")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        venta.recuperar(e.id);
                        cerrarEspera();
                      }}
                    >
                      Recuperar
                    </Button>
                    <Button size="icon" variant="iconDanger" title="Descartar" onClick={() => venta.descartarEspera(e.id)}>
                      <FaTrashAlt size={12} />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}

      {venta.ordenACobrar && (
        <ModalPago
          orden={venta.ordenACobrar}
          tasas={venta.tasas}
          monedaPrincipal={venta.moneda}
          onClose={venta.cerrarCobro}
          onPagoRegistrado={venta.marcarCobrada}
        />
      )}
    </>
  );
}
