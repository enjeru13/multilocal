import { useMemo, useRef, useState } from "react";
import { FaCheckCircle, FaExclamationCircle, FaMoneyBillWave, FaMobileAlt, FaExchangeAlt, FaPlus, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import CampoMonto from "../ui/CampoMonto";
import ResumenCobro from "../ui/ResumenCobro";
import { pagosService } from "../../services/pagosService";
import { ordenesService } from "../../services/ordenesService";
import {
  convertirDesdePrincipal,
  convertirAmonedaPrincipal,
  normalizarMoneda,
  formatearMoneda,
  parsearMonto,
  montoAEntrada,
  parsearTasa,
  type Moneda,
  type TasasConversion,
} from "../../utils/monedaHelpers";
import { calcularResumenPago } from "@lavanderia/shared/utils/pagoFinance";
import type { Orden, MetodoPago } from "@lavanderia/shared/types/types";
import { nombreCliente } from "../../utils/clienteHelpers";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";
import { useAuth } from "../../hooks/useAuth";
import { configuracionService } from "../../services/configuracionService";

interface Fila {
  id: number;
  metodo: MetodoPago;
  moneda: Moneda;
  monto: string;
}

const METODOS: { id: MetodoPago; label: string; icono: React.ReactNode }[] = [
  { id: "EFECTIVO", label: "Efectivo", icono: <FaMoneyBillWave /> },
  { id: "TRANSFERENCIA", label: "Transferencia", icono: <FaExchangeAlt /> },
  { id: "PAGO_MOVIL", label: "Pago móvil", icono: <FaMobileAlt /> },
];

const EPS = 0.005;

// Texto de un monto para el campo, con separador de miles a la manera de cada moneda.
const comoCampo = (n: number, moneda: Moneda) => montoAEntrada(n, moneda);

function Segmentos<T extends string>({
  valor,
  opciones,
  onChange,
  ariaLabel,
}: {
  valor: T;
  opciones: { id: T; label: React.ReactNode; deshabilitado?: boolean; titulo?: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          disabled={o.deshabilitado}
          title={o.titulo}
          onClick={() => onChange(o.id)}
          className={`px-3 h-8 rounded-md text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            valor === o.id
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ModalPagoProps {
  orden: Orden;
  onClose: () => void;
  onPagoRegistrado: (ordenActualizada: Orden) => void;
  tasas: TasasConversion;
  monedaPrincipal: Moneda;
}

/**
 * Cobro: por defecto propone pagar todo el saldo en efectivo; se ajusta el método,
 * la moneda y el monto, y se puede dividir en varios pagos. Si se recibe de más,
 * calcula el vuelto y lo deja registrado.
 */
export default function ModalPago({ orden, onClose, onPagoRegistrado, tasas: tasasProp, monedaPrincipal }: ModalPagoProps) {
  const et = useEtiquetas();
  const { config, refetch } = useConfiguracion();
  const { hasRole } = useAuth();
  // La tasa vigente sale de la configuración: si se cambia aquí mismo, todo se recalcula.
  const tasas: TasasConversion = useMemo(
    () => ({ VES: config?.tasaVES ?? tasasProp.VES ?? null, COP: config?.tasaCOP ?? tasasProp.COP ?? null }),
    [config, tasasProp]
  );
  const [editarTasa, setEditarTasa] = useState<Moneda | null>(null);
  const [tasaTexto, setTasaTexto] = useState("");
  const [guardandoTasa, setGuardandoTasa] = useState(false);

  const guardarTasa = async () => {
    if (!editarTasa || !config) return;
    const valor = parsearTasa(tasaTexto);
    if (!valor || valor <= 0) return toast.error("Escribe una tasa válida (mayor a 0).");
    setGuardandoTasa(true);
    try {
      await configuracionService.update({
        nombreNegocio: config.nombreNegocio ?? "Mi negocio",
        monedaPrincipal: config.monedaPrincipal,
        tasaVES: editarTasa === "VES" ? valor : config.tasaVES,
        tasaCOP: editarTasa === "COP" ? valor : config.tasaCOP,
      });
      await refetch();
      toast.success(`Tasa ${editarTasa} actualizada.`);
      setEditarTasa(null);
    } catch {
      toast.error("No se pudo guardar la tasa.");
    } finally {
      setGuardandoTasa(false);
    }
  };

  const pedirTasa = (m: Moneda) => {
    setEditarTasa(m);
    const actual = m === "VES" ? tasas.VES : m === "COP" ? tasas.COP : null;
    setTasaTexto(actual ? String(actual) : "");
  };
  const principal: Moneda = useMemo(() => normalizarMoneda(monedaPrincipal), [monedaPrincipal]);
  const resumen = useMemo(() => calcularResumenPago(orden, tasas, principal), [orden, tasas, principal]);
  const saldo = resumen.faltante;

  const monedas = useMemo(
    () =>
      (["USD", "VES", "COP"] as Moneda[]).map((m) => ({
        id: m,
        disponible: m === principal || (m === "VES" && !!tasas.VES && tasas.VES > 0) || (m === "COP" && !!tasas.COP && tasas.COP > 0),
      })),
    [principal, tasas]
  );
  const habilitada = (m: Moneda) => monedas.find((x) => x.id === m)?.disponible ?? false;

  const siguienteId = useRef(2);
  const [filas, setFilas] = useState<Fila[]>([{ id: 1, metodo: "EFECTIVO", moneda: principal, monto: comoCampo(saldo, principal) }]);
  const [monedaVuelto, setMonedaVuelto] = useState<Moneda | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const enPrincipal = (f: Fila) => convertirAmonedaPrincipal(parsearMonto(f.monto, f.moneda), f.moneda, tasas, principal);
  const recibido = filas.reduce((s, f) => s + enPrincipal(f), 0);
  const restante = Math.max(saldo - recibido, 0);
  const exceso = Math.max(recibido - saldo, 0);
  const conExceso = exceso > EPS;
  const saldaTodo = !conExceso && restante <= EPS && recibido > EPS;

  const ultima = filas[filas.length - 1];
  const monedaVueltoEfectiva: Moneda = monedaVuelto && habilitada(monedaVuelto) ? monedaVuelto : habilitada(ultima.moneda) ? ultima.moneda : principal;
  const vuelto = convertirDesdePrincipal(exceso, monedaVueltoEfectiva, tasas, principal);

  const actualizar = (id: number, cambios: Partial<Fila>) => setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambios } : f)));

  // Al cambiar de moneda se conserva el valor: los mismos dólares expresados en la nueva moneda.
  const cambiarMoneda = (f: Fila, nueva: Moneda) => {
    const equivalente = enPrincipal(f);
    actualizar(f.id, { moneda: nueva, monto: equivalente > 0 ? comoCampo(convertirDesdePrincipal(equivalente, nueva, tasas, principal), nueva) : f.monto });
  };

  // Lo que falta después de los demás pagos, en la moneda de esta fila.
  const completar = (f: Fila) => {
    const otros = filas.filter((x) => x.id !== f.id).reduce((s, x) => s + enPrincipal(x), 0);
    const falta = Math.max(saldo - otros, 0);
    actualizar(f.id, { monto: comoCampo(convertirDesdePrincipal(falta, f.moneda, tasas, principal), f.moneda) });
  };

  const agregarFila = () => {
    const falta = restante;
    setFilas((fs) => [
      ...fs,
      { id: siguienteId.current++, metodo: "TRANSFERENCIA", moneda: principal, monto: falta > EPS ? comoCampo(falta, principal) : "" },
    ]);
  };

  const quitarFila = (id: number) => setFilas((fs) => (fs.length > 1 ? fs.filter((f) => f.id !== id) : fs));

  const validas = filas.filter((f) => parsearMonto(f.monto, f.moneda) > 0);
  const puedeRegistrar = validas.length > 0 && saldo > EPS && !registrando;

  const registrar = async () => {
    if (!puedeRegistrar) return;
    setRegistrando(true);
    try {
      for (let i = 0; i < validas.length; i++) {
        const f = validas[i];
        const esUltima = i === validas.length - 1;
        await pagosService.create({
          ordenId: orden.id,
          monto: parsearMonto(f.monto, f.moneda),
          moneda: f.moneda,
          metodoPago: f.metodo,
          // El vuelto queda asociado al último pago, para que el neto por moneda cuadre en caja.
          ...(esUltima && conExceso && vuelto > 0 ? { vueltos: [{ monto: vuelto, moneda: monedaVueltoEfectiva }] } : {}),
        });
      }
      toast.success(validas.length > 1 ? "Pagos registrados." : "Pago registrado.");
      const res = await ordenesService.getById(orden.id);
      if (res.data) onPagoRegistrado(res.data);
      onClose();
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo registrar el pago." : "No se pudo registrar el pago.");
    } finally {
      setRegistrando(false);
    }
  };

  const equivalencias = (["VES", "COP"] as const).filter((m) => m !== principal && habilitada(m));

  return (
    <Modal open onClose={onClose} maxWidth="max-w-2xl" className="max-h-[92vh] overflow-hidden flex flex-col">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cobrar {et.ordenMin} #{orden.id}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{nombreCliente(orden.cliente)}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer" title="Cerrar" aria-label="Cerrar">
          <FaTimes />
        </button>
      </div>

      <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
        <ResumenCobro total={orden.total} abonado={resumen.abonado} saldo={saldo} moneda={principal} />

        {equivalencias.length > 0 && saldo > EPS && (
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            Saldo equivalente:{" "}
            {equivalencias.map((m, i) => (
              <span key={m}>
                {i > 0 && " · "}
                <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">{formatearMoneda(convertirDesdePrincipal(saldo, m, tasas, principal), m)}</span>
              </span>
            ))}
          </p>
        )}

        {saldo <= EPS ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-5 text-center">
            <FaCheckCircle className="mx-auto text-2xl text-emerald-600 dark:text-emerald-400 mb-2" />
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">Esta {et.ordenMin} ya está saldada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filas.map((f, i) => {
              const equiv = enPrincipal(f);
              return (
                <div key={f.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{filas.length > 1 ? `Pago ${i + 1}` : "Cómo paga"}</p>
                    {filas.length > 1 && (
                      <button type="button" onClick={() => quitarFila(f.id)} className="text-gray-400 hover:text-red-500 p-1 cursor-pointer" title="Quitar este pago" aria-label="Quitar este pago">
                        <FaTimes size={12} />
                      </button>
                    )}
                  </div>

                  <Segmentos
                    ariaLabel="Método de pago"
                    valor={f.metodo}
                    onChange={(m) => actualizar(f.id, { metodo: m })}
                    opciones={METODOS.map((m) => ({ id: m.id, label: (<><span className="text-xs">{m.icono}</span>{m.label}</>) }))}
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <Segmentos
                      ariaLabel="Moneda"
                      valor={f.moneda}
                      onChange={(m) => (habilitada(m) ? cambiarMoneda(f, m) : pedirTasa(m))}
                      opciones={monedas.map((m) => ({
                        id: m.id,
                        label: m.disponible ? m.id : (<>{m.id}<span className="text-amber-500" title="Falta la tasa">•</span></>),
                        titulo: m.disponible ? undefined : `Falta la tasa ${m.id}: haz clic para definirla`,
                      }))}
                    />
                    <div className="flex-1 min-w-40 flex items-center gap-2">
                      <CampoMonto
                        moneda={f.moneda}
                        value={f.monto}
                        onValue={(monto) => actualizar(f.id, { monto })}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            registrar();
                          }
                        }}
                        autoFocus={i === 0}
                        aria-label={`Monto en ${f.moneda}`}
                        placeholder="0.00"
                        className="w-full h-11 px-3 text-right text-xl font-semibold tabular-nums rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => completar(f)} title="Poner lo que falta por cobrar">
                        Todo
                      </Button>
                    </div>
                  </div>

                  {f.moneda !== principal && equiv > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      Equivale a <strong className="text-gray-700 dark:text-gray-300">{formatearMoneda(equiv, principal)}</strong> (tasa {f.moneda === "VES" ? tasas.VES : tasas.COP}
                      {hasRole(["ADMIN"]) && (
                        <>
                          {" · "}
                          <button type="button" onClick={() => pedirTasa(f.moneda)} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                            cambiar
                          </button>
                        </>
                      )}
                      )
                    </p>
                  )}
                </div>
              );
            })}

            {editarTasa && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {(editarTasa === "VES" ? tasas.VES : tasas.COP) ? `Tasa ${editarTasa} del día` : `Falta la tasa ${editarTasa}`}
                </p>
                {hasRole(["ADMIN"]) ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-amber-800 dark:text-amber-300">{editarTasa} por 1 {principal}:</span>
                    <input
                      autoFocus
                      value={tasaTexto}
                      onChange={(e) => setTasaTexto(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), guardarTasa())}
                      inputMode="decimal"
                      placeholder={editarTasa === "VES" ? "Ej. 38,50" : "Ej. 4000"}
                      className="w-32 h-9 px-3 text-right tabular-nums rounded-lg border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                    <Button size="sm" variant="primary" onClick={guardarTasa} isLoading={guardandoTasa}>
                      Guardar tasa
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditarTasa(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-amber-800 dark:text-amber-300">Pide a un administrador que defina la tasa {editarTasa} para poder cobrar en esa moneda.</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={agregarFila}
              className="w-full h-10 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <FaPlus size={11} /> Dividir en otro método o moneda
            </button>

            {/* Qué pasa con lo que se está recibiendo */}
            {recibido > EPS && (
              <div
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  conExceso
                    ? "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10"
                    : saldaTodo
                    ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10"
                    : "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10"
                }`}
              >
                {saldaTodo ? (
                  <FaCheckCircle className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <FaExclamationCircle className={`mt-0.5 shrink-0 ${conExceso ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400"}`} />
                )}
                <div className="flex-1 min-w-0 text-sm">
                  {saldaTodo && <p className="font-semibold text-emerald-800 dark:text-emerald-200">Con este pago la {et.ordenMin} queda saldada.</p>}
                  {!saldaTodo && !conExceso && (
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                      Quedará un saldo de {formatearMoneda(restante, principal)}
                      {equivalencias.length > 0 && (
                        <span className="font-normal text-amber-700 dark:text-amber-300">
                          {" "}
                          ({equivalencias.map((m) => formatearMoneda(convertirDesdePrincipal(restante, m, tasas, principal), m)).join(" · ")})
                        </span>
                      )}
                    </p>
                  )}
                  {conExceso && (
                    <>
                      <p className="font-semibold text-sky-800 dark:text-sky-200">
                        Recibes {formatearMoneda(exceso, principal)} de más: entrega vuelto de{" "}
                        <span className="tabular-nums">{formatearMoneda(vuelto, monedaVueltoEfectiva)}</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
                        Dar el vuelto en
                        <Segmentos
                          ariaLabel="Moneda del vuelto"
                          valor={monedaVueltoEfectiva}
                          onChange={setMonedaVuelto}
                          opciones={monedas.map((m) => ({ id: m.id, label: m.id, deshabilitado: !m.disponible }))}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 flex items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/30">
        <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
          {recibido > EPS ? (
            <>
              Recibes <strong className="text-gray-900 dark:text-gray-100 tabular-nums">{formatearMoneda(recibido, principal)}</strong>
            </>
          ) : (
            "Indica cuánto te pagan"
          )}
        </p>
        <div className="flex gap-3 ml-auto">
          <Button onClick={onClose} variant="secondary" disabled={registrando}>
            {saldo <= EPS ? "Cerrar" : "Cancelar"}
          </Button>
          {saldo > EPS && (
            <Button onClick={registrar} variant="primary" disabled={!puedeRegistrar} isLoading={registrando}>
              {recibido > EPS ? `Registrar ${formatearMoneda(Math.min(recibido, saldo), principal)}` : "Registrar pago"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
