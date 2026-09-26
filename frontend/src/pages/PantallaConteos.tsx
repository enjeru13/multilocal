import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaClipboardCheck, FaPlay, FaPlus } from "react-icons/fa";
import type { Categoria, ConteoInventario } from "@lavanderia/shared/types/types";
import { conteosService } from "../services/conteosService";
import { categoriasService } from "../services/categoriasService";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Campo, campo, ModalEncabezado, ModalPie } from "../components/ui/Formulario";
import TarjetaRegistro from "../components/ui/TarjetaRegistro";
import { TableSkeleton } from "../components/Skeleton";
import { nombreConteo } from "../utils/conteoHelpers";

const ESTADOS = {
  ABIERTO: { label: "En curso", clases: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
  APLICADO: { label: "Aplicado", clases: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  CANCELADO: { label: "Cancelado", clases: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
} as const;

function Estado({ estado }: { estado: ConteoInventario["estado"] }) {
  const e = ESTADOS[estado];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${e.clases}`}>{e.label}</span>;
}

/** Lista de tomas de inventario y el arranque de una nueva. */
export default function PantallaConteos() {
  const navigate = useNavigate();
  const [conteos, setConteos] = useState<ConteoInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [creando, setCreando] = useState(false);

  const abierto = conteos.find((c) => c.estado === "ABIERTO");

  useEffect(() => {
    conteosService
      .getAll()
      .then((r) => setConteos(r.data))
      .catch(() => toast.error("No se pudieron cargar los conteos."))
      .finally(() => setCargando(false));
    categoriasService.getAll().then((r) => setCategorias(Array.isArray(r) ? r : [])).catch(() => undefined);
  }, []);

  const empezar = async () => {
    setCreando(true);
    try {
      const res = await conteosService.crear({ nombre: nombre.trim() || undefined, categoriaId: categoriaId || null });
      navigate(`/conteos/${res.data.id}`);
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo empezar el conteo." : "No se pudo empezar el conteo.");
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FaClipboardCheck className="text-blue-600 dark:text-blue-400" /> Conteo físico
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Cuenta lo que hay en los estantes y ajusta las existencias del sistema con un solo botón.</p>
        </div>
        {!abierto && (
          <Button variant="primary" leftIcon={<FaPlus />} onClick={() => setNuevo(true)}>
            Empezar un conteo
          </Button>
        )}
      </header>

      {abierto && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-sky-900 dark:text-sky-200">
            Hay un conteo en curso: <strong>{nombreConteo(abierto)}</strong> · {abierto._count?.detalles ?? 0} producto(s) contados.
          </p>
          <Link to={`/conteos/${abierto.id}`}>
            <Button variant="primary" size="sm" leftIcon={<FaPlay />}>
              Seguir contando
            </Button>
          </Link>
        </div>
      )}

      {cargando ? (
        <TableSkeleton rows={4} cols={4} />
      ) : conteos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 py-14 px-6 text-center space-y-2">
          <FaClipboardCheck className="mx-auto text-3xl text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-700 dark:text-gray-300">Aún no has hecho ningún conteo.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">Escanea o busca cada producto, anota cuántos hay y el sistema te muestra las diferencias antes de ajustar nada.</p>
        </div>
      ) : (
        <>
          <ul className="md:hidden space-y-3">
            {conteos.map((c) => (
              <TarjetaRegistro
                key={c.id}
                titulo={nombreConteo(c)}
                subtitulo={dayjs(c.creadoEn).format("DD/MM/YYYY HH:mm")}
                chips={<Estado estado={c.estado} />}
                datos={[
                  { k: "Contados", v: c._count?.detalles ?? 0 },
                  { k: "Por", v: c.userName ?? "—" },
                ]}
                onClick={() => navigate(`/conteos/${c.id}`)}
              />
            ))}
          </ul>
          <div className="max-md:hidden overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Conteo</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Productos contados</th>
                  <th className="px-4 py-3 text-left font-semibold">Hecho por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {conteos.map((c) => (
                  <tr key={c.id} onClick={() => navigate(`/conteos/${c.id}`)} className="hover:bg-blue-50/60 dark:hover:bg-blue-900/10 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{nombreConteo(c)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{dayjs(c.creadoEn).format("DD/MM/YYYY HH:mm")}</td>
                    <td className="px-4 py-3">
                      <Estado estado={c.estado} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c._count?.detalles ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.userName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {nuevo && (
        <Modal open onClose={() => !creando && setNuevo(false)} maxWidth="max-w-md">
          <ModalEncabezado icono={<FaClipboardCheck />} titulo="Empezar un conteo" subtitulo="Nada cambia en el sistema hasta que lo apliques." onClose={() => setNuevo(false)} />
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <Campo etiqueta="Nombre" opcional ayuda="Para reconocerlo después, por ejemplo «Cierre de septiembre».">
              <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoFocus />
            </Campo>
            <Campo etiqueta="¿Qué vas a contar?" ayuda="Todo el inventario, o solo una categoría (por ejemplo un pasillo).">
              <select className={campo} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">Todo el inventario</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <p className="text-xs text-gray-500 dark:text-gray-400">Lo ideal es contar con el negocio cerrado o con pocas ventas: al aplicar se compara con las existencias que haya en ese momento.</p>
          </div>
          <ModalPie>
            <Button variant="secondary" onClick={() => setNuevo(false)} disabled={creando}>
              Cancelar
            </Button>
            <Button variant="primary" leftIcon={<FaPlay />} onClick={empezar} isLoading={creando} disabled={creando}>
              Empezar
            </Button>
          </ModalPie>
        </Modal>
      )}
    </div>
  );
}
