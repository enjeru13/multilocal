import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { useMonedas } from "../context/useMonedas";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import dayjs from "dayjs";
import { FaCashRegister, FaLockOpen, FaLock, FaPlus, FaMinus, FaChevronRight, FaPrint } from "react-icons/fa";
import { cajaService, type CajaActual, type CajaMonedaResumen, type CajaSesion, type DetalleCierreMoneda } from "../services/cajaService";
import { useConfiguracion } from "../context/configuracionCore";
import { useAuth } from "../hooks/useAuth";
import { convertirAmonedaPrincipal, formatearMoneda, parsearMonto, type Moneda } from "../utils/monedaHelpers";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import CampoMonto from "../components/ui/CampoMonto";
import ImprimirCierreCaja from "../impresion/informes/InformeCaja";
import { Campo, ModalEncabezado, ModalPie, campo } from "../components/ui/Formulario";

const inputCls = campo;
const tarjeta = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm";

const NOMBRE_MONEDA: Record<Moneda, string> = { USD: "Dólares", VES: "Bolívares", COP: "Pesos colombianos" };

function msgError(err: unknown, fallback: string) {
  return err instanceof AxiosError ? err.response?.data?.message ?? fallback : fallback;
}

function Selector<T extends string>({ valor, opciones, onChange }: { valor: T; opciones: T[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 h-8 rounded-md text-[13px] font-medium cursor-pointer ${
            valor === o ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function PantallaCaja() {
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const principal = (config?.monedaPrincipal ?? "USD") as Moneda;
  const negocio = useMonedas();
  const tasas = negocio.tasas;
  const fmt = (n: number) => formatearMoneda(n, principal);
  const monedasConTasa = negocio.usables;

  const [caja, setCaja] = useState<CajaActual | null>(null);
  const [historial, setHistorial] = useState<CajaSesion[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [montoInicial, setMontoInicial] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [movTipo, setMovTipo] = useState<"INGRESO" | "EGRESO" | null>(null);
  const [movMonto, setMovMonto] = useState("");
  const [movMoneda, setMovMoneda] = useState<Moneda>(principal);
  const [movConcepto, setMovConcepto] = useState("");

  const [cerrando, setCerrando] = useState(false);
  const [imprimirId, setImprimirId] = useState<number | null>(null);
  const [contado, setContado] = useState<Partial<Record<Moneda, string>>>({});
  const [observacion, setObservacion] = useState("");

  const cargar = useCallback(async () => {
    try {
      const res = await cajaService.actual();
      setCaja(res.data);
      if (hasRole(["ADMIN"])) {
        const h = await cajaService.historial();
        setHistorial(h.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("No se pudo cargar la caja.");
    }
  }, [hasRole]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = async () => {
    const n = montoInicial === "" ? NaN : parsearMonto(montoInicial, principal);
    if (isNaN(n) || n < 0) return toast.error("Indica un monto inicial válido.");
    setEnviando(true);
    try {
      await cajaService.abrir(n);
      toast.success("Caja abierta.");
      setMontoInicial("");
      cargar();
    } catch (err) {
      toast.error(msgError(err, "No se pudo abrir la caja."));
    } finally {
      setEnviando(false);
    }
  };

  const guardarMovimiento = async () => {
    const n = parsearMonto(movMonto, movMoneda);
    if (!movTipo || n <= 0 || !movConcepto.trim()) return toast.error("Completa monto y concepto.");
    setEnviando(true);
    try {
      await cajaService.movimiento({ tipo: movTipo, monto: n, moneda: movMoneda, concepto: movConcepto.trim() });
      toast.success(movTipo === "INGRESO" ? "Ingreso registrado." : "Egreso registrado.");
      setMovTipo(null);
      setMovMonto("");
      setMovConcepto("");
      cargar();
    } catch (err) {
      toast.error(msgError(err, "No se pudo registrar el movimiento."));
    } finally {
      setEnviando(false);
    }
  };

  // Filas del arqueo: cada moneda con movimiento, más las que tienen tasa para poder contarlas.
  const filasArqueo = useMemo<CajaMonedaResumen[]>(() => {
    if (!caja || !caja.abierta) return [];
    const base = [...caja.porMoneda];
    for (const m of monedasConTasa) {
      if (!base.some((f) => f.moneda === m)) base.push({ moneda: m, inicial: 0, cobrado: 0, vueltos: 0, ingresos: 0, egresos: 0, esperado: 0 });
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caja, config]);

  const cerrar = async () => {
    const porMoneda: Partial<Record<Moneda, number>> = {};
    for (const f of filasArqueo) {
      const txt = contado[f.moneda];
      if (txt !== undefined && txt !== "") porMoneda[f.moneda] = parsearMonto(txt, f.moneda);
      else if (f.moneda === principal || f.esperado !== 0) return toast.error(`Indica cuánto ${NOMBRE_MONEDA[f.moneda].toLowerCase()} hay en la caja (puede ser 0).`);
    }
    setEnviando(true);
    try {
      const cierre = await cajaService.cerrar({ contadoPorMoneda: porMoneda, observacionCierre: observacion.trim() || undefined });
      toast.success("Caja cerrada.");
      // Al cerrar se ofrece el comprobante para firmar y archivar.
      setImprimirId(cierre.data.id);
      setCerrando(false);
      setContado({});
      setObservacion("");
      cargar();
    } catch (err) {
      toast.error(msgError(err, "No se pudo cerrar la caja."));
    } finally {
      setEnviando(false);
    }
  };

  if (!caja) return <div className="p-6 text-gray-500">Cargando caja...</div>;

  const totalContadoPrincipal = filasArqueo.reduce((s, f) => {
    const txt = contado[f.moneda];
    return s + (txt ? convertirAmonedaPrincipal(parsearMonto(txt, f.moneda), f.moneda, tasas, principal) : 0);
  }, 0);
  const hayConteo = filasArqueo.some((f) => contado[f.moneda]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <FaCashRegister className="text-emerald-600" /> Caja
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Apertura, movimientos y cierre con arqueo del efectivo de cada moneda.</p>
      </div>

      {!caja.abierta ? (
        <section className={`${tarjeta} p-6 space-y-4`}>
          <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FaLockOpen className="text-emerald-600" /> Abrir caja
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">La caja está cerrada. Para registrar pagos, ábrela indicando el efectivo con el que inicias.</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Efectivo inicial ({principal})</label>
              <CampoMonto moneda={principal} value={montoInicial} onValue={setMontoInicial} className={`${inputCls} text-right tabular-nums`} placeholder="0.00" />
            </div>
            <Button onClick={abrir} variant="primary" isLoading={enviando}>
              Abrir caja
            </Button>
          </div>
          <p className="text-xs text-gray-400">Si empiezas con efectivo en otra moneda, regístralo después como un ingreso en esa moneda.</p>
        </section>
      ) : (
        <section className={`${tarjeta} p-6 space-y-5`}>
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FaLockOpen className="text-emerald-600" /> Caja abierta
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Desde {dayjs(caja.sesion.fechaApertura).format("DD/MM/YYYY HH:mm")} · {caja.cantidadPagos} pagos</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setMovMoneda(principal); setMovTipo("INGRESO"); }} variant="iconSuccess" size="sm" leftIcon={<FaPlus size={10} />}>
                Ingreso
              </Button>
              <Button onClick={() => { setMovMoneda(principal); setMovTipo("EGRESO"); }} variant="iconWarning" size="sm" leftIcon={<FaMinus size={10} />}>
                Egreso
              </Button>
              <Button onClick={() => setImprimirId(caja.sesion.id)} variant="iconNeutral" size="sm" leftIcon={<FaPrint size={10} />} title="Imprimir el arqueo hasta este momento">
                Arqueo
              </Button>
              <Button onClick={() => setCerrando(true)} variant="danger" size="sm" leftIcon={<FaLock size={10} />}>
                Cerrar caja
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Efectivo esperado por moneda</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {caja.porMoneda.map((f) => (
                <div key={f.moneda} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{NOMBRE_MONEDA[f.moneda]}</span>
                    <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatearMoneda(f.esperado, f.moneda)}</span>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {f.inicial > 0 && <div className="flex justify-between"><dt>Inicial</dt><dd>{formatearMoneda(f.inicial, f.moneda)}</dd></div>}
                    <div className="flex justify-between"><dt>Cobrado en efectivo</dt><dd>{formatearMoneda(f.cobrado, f.moneda)}</dd></div>
                    {f.vueltos > 0 && <div className="flex justify-between"><dt>Vueltos entregados</dt><dd>− {formatearMoneda(f.vueltos, f.moneda)}</dd></div>}
                    {f.ingresos > 0 && <div className="flex justify-between"><dt>Ingresos</dt><dd>+ {formatearMoneda(f.ingresos, f.moneda)}</dd></div>}
                    {f.egresos > 0 && <div className="flex justify-between"><dt>Egresos</dt><dd>− {formatearMoneda(f.egresos, f.moneda)}</dd></div>}
                  </dl>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Otros métodos (transferencia, pago móvil): <strong className="text-gray-800 dark:text-gray-200 tabular-nums">{fmt(caja.otrosMetodos)}</strong>
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                Total en {principal}: <strong className="text-gray-900 dark:text-gray-100 tabular-nums">{fmt(caja.efectivoEsperado)}</strong>
              </span>
            </div>
          </div>

          {caja.sesion.movimientos && caja.sesion.movimientos.length > 0 && (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Movimientos manuales</p>
              {caja.sesion.movimientos.map((m) => (
                <div key={m.id} className="flex justify-between text-sm py-1">
                  <span className="text-gray-700 dark:text-gray-300">{m.concepto}</span>
                  <span className={`tabular-nums ${m.tipo === "INGRESO" ? "text-emerald-600" : "text-red-500"}`}>
                    {m.tipo === "INGRESO" ? "+" : "-"} {formatearMoneda(m.monto, m.moneda)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {hasRole(["ADMIN"]) && historial.length > 0 && (
        <section>
          <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-3">Historial de cierres</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full bg-white dark:bg-gray-900 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left">Apertura</th>
                  <th className="px-4 py-2 text-left">Cierre</th>
                  <th className="px-4 py-2 text-right">Esperado</th>
                  <th className="px-4 py-2 text-right">Contado</th>
                  <th className="px-4 py-2 text-right">Diferencia</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {historial.map((s) => {
                  const detalle: DetalleCierreMoneda[] = s.detalleCierre ? JSON.parse(s.detalleCierre) : [];
                  return (
                    <Fragment key={s.id}>
                      <tr
                        className={`border-t border-gray-100 dark:border-gray-800 ${detalle.length > 0 ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40" : ""}`}
                        onClick={() => detalle.length > 0 && setAbierto(abierto === s.id ? null : s.id)}
                      >
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          <span className="inline-flex items-center gap-2">
                            {detalle.length > 0 && <FaChevronRight size={9} className={`text-gray-400 transition-transform ${abierto === s.id ? "rotate-90" : ""}`} />}
                            {dayjs(s.fechaApertura).format("DD/MM/YY HH:mm")}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{s.fechaCierre ? dayjs(s.fechaCierre).format("DD/MM/YY HH:mm") : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(s.montoFinalSistema ?? 0)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(s.montoFinalContado ?? 0)}</td>
                        <td className={`px-4 py-2 text-right font-semibold tabular-nums ${(s.diferencia ?? 0) === 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(s.diferencia ?? 0)}</td>
                        <td className="px-2 py-1 text-right">
                          <Button
                            variant="iconNeutral"
                            size="icon"
                            title="Imprimir el comprobante de este cierre"
                            aria-label="Imprimir comprobante"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImprimirId(s.id);
                            }}
                          >
                            <FaPrint size={11} />
                          </Button>
                        </td>
                      </tr>
                      {abierto === s.id && detalle.length > 0 && (
                        <tr className="bg-gray-50/70 dark:bg-gray-950/30">
                          <td colSpan={6} className="px-4 py-3">
                            <ul className="grid sm:grid-cols-3 gap-3 text-xs">
                              {detalle.map((d) => (
                                <li key={d.moneda} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 tabular-nums">
                                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{NOMBRE_MONEDA[d.moneda]}</p>
                                  <p className="text-gray-500 dark:text-gray-400">Esperado {formatearMoneda(d.esperado, d.moneda)}</p>
                                  <p className="text-gray-500 dark:text-gray-400">Contado {formatearMoneda(d.contado, d.moneda)}</p>
                                  <p className={d.diferencia === 0 ? "text-emerald-600" : "text-red-500"}>
                                    {d.diferencia === 0 ? "Cuadra" : `${d.diferencia > 0 ? "Sobra" : "Falta"} ${formatearMoneda(Math.abs(d.diferencia), d.moneda)}`}
                                  </p>
                                </li>
                              ))}
                            </ul>
                            {s.observacionCierre && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Nota: {s.observacionCierre}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ImprimirCierreCaja open={imprimirId !== null} onClose={() => setImprimirId(null)} sesionId={imprimirId} />

      {movTipo && (
        <Modal open onClose={() => setMovTipo(null)} maxWidth="max-w-sm">
          <ModalEncabezado
            icono={movTipo === "INGRESO" ? <FaPlus /> : <FaMinus />}
            titulo={movTipo === "INGRESO" ? "Registrar ingreso" : "Registrar egreso"}
            subtitulo={movTipo === "INGRESO" ? "Dinero que entra a la caja fuera de las ventas" : "Dinero que sale de la caja"}
            onClose={() => setMovTipo(null)}
          />
          <form
            id="mov-caja-form"
            onSubmit={(e) => {
              e.preventDefault();
              guardarMovimiento();
            }}
            className="px-6 py-5 space-y-4"
          >
            <Campo etiqueta="Monto">
              <div className="flex items-center gap-3">
                <Selector valor={movMoneda} opciones={monedasConTasa} onChange={setMovMoneda} />
                <CampoMonto moneda={movMoneda} value={movMonto} onValue={setMovMonto} className={`${inputCls} text-right tabular-nums`} placeholder="0.00" autoFocus />
              </div>
            </Campo>
            <Campo etiqueta="Concepto">
              <input type="text" value={movConcepto} onChange={(e) => setMovConcepto(e.target.value)} className={inputCls} placeholder="Ej. compra de bolsas" />
            </Campo>
          </form>
          <ModalPie>
            <Button variant="secondary" onClick={() => setMovTipo(null)} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" form="mov-caja-form" variant="primary" isLoading={enviando}>
              Guardar
            </Button>
          </ModalPie>
        </Modal>
      )}

      {cerrando && caja.abierta && (
        <Modal open onClose={() => setCerrando(false)} maxWidth="max-w-lg" className="max-h-[92vh] flex flex-col overflow-hidden">
          <ModalEncabezado icono={<FaLock />} titulo="Cerrar caja" subtitulo="Cuenta el efectivo de cada moneda; te mostramos si cuadra" onClose={() => setCerrando(false)} />
          <div className="px-6 py-5 flex-1 overflow-y-auto space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {filasArqueo.map((f, i) => {
                const txt = contado[f.moneda] ?? "";
                const n = txt ? parsearMonto(txt, f.moneda) : null;
                const dif = n === null ? null : Math.round((n - f.esperado) * 100) / 100;
                return (
                  <div key={f.moneda} className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{NOMBRE_MONEDA[f.moneda]}</span>
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">Esperado {formatearMoneda(f.esperado, f.moneda)}</span>
                    </div>
                    <CampoMonto
                      moneda={f.moneda}
                      value={txt}
                      onValue={(t) => setContado((c) => ({ ...c, [f.moneda]: t }))}
                      className={`${inputCls} text-right tabular-nums`}
                      placeholder={`Contado en ${f.moneda}`}
                      autoFocus={i === 0}
                    />
                    {dif !== null && (
                      <p className={`text-xs font-semibold ${dif === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {dif === 0 ? "Cuadra exacto." : `${dif > 0 ? "Sobra" : "Falta"} ${formatearMoneda(Math.abs(dif), f.moneda)}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {hayConteo && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total contado en {principal}: <strong className="text-gray-900 dark:text-gray-100 tabular-nums">{fmt(totalContadoPrincipal)}</strong> (esperado {fmt(caja.efectivoEsperado)})
              </p>
            )}
            <Campo etiqueta="Observación" opcional>
              <input type="text" value={observacion} onChange={(e) => setObservacion(e.target.value)} className={inputCls} />
            </Campo>
          </div>
          <ModalPie>
            <Button variant="secondary" onClick={() => setCerrando(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={cerrar} isLoading={enviando}>
              Cerrar caja
            </Button>
          </ModalPie>
        </Modal>
      )}
    </div>
  );
}
