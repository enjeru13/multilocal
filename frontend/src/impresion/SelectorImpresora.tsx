import { useEffect, useState } from "react";
import { campo } from "../components/ui/Formulario";
import { hayImpresionDirecta, listarImpresoras, type ImpresoraSistema } from "./escritorio";
import { usePreferenciasImpresion } from "./preferencias";

/**
 * Impresora de tickets de este equipo y la opción de imprimir sin abrir el diálogo de Windows.
 * Solo aparece en la versión de escritorio.
 */
export default function SelectorImpresora() {
  const [prefs, guardar] = usePreferenciasImpresion();
  const [impresoras, setImpresoras] = useState<ImpresoraSistema[]>([]);
  const disponible = hayImpresionDirecta();

  useEffect(() => {
    if (disponible) void listarImpresoras().then(setImpresoras);
  }, [disponible]);

  // La primera vez, propone la impresora predeterminada de Windows.
  useEffect(() => {
    if (!prefs.impresoraTicket && impresoras.length > 0) {
      const porDefecto = impresoras.find((i) => i.isDefault) ?? impresoras[0];
      guardar({ impresoraTicket: porDefecto.name });
    }
  }, [impresoras, prefs.impresoraTicket, guardar]);

  if (!disponible) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-gray-600 dark:text-gray-400">
      <label className="flex items-center gap-2">
        Impresora
        <select
          value={prefs.impresoraTicket}
          onChange={(e) => guardar({ impresoraTicket: e.target.value })}
          className={`${campo} w-auto! h-8! py-0 pr-8 max-w-56`}
          aria-label="Impresora de tickets"
        >
          {impresoras.length === 0 && <option value="">No se encontraron impresoras</option>}
          {impresoras.map((i) => (
            <option key={i.name} value={i.name}>
              {i.displayName}
              {i.isDefault ? " (predeterminada)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={prefs.directa} onChange={(e) => guardar({ directa: e.target.checked })} className="accent-blue-600 w-4 h-4 cursor-pointer" disabled={!prefs.impresoraTicket} />
        Imprimir sin diálogo
      </label>
    </div>
  );
}
