import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import dayjs from "dayjs";
import { FaDatabase, FaDownload, FaUndo, FaUpload, FaPlus } from "react-icons/fa";
import { respaldosService, type Respaldo } from "../services/respaldosService";
import Button from "../components/ui/Button";
import ConfirmacionModal from "../components/modal/ConfirmacionModal";

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
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
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

      <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
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
