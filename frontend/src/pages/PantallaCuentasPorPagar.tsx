import { Fragment, useCallback, useEffect, useState } from "react";
import { useMonedas } from "../context/useMonedas";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaFileInvoiceDollar, FaExclamationCircle, FaChevronRight, FaPrint } from "react-icons/fa";
import type { Compra, CuentasPorPagar, MetodoPago, Moneda } from "@lavanderia/shared/types/types";
import { comprasService } from "../services/comprasService";
import { convertirDesdePrincipal, formatearMoneda, montoAEntrada, parsearMonto } from "../utils/monedaHelpers";
import { useConfiguracion } from "../context/configuracionCore";
import Modal from "../components/ui/Modal";
import CampoMonto from "../components/ui/CampoMonto";
import ImprimirPorPagar from "../impresion/informes/InformePagar";
import { Campo, ModalEncabezado, ModalPie, Opcion, campo } from "../components/ui/Formulario";
import Button from "../components/ui/Button";

const tarjeta = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";

function ModalPagarCompra({ compra, moneda, onClose, onPagada }: { compra: Compra; moneda: Moneda; onClose: () => void; onPagada: () => void }) {
  const { config } = useConfiguracion();
  const negocio = useMonedas();
  const tasas = negocio.tasas;
  const monedas = negocio.usables;

  const [monedaPago, setMonedaPago] = useState<Moneda>(moneda);
  const [monto, setMonto] = useState(montoAEntrada(compra.saldo, moneda));
  const [metodo, setMetodo] = useState<MetodoPago>("TRANSFERENCIA");
  const [desdeCaja, setDesdeCaja] = useState(true);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cambiarMoneda = (m: Moneda) => {
    setMonedaPago(m);
    setMonto(montoAEntrada(convertirDesdePrincipal(compra.saldo, m, tasas, moneda), m));
  };

  const pagar = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parsearMonto(monto, monedaPago);
    if (isNaN(n) || n <= 0) return toast.error("El monto debe ser mayor a 0.");
    setGuardando(true);
    try {
      await comprasService.pagar(compra.id, {
        monto: n,
        moneda: monedaPago,
        metodoPago: metodo,
        nota: nota.trim() || null,
        desdeCaja: config?.moduloCaja && metodo === "EFECTIVO" ? desdeCaja : false,
      });
      toast.success("Pago registrado.");
      onPagada();
      onClose();
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo registrar el pago." : "No se pudo registrar el pago.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md">
      <ModalEncabezado icono={<FaFileInvoiceDollar />} titulo={`Pagar compra #${compra.id}`} subtitulo={compra.proveedor?.nombre} onClose={onClose} />
      <form id="pagar-compra-form" onSubmit={pagar} className="px-6 py-5 space-y-4">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-amber-800 dark:text-amber-300">Se debe</span>
          <strong className="text-lg tabular-nums text-amber-900 dark:text-amber-200">{formatearMoneda(compra.saldo, moneda)}</strong>
        </div>
        <Campo etiqueta="Monto a pagar" ayuda={monedaPago !== moneda ? `Equivale a ${formatearMoneda(compra.saldo, moneda)} al cambio actual.` : undefined}>
          <div className="flex gap-2">
            <CampoMonto moneda={monedaPago} className={`${campo} flex-1 text-right tabular-nums`} value={monto} onValue={setMonto} autoFocus aria-label="Monto a pagar" />
            <select className={`${campo} w-24!`} value={monedaPago} onChange={(e) => cambiarMoneda(e.target.value as Moneda)} aria-label="Moneda">
              {monedas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </Campo>
        <Campo etiqueta="Método de pago">
          <select className={campo} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="PAGO_MOVIL">Pago móvil</option>
            <option value="EFECTIVO">Efectivo</option>
          </select>
        </Campo>
        {config?.moduloCaja && metodo === "EFECTIVO" && <Opcion activo={desdeCaja} onChange={setDesdeCaja} titulo="Sale de la caja abierta" detalle="Queda como egreso de la caja." />}
        <Campo etiqueta="Nota" opcional>
          <input className={campo} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
        </Campo>
      </form>
      <ModalPie>
        <Button type="button" variant="secondary" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" form="pagar-compra-form" variant="primary" isLoading={guardando}>
          Registrar pago
        </Button>
      </ModalPie>
    </Modal>
  );
}

export default function PantallaCuentasPorPagar() {
  const [data, setData] = useState<CuentasPorPagar | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aPagar, setAPagar] = useState<Compra | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [imprimir, setImprimir] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await comprasService.porPagar();
      setData(res.data);
    } catch {
      toast.error("No se pudieron cargar las cuentas por pagar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const moneda = (data?.moneda ?? "USD") as Moneda;
  const fmt = (n: number) => formatearMoneda(n, moneda);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FaFileInvoiceDollar className="text-amber-500" /> Cuentas por pagar
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Lo que se le debe a proveedores por compras a crédito.</p>
        </div>
        <Button variant="secondary" leftIcon={<FaPrint />} onClick={() => setImprimir(true)}>
          Imprimir
        </Button>
      </header>
      <ImprimirPorPagar open={imprimir} onClose={() => setImprimir(false)} />

      {cargando ? (
        <div className={`${tarjeta} h-40 animate-pulse`} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`${tarjeta} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total por pagar</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{fmt(data?.total ?? 0)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{data?.compras.length ?? 0} compra(s) con saldo</p>
            </div>
            <div className={`${tarjeta} p-5 ${data && data.vencido > 0 ? "ring-1 ring-red-500/40" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Vencido</p>
              <p className={`mt-1 text-3xl font-bold ${data && data.vencido > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                {fmt(data?.vencido ?? 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pasó la fecha de pago acordada</p>
            </div>
          </div>

          {data && data.proveedores.length > 0 && (
            <section className={`${tarjeta} p-5`}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Por proveedor</h2>
              <ul className="space-y-2 text-sm">
                {data.proveedores.map((p) => (
                  <li key={p.proveedorId} className="flex justify-between gap-3">
                    <span className="text-gray-800 dark:text-gray-200">
                      {p.nombre} <span className="text-gray-400">· {p.compras} compra(s)</span>
                    </span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {fmt(p.saldo)}
                      {p.vencido > 0 && <span className="ml-2 text-xs font-normal text-red-500">({fmt(p.vencido)} vencido)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 text-left">Compra</th>
                  <th className="px-5 py-3 text-left">Proveedor</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Vence</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                  <th className="px-5 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(!data || data.compras.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400 italic">
                      No debes nada por ahora.
                    </td>
                  </tr>
                )}
                {data?.compras.map((c) => (
                  <Fragment key={c.id}>
                  <tr className="border-t border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                    <td className="px-5 py-3 font-bold text-blue-700 dark:text-blue-400">
                      <button type="button" onClick={() => setAbierta(abierta === c.id ? null : c.id)} className="inline-flex items-center gap-2 cursor-pointer" aria-expanded={abierta === c.id} title="Ver pagos hechos">
                        <FaChevronRight size={10} className={`text-gray-400 transition-transform ${abierta === c.id ? "rotate-90" : ""}`} />#{c.id}
                      </button>
                    </td>
                    <td className="px-5 py-3">{c.proveedor?.nombre}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{dayjs(c.fecha).format("DD/MM/YYYY")}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {c.fechaVencimiento ? (
                        <span className={c.vencida ? "text-red-600 dark:text-red-400 font-semibold inline-flex items-center gap-1" : ""}>
                          {c.vencida && <FaExclamationCircle size={11} />}
                          {dayjs(c.fechaVencimiento).format("DD/MM/YYYY")}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmt(c.total)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-gray-100">{fmt(c.saldo)}</td>
                    <td className="px-5 py-3 text-center">
                      <Button variant="primary" size="sm" onClick={() => setAPagar(c)}>
                        Pagar
                      </Button>
                    </td>
                  </tr>
                  {abierta === c.id && (
                    <tr className="bg-gray-50/70 dark:bg-gray-950/30">
                      <td colSpan={7} className="px-5 py-3">
                        {(c.pagos ?? []).length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Aún no se ha pagado nada de esta compra.</p>
                        ) : (
                          <ul className="text-sm space-y-1.5">
                            {(c.pagos ?? []).map((p) => (
                              <li key={p.id} className="flex flex-wrap justify-between gap-3 text-gray-700 dark:text-gray-300">
                                <span>
                                  {dayjs(p.fecha).format("DD/MM/YYYY")} · {p.metodoPago === "EFECTIVO" ? "Efectivo" : p.metodoPago === "TRANSFERENCIA" ? "Transferencia" : "Pago móvil"}
                                  {p.nota && <span className="text-gray-400"> · {p.nota}</span>}
                                </span>
                                <span className="tabular-nums font-medium">
                                  {formatearMoneda(p.montoMoneda, p.moneda)}
                                  {p.moneda !== moneda && (
                                    <span className="text-gray-500 dark:text-gray-400 font-normal"> ≈ {fmt(p.monto)} (tasa {p.tasa})</span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aPagar && <ModalPagarCompra compra={aPagar} moneda={moneda} onClose={() => setAPagar(null)} onPagada={cargar} />}
    </div>
  );
}
