import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import dayjs from "dayjs";
import { FaDatabase, FaDownload, FaUndo, FaUpload, FaPlus, FaFileImport, FaExclamationTriangle } from "react-icons/fa";
import { respaldosService, type Respaldo, type ResumenLegado } from "../services/respaldosService";
import Button from "../components/ui/Button";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";
import Modal from "../components/ui/Modal";
import TarjetaRegistro from "../components/ui/TarjetaRegistro";
import { ModalEncabezado, ModalPie } from "../components/ui/Formulario";

const ETIQUETA: Record<Respaldo["tipo"], string> = {
  auto: "Automático",
  manual: "Manual",
  "previo-a-restauracion": "Previo a restaurar",
  otro: "Otro",
};

function tamano(bytes: number) {
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function msgError(err: unknown, fallback: string) {
  return err instanceof AxiosError ? err.response?.data?.message ?? fallback : fallback;
}

export default function PantallaRespaldos() {
  const [respaldos, setRespaldos] = useState<Respaldo[]>([]);
  const [trabajando, setTrabajando] = useState(false);
  const [aRestaurar, setARestaurar] = useState<string | File | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const inputLegado = useRef<HTMLInputElement>(null);
  const [legado, setLegado] = useState<{ archivo: File; resumen: ResumenLegado } | null>(null);

  // Primero se revisa el archivo (sin cambiar nada) y se muestra lo que trae.
  const revisarLegado = async (archivo: File) => {
    setTrabajando(true);
    try {
      const res = await respaldosService.revisarLegado(archivo);
      setLegado({ archivo, resumen: res.data.resumen });
    } catch (err) {
      toast.error(msgError(err, "No se pudo leer el archivo."));
    } finally {
      setTrabajando(false);
    }
  };

  const importarLegado = async () => {
    if (!legado) return;
    setTrabajando(true);
    try {
      await respaldosService.importarLegado(legado.archivo);
      toast.success("Datos importados. Entra con el usuario del sistema anterior.");
      localStorage.clear();
      setTimeout(() => (window.location.href = "/login"), 1400);
    } catch (err) {
      toast.error(msgError(err, "No se pudo importar."));
      setTrabajando(false);
    }
  };

  const cargar = useCallback(async () => {
    try {
      const res = await respaldosService.listar();
      setRespaldos(res.data);
    } catch (err) {
      toast.error(msgError(err, "No se pudieron cargar los respaldos."));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async () => {
    setTrabajando(true);
    try {
      await respaldosService.crear();
      toast.success("Respaldo creado.");
      cargar();
    } catch (err) {
      toast.error(msgError(err, "No se pudo crear el respaldo."));
    } finally {
      setTrabajando(false);
    }
  };

  const restaurar = async () => {
    if (!aRestaurar) return;
    setTrabajando(true);
    try {
      if (typeof aRestaurar === "string") await respaldosService.restaurar(aRestaurar);
      else await respaldosService.restaurarArchivo(aRestaurar);
      toast.success("Respaldo restaurado. Vuelve a iniciar sesión.");
      localStorage.clear();
      setTimeout(() => (window.location.href = "/login"), 1200);
    } catch (err) {
      toast.error(msgError(err, "No se pudo restaurar el respaldo."));
      setTrabajando(false);
      setARestaurar(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <FaDatabase className="text-indigo-500" /> Respaldos
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Copias de toda la información del sistema. Se crea una automática cada día al abrir el sistema (se
          conservan las últimas 14). Guarda copias manuales fuera de esta computadora.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={crear} variant="primary" isLoading={trabajando} leftIcon={<FaPlus size={12} />}>
          Crear respaldo ahora
        </Button>
        <Button onClick={() => inputArchivo.current?.click()} variant="secondary" leftIcon={<FaUpload size={12} />}>
          Restaurar desde un archivo…
        </Button>
        <Button onClick={() => inputLegado.current?.click()} variant="secondary" leftIcon={<FaFileImport size={12} />} isLoading={trabajando && !legado}>
          Importar del sistema anterior…
        </Button>
        <input
          ref={inputLegado}
          type="file"
          accept=".db"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) revisarLegado(f);
            e.target.value = "";
          }}
        />
        <input
          ref={inputArchivo}
          type="file"
          accept=".db"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setARestaurar(f);
            e.target.value = "";
          }}
        />
      </div>

      <ul className="md:hidden space-y-2.5">
        {respaldos.length === 0 && <li className="text-center text-sm text-gray-500 dark:text-gray-400 italic py-8">Aún no hay respaldos.</li>}
        {respaldos.map((r) => (
          <TarjetaRegistro
            key={r.nombre}
            titulo={dayjs(r.fecha).format("DD/MM/YYYY HH:mm")}
            subtitulo={`${ETIQUETA[r.tipo]} · ${tamano(r.tamano)}`}
            acciones={
              <>
                <Button onClick={() => respaldosService.descargar(r.nombre)} variant="secondary" size="sm" className="flex-1" leftIcon={<FaDownload size={11} />}>
                  Descargar
                </Button>
                <Button onClick={() => setARestaurar(r.nombre)} variant="iconWarning" size="icon" title="Restaurar este respaldo" aria-label="Restaurar">
                  <FaUndo size={12} />
                </Button>
              </>
            }
          />
        ))}
      </ul>

      <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        <table className="min-w-full bg-white dark:bg-gray-900 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-6 py-3 text-left">Fecha</th>
              <th className="px-6 py-3 text-left">Tipo</th>
              <th className="px-6 py-3 text-right">Tamaño</th>
              <th className="px-6 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {respaldos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                  Aún no hay respaldos.
                </td>
              </tr>
            )}
            {respaldos.map((r) => (
              <tr key={r.nombre} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-6 py-3 text-gray-800 dark:text-gray-100">
                  {dayjs(r.fecha).format("DD/MM/YYYY HH:mm")}
                </td>
                <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{ETIQUETA[r.tipo]}</td>
                <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400">{tamano(r.tamano)}</td>
                <td className="px-6 py-3 text-center">
                  <div className="inline-flex gap-2">
                    <Button onClick={() => respaldosService.descargar(r.nombre)} title="Descargar" variant="iconInfo" size="icon">
                      <FaDownload size={12} />
                    </Button>
                    <Button onClick={() => setARestaurar(r.nombre)} title="Restaurar este respaldo" variant="iconWarning" size="icon">
                      <FaUndo size={12} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {legado && (
        <Modal open onClose={() => !trabajando && setLegado(null)} maxWidth="max-w-lg">
          <ModalEncabezado icono={<FaFileImport />} titulo="Importar del sistema anterior" subtitulo={legado.resumen.negocio ?? legado.archivo.name} onClose={() => !trabajando && setLegado(null)} />
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">El archivo trae:</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {(
                [
                  ["Clientes", legado.resumen.clientes],
                  ["Servicios", legado.resumen.servicios],
                  ["Órdenes", legado.resumen.ordenes],
                  ["Pagos", legado.resumen.pagos],
                  ["Categorías", legado.resumen.categorias],
                  ["Usuarios", legado.resumen.usuarios],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-gray-100 dark:border-gray-800 py-1">
                  <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                  <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{v.toLocaleString("es")}</dd>
                </div>
              ))}
            </dl>
            {legado.resumen.abonadosCorregidos > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {legado.resumen.abonadosCorregidos} orden{legado.resumen.abonadosCorregidos === 1 ? "" : "es"} saldada{legado.resumen.abonadosCorregidos === 1 ? "" : "s"} traen el «abonado» mal guardado (mayor que el total); se ajusta al total. Los pagos no se tocan.
              </p>
            )}
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex gap-3 text-sm text-amber-900 dark:text-amber-200">
              <FaExclamationTriangle className="mt-0.5 shrink-0" />
              <p>
                Esto <strong>reemplaza toda la información actual</strong> (usuarios incluidos). Antes se guarda una copia de lo que hay ahora, y al terminar tendrás que entrar con el usuario y la contraseña del sistema anterior.
              </p>
            </div>
          </div>
          <ModalPie>
            <Button variant="secondary" onClick={() => setLegado(null)} disabled={trabajando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={importarLegado} isLoading={trabajando}>
              Importar y reemplazar
            </Button>
          </ModalPie>
        </Modal>
      )}

      {aRestaurar && (
        <ConfirmacionModal
          titulo="Restaurar respaldo"
          textoConfirmar={trabajando ? "Restaurando..." : "Restaurar"}
          mensaje="Se reemplazará TODA la información actual por la del respaldo. Antes se guarda automáticamente una copia del estado actual, y tendrás que volver a iniciar sesión. ¿Continuar?"
          onConfirm={restaurar}
          onCancel={() => setARestaurar(null)}
        />
      )}
    </div>
  );
}
