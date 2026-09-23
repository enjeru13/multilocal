import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaPercent } from "react-icons/fa";
import type { Categoria } from "@lavanderia/shared/types/types";
import { servicioService } from "../../services/serviciosService";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import { useEtiquetas } from "../../context/configuracionCore";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

interface Props {
  categorias: Categoria[];
  monedaPrincipal: Moneda;
  onClose: () => void;
  onAplicado: () => void;
}

type Vista = { cantidad: number; ejemplos: { id: number; nombre: string; antes: number; despues: number }[] };

const campo =
  "px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm";

export default function ModalAjustePrecios({ categorias, monedaPrincipal, onClose, onAplicado }: Props) {
  const et = useEtiquetas();
  const [porcentaje, setPorcentaje] = useState("10");
  const [categoriaId, setCategoriaId] = useState("");
  const [redondeo, setRedondeo] = useState<"CENTAVOS" | "ENTERO" | "MEDIO">("CENTAVOS");
  const [vista, setVista] = useState<Vista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const pct = parseFloat(porcentaje.replace(",", "."));
  const valido = !isNaN(pct) && pct !== 0 && pct >= -90 && pct <= 500;

  // Vista previa en vivo: nada se guarda hasta confirmar.
  useEffect(() => {
    if (!valido) {
      setVista(null);
      return;
    }
    let vigente = true;
    const t = setTimeout(() => {
      servicioService
        .ajustarPrecios({ porcentaje: pct, categoriaId: categoriaId || null, redondeo, simular: true })
        .then((r) => {
          if (vigente) {
            setVista(r.data);
            setError(null);
          }
        })
        .catch((err) => {
          if (vigente) setError(isAxiosError(err) ? err.response?.data?.message ?? "No se pudo calcular." : "No se pudo calcular.");
        });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [pct, valido, categoriaId, redondeo]);

  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = await servicioService.ajustarPrecios({ porcentaje: pct, categoriaId: categoriaId || null, redondeo, simular: false });
      toast.success(`${r.data.cantidad} precios actualizados.`);
      onAplicado();
      onClose();
    } catch (err) {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "No se pudieron actualizar los precios." : "No se pudieron actualizar los precios.");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="p-6 space-y-5">
      <h2 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
        <FaPercent size={22} /> Ajustar precios
      </h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Cambio (%)</label>
          <input
            type="text"
            inputMode="decimal"
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
            className={`${campo} w-full`}
            placeholder="10 para subir, -5 para bajar"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Aplicar a</label>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={`${campo} w-full`}>
            <option value="">Todos los {et.serviciosMin}</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                Categoría: {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Redondeo</label>
          <select value={redondeo} onChange={(e) => setRedondeo(e.target.value as typeof redondeo)} className={`${campo} w-full`}>
            <option value="CENTAVOS">Centavos (2 decimales)</option>
            <option value="MEDIO">Al 0.50 más cercano</option>
            <option value="ENTERO">Al entero más cercano</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4 text-sm min-h-24">
        {!valido && <p className="text-gray-500 dark:text-gray-400">Escribe un porcentaje entre -90 y 500 (distinto de 0).</p>}
        {error && <p className="text-red-600">{error}</p>}
        {valido && vista && (
          <>
            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              {vista.cantidad === 0 ? "Ningún precio cambiaría." : `${vista.cantidad} precio(s) cambiarían. Ejemplos:`}
            </p>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              {vista.ejemplos.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="truncate">{e.nombre}</span>
                  <span className="tabular-nums shrink-0">
                    {formatearMoneda(e.antes, monedaPrincipal)} → <strong className="text-gray-900 dark:text-gray-100">{formatearMoneda(e.despues, monedaPrincipal)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Las ventas ya registradas no cambian: cada una conserva el precio con que se hizo.
      </p>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={aplicando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={aplicar} isLoading={aplicando} disabled={!valido || !vista || vista.cantidad === 0}>
          Aplicar cambio
        </Button>
      </div>
    </Modal>
  );
}
