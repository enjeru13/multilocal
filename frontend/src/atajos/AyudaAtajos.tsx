import { FaKeyboard } from "react-icons/fa";
import Modal from "../components/ui/Modal";
import { ModalEncabezado, ModalPie } from "../components/ui/Formulario";
import Kbd from "./Kbd";
import { useAtajosContext } from "./atajosCore";

/** Lista, agrupados, los atajos activos en la pantalla actual. */
export default function AyudaAtajos() {
  const { lista, abrirAyuda } = useAtajosContext();
  const visibles = lista().filter((a) => !a.oculto);

  const grupos = new Map<string, typeof visibles>();
  for (const a of visibles) {
    const g = a.grupo ?? "General";
    const arr = grupos.get(g) ?? [];
    if (!arr.some((x) => x.combo === a.combo)) arr.push(a);
    grupos.set(g, arr);
  }
  // La pantalla actual primero; "General"/"Ir a" al final.
  const orden = [...grupos.keys()].sort((a, b) => {
    const peso = (g: string) => (g === "General" ? 2 : g === "Ir a" ? 1 : 0);
    return peso(a) - peso(b);
  });

  return (
    <Modal open onClose={() => abrirAyuda(false)} maxWidth="max-w-2xl" className="max-h-[88vh] flex flex-col overflow-hidden">
      <ModalEncabezado icono={<FaKeyboard />} titulo="Atajos de teclado" subtitulo="Trabaja sin soltar el teclado" onClose={() => abrirAyuda(false)} />
      <div className="px-6 py-5 flex-1 overflow-y-auto space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 rounded-xl bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 px-4 py-3">
          Con <Kbd combo="Ctrl+K" /> abres el buscador de comandos desde cualquier pantalla.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          {orden.map((g) => (
            <section key={g}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{g}</h3>
              <ul className="space-y-1.5">
                {grupos.get(g)!.map((a) => (
                  <li key={a.combo} className="flex items-center justify-between gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <span>{a.descripcion}</span>
                    <Kbd combo={a.combo} className="text-gray-500 shrink-0" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <ModalPie izquierda="Pulsa ? para abrir esta ayuda">
        <button type="button" onClick={() => abrirAyuda(false)} className="h-9 px-4 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
          Cerrar
        </button>
      </ModalPie>
    </Modal>
  );
}
