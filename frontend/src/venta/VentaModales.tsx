import dayjs from "dayjs";
import { FaTrashAlt, FaPauseCircle, FaPrint } from "react-icons/fa";
import ImprimirRecibo from "../impresion/informes/InformeRecibo";
import type { Cliente, ClienteCreate } from "@lavanderia/shared/types/types";
import { clientesService } from "../services/clientesService";
import ModalPago from "../components/modal/ModalPago";
import ListaClientesModal from "../components/modal/ListaClientesModal";
import FormularioCliente from "../components/formulario/FormularioCliente";
import Modal from "../components/ui/Modal";
import { ModalEncabezado, ModalPie } from "../components/ui/Formulario";
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
        <Modal open onClose={cerrarEspera} maxWidth="max-w-lg" className="max-h-[85vh] flex flex-col overflow-hidden">
          <ModalEncabezado icono={<FaPauseCircle />} titulo={`Ventas ${nombreEspera}`} subtitulo={`${venta.enEspera.length} guardada(s)`} onClose={cerrarEspera} />
          <div className="px-6 py-4 flex-1 overflow-y-auto">
            {venta.enEspera.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No hay ventas guardadas.</p>
            ) : (
              <ul className="space-y-2">
                {venta.enEspera.map((e, i) => {
                  const total = e.lineas.reduce((s, l) => {
                    const p = l.precio ?? venta.catalogo.find((x) => x.id === l.servicioId)?.precioBase ?? 0;
                    return s + p * l.cantidad;
                  }, 0);
                  return (
                    <li key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                      <span className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{e.etiqueta}</p>
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
          </div>
          <ModalPie>
            <Button variant="secondary" onClick={cerrarEspera}>
              Cerrar
            </Button>
          </ModalPie>
        </Modal>
      )}

      {venta.ultimaCobrada && !venta.ordenACobrar && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-gray-900 shadow-xl pl-4 pr-2 py-2">
          <span className="text-sm text-gray-700 dark:text-gray-200">
            {venta.et.orden} <strong>#{venta.ultimaCobrada.numero}</strong> cobrada
          </span>
          <Button size="sm" variant="primary" leftIcon={<FaPrint />} onClick={venta.abrirRecibo}>
            Imprimir recibo
          </Button>
          <button type="button" onClick={venta.descartarUltimaCobrada} aria-label="Cerrar aviso" className="w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
            ×
          </button>
        </div>
      )}

      {venta.recibo && <ImprimirRecibo open onClose={venta.cerrarRecibo} datos={venta.recibo} />}

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
