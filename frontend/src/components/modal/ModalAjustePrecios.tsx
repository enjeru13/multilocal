import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { FaPercent } from "react-icons/fa";
import type { Categoria } from "@lavanderia/shared/types/types";
import { servicioService } from "../../services/serviciosService";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import { useEtiquetas } from "../../context/configuracionCore";
import Modal from "../ui/Modal";
import { Campo, ModalEncabezado, ModalPie, campo } from "../ui/Formulario";
import Button from "../ui/Button";

interface Props {
  categorias: Categoria[];
  monedaPrincipal: Moneda;
  onClose: () => void;
  onAplicado: () => void;
}

type Vista = { cantidad: number; ejemplos: { id: number; nombre: string; antes: number; despues: number }[] };

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
    <Modal open onClose={onClose} maxWidth="max-w-lg" className="max-h-[92dvh] flex flex-col overflow-hidden">
      <ModalEncabezado icono={<FaPercent />} titulo="Ajustar precios" subtitulo="Sube o baja varios precios de una vez" onClose={onClose} />

      <div className="px-4 sm:px-6 py-5 flex-1 overflow-y-auto space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Cambio (%)" ayuda="10 sube un 10%; -5 baja un 5%.">
            <input type="text" inputMode="decimal" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className={`${campo} text-right tabular-nums`} autoFocus />
          </Campo>
          <Campo etiqueta="Aplicar a">
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={campo}>
              <option value="">Todos los {et.serviciosMin}</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  Categoría: {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Redondeo" className="sm:col-span-2">
            <select value={redondeo} onChange={(e) => setRedondeo(e.target.value as typeof redondeo)} className={campo}>
              <option value="CENTAVOS">Centavos (2 decimales)</option>
              <option value="MEDIO">Al 0.50 más cercano</option>
              <option value="ENTERO">Al entero más cercano</option>
            </select>
          </Campo>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 p-4 text-sm min-h-24">
          {!valido && <p className="text-gray-500 dark:text-gray-400">Escribe un porcentaje entre -90 y 500 (distinto de 0).</p>}
          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
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

        <p className="text-xs text-gray-500 dark:text-gray-400">Las ventas ya registradas no cambian: cada una conserva el precio con que se hizo.</p>
      </div>

      <ModalPie>
        <Button variant="secondary" onClick={onClose} disabled={aplicando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={aplicar} isLoading={aplicando} disabled={!valido || !vista || vista.cantidad === 0}>
          Aplicar cambio
        </Button>
      </ModalPie>
    </Modal>
  );
}
