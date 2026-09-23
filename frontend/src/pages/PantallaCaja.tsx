import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import dayjs from "dayjs";
import { FaCashRegister, FaLockOpen, FaLock, FaPlus, FaMinus } from "react-icons/fa";
import { cajaService, type CajaActual, type CajaSesion } from "../services/cajaService";
import { useConfiguracion } from "../context/configuracionCore";
import { useAuth } from "../hooks/useAuth";
import { formatearMoneda } from "../utils/monedaHelpers";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";

const inputCls =
  "w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100";

function Fila({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span
        className={
          destacado
            ? "font-bold text-lg text-gray-900 dark:text-gray-100"
            : "font-semibold text-gray-800 dark:text-gray-200"
        }
      >
        {valor}
      </span>
    </div>
  );
}

function msgError(err: unknown, fallback: string) {
  return err instanceof AxiosError ? err.response?.data?.message ?? fallback : fallback;
}

export default function PantallaCaja() {
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const moneda = config?.monedaPrincipal ?? "USD";
  const fmt = (n: number) => formatearMoneda(n, moneda);

  const [caja, setCaja] = useState<CajaActual | null>(null);
  const [historial, setHistorial] = useState<CajaSesion[]>([]);
  const [montoInicial, setMontoInicial] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [movTipo, setMovTipo] = useState<"INGRESO" | "EGRESO" | null>(null);
  const [movMonto, setMovMonto] = useState("");
  const [movConcepto, setMovConcepto] = useState("");

  const [cerrando, setCerrando] = useState(false);
  const [contado, setContado] = useState("");
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
    const n = parseFloat(montoInicial.replace(",", "."));
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
    const n = parseFloat(movMonto.replace(",", "."));
    if (!movTipo || isNaN(n) || n <= 0 || !movConcepto.trim()) {
      return toast.error("Completa monto y concepto.");
    }
    setEnviando(true);
    try {
      await cajaService.movimiento({ tipo: movTipo, monto: n, moneda, concepto: movConcepto.trim() });
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

  const cerrar = async () => {
    const n = parseFloat(contado.replace(",", "."));
    if (isNaN(n) || n < 0) return toast.error("Indica el efectivo contado.");
    setEnviando(true);
    try {
      await cajaService.cerrar(n, observacion.trim() || undefined);
      toast.success("Caja cerrada.");
      setCerrando(false);
      setContado("");
      setObservacion("");
      cargar();
    } catch (err) {
      toast.error(msgError(err, "No se pudo cerrar la caja."));
    } finally {
      setEnviando(false);
    }
  };

  if (!caja) return <div className="p-6 text-gray-500">Cargando caja...</div>;

  const contadoNum = parseFloat(contado.replace(",", "."));
  const diferenciaPrevia =
    caja.abierta && !isNaN(contadoNum) ? contadoNum - caja.efectivoEsperado : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <FaCashRegister className="text-emerald-600" /> Caja
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Apertura, movimientos y cierre con arqueo del efectivo.
        </p>
      </div>

      {!caja.abierta ? (
        <section className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaLockOpen className="text-emerald-600" /> Abrir caja
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            La caja está cerrada. Para registrar pagos, ábrela indicando el efectivo con el que inicias.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Efectivo inicial ({moneda})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <Button onClick={abrir} variant="primary" isLoading={enviando}>
              Abrir caja
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex justify-between items-start flex-wrap gap-3 mb-2">
              <div>
                <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FaLockOpen className="text-emerald-600" /> Caja abierta
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Desde {dayjs(caja.sesion.fechaApertura).format("DD/MM/YYYY HH:mm")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setMovTipo("INGRESO")} variant="iconSuccess" size="sm" leftIcon={<FaPlus size={10} />}>
                  Ingreso
                </Button>
                <Button onClick={() => setMovTipo("EGRESO")} variant="iconWarning" size="sm" leftIcon={<FaMinus size={10} />}>
                  Egreso
                </Button>
                <Button onClick={() => setCerrando(true)} variant="danger" size="sm" leftIcon={<FaLock size={10} />}>
                  Cerrar caja
                </Button>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <Fila label="Efectivo inicial" valor={fmt(caja.montoInicial)} />
              <Fila label={`Pagos en efectivo (${caja.cantidadPagos} pagos en total)`} valor={fmt(caja.efectivoPagos)} />
              <Fila label="Otros métodos (transferencia, pago móvil)" valor={fmt(caja.otrosMetodos)} />
              <Fila label="Ingresos manuales" valor={fmt(caja.ingresos)} />
              <Fila label="Egresos manuales" valor={`- ${fmt(caja.egresos)}`} />
              <Fila label="Efectivo esperado en caja" valor={fmt(caja.efectivoEsperado)} destacado />
            </div>

            {caja.sesion.movimientos && caja.sesion.movimientos.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Movimientos manuales</p>
                {caja.sesion.movimientos.map((m) => (
                  <div key={m.id} className="flex justify-between text-sm py-1">
                    <span className="text-gray-700 dark:text-gray-300">{m.concepto}</span>
                    <span className={m.tipo === "INGRESO" ? "text-emerald-600" : "text-red-500"}>
                      {m.tipo === "INGRESO" ? "+" : "-"} {formatearMoneda(m.monto, m.moneda)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {hasRole(["ADMIN"]) && historial.length > 0 && (
        <section>
          <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-3">Historial de cierres</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-full bg-white dark:bg-gray-900 text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 text-left">Apertura</th>
                  <th className="px-4 py-2 text-left">Cierre</th>
                  <th className="px-4 py-2 text-right">Esperado</th>
                  <th className="px-4 py-2 text-right">Contado</th>
                  <th className="px-4 py-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {dayjs(s.fechaApertura).format("DD/MM/YY HH:mm")}
                    </td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {s.fechaCierre ? dayjs(s.fechaCierre).format("DD/MM/YY HH:mm") : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">{fmt(s.montoFinalSistema ?? 0)}</td>
                    <td className="px-4 py-2 text-right">{fmt(s.montoFinalContado ?? 0)}</td>
                    <td
                      className={`px-4 py-2 text-right font-semibold ${
                        (s.diferencia ?? 0) === 0
                          ? "text-emerald-600"
                          : "text-red-500"
                      }`}
                    >
                      {fmt(s.diferencia ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {movTipo && (
        <Modal open onClose={() => setMovTipo(null)} maxWidth="max-w-sm" className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {movTipo === "INGRESO" ? "Registrar ingreso" : "Registrar egreso"}
          </h3>
          <input
            type="text"
            inputMode="decimal"
            value={movMonto}
            onChange={(e) => setMovMonto(e.target.value)}
            className={inputCls}
            placeholder={`Monto (${moneda})`}
            autoFocus
          />
          <input
            type="text"
            value={movConcepto}
            onChange={(e) => setMovConcepto(e.target.value)}
            className={inputCls}
            placeholder="Concepto (ej. compra de bolsas)"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMovTipo(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarMovimiento} isLoading={enviando}>
              Guardar
            </Button>
          </div>
        </Modal>
      )}

      {cerrando && caja.abierta && (
        <Modal open onClose={() => setCerrando(false)} maxWidth="max-w-sm" className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Cerrar caja</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            El sistema espera <strong>{fmt(caja.efectivoEsperado)}</strong> en efectivo. Cuenta lo que hay y anótalo.
          </p>
          <input
            type="text"
            inputMode="decimal"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            className={inputCls}
            placeholder={`Efectivo contado (${moneda})`}
            autoFocus
          />
          {diferenciaPrevia !== null && (
            <p
              className={`text-sm font-semibold ${
                diferenciaPrevia === 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {diferenciaPrevia === 0
                ? "Cuadra exacto."
                : `Diferencia: ${fmt(diferenciaPrevia)} (${diferenciaPrevia > 0 ? "sobrante" : "faltante"})`}
            </p>
          )}
          <input
            type="text"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className={inputCls}
            placeholder="Observación (opcional)"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCerrando(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={cerrar} isLoading={enviando}>
              Cerrar caja
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
