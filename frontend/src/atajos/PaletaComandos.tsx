import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import Modal from "../components/ui/Modal";
import Kbd from "./Kbd";
import { useAtajosContext } from "./atajosCore";
import { useNavegacion } from "../experiencia/navegacion";

interface Comando {
  clave: string;
  titulo: string;
  detalle?: string;
  grupo: string;
  combo?: string;
  icono?: React.ReactNode;
  ejecutar: () => void;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Buscador de comandos (Ctrl+K): ir a cualquier pantalla o ejecutar las acciones de la actual. */
export default function PaletaComandos() {
  const { abrirPaleta, lista } = useAtajosContext();
  const { todos } = useNavegacion();
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  const comandos = useMemo<Comando[]>(() => {
    const acciones: Comando[] = lista()
      .filter((a) => !a.oculto && a.grupo !== "Ir a" && a.grupo !== "General")
      .map((a) => ({
        clave: `acc-${a.combo}`,
        titulo: a.descripcion,
        grupo: a.grupo ?? "Esta pantalla",
        combo: a.combo,
        ejecutar: a.accion,
      }));
    const navs: Comando[] = todos.map((n) => ({
      clave: `nav-${n.id}`,
      titulo: `Ir a ${n.label}`,
      detalle: n.descripcion,
      grupo: "Ir a",
      combo: n.atajo,
      icono: n.icon,
      ejecutar: () => navigate(n.to),
    }));
    return [...acciones, ...navs];
  }, [lista, todos, navigate]);

  const filtrados = useMemo(() => {
    const q = sinTildes(texto.trim());
    if (!q) return comandos;
    return comandos.filter((c) => sinTildes(`${c.titulo} ${c.detalle ?? ""} ${c.grupo}`).includes(q));
  }, [comandos, texto]);

  useEffect(() => {
    setIndice(0);
  }, [texto]);

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-i="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  const cerrar = () => abrirPaleta(false);
  const ejecutar = (c: Comando | undefined) => {
    if (!c) return;
    cerrar();
    // Después de cerrar, para que la acción no compita con el foco del modal.
    setTimeout(c.ejecutar, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      ejecutar(filtrados[indice]);
    }
  };

  let grupoActual = "";

  return (
    <Modal open onClose={cerrar} maxWidth="max-w-xl" className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <FaSearch className="text-gray-400" />
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe una pantalla o acción…"
          className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          aria-label="Buscar comando"
        />
        <Kbd combo="Esc" className="text-gray-400" />
      </div>
      <ul ref={listaRef} className="max-h-[50dvh] overflow-y-auto py-2">
        {filtrados.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Nada coincide con "{texto}".</li>}
        {filtrados.map((c, i) => {
          const encabezado = c.grupo !== grupoActual;
          grupoActual = c.grupo;
          return (
            <li key={c.clave}>
              {encabezado && <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">{c.grupo}</p>}
              <button
                type="button"
                data-i={i}
                onMouseEnter={() => setIndice(i)}
                onClick={() => ejecutar(c)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm cursor-pointer ${
                  i === indice ? "bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200" : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <span className="w-5 text-gray-400 shrink-0">{c.icono}</span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium">{c.titulo}</span>
                  {c.detalle && <span className="ml-2 text-xs text-gray-400">{c.detalle}</span>}
                </span>
                {c.combo && <Kbd combo={c.combo} className="text-gray-400 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
