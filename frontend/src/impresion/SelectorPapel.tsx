import { useState } from "react";
import { Segmentado, campo } from "../components/ui/Formulario";
import { HOJAS, ROLLOS, TICKET_MAX, TICKET_MIN, usePreferenciasImpresion, type Hoja } from "./preferencias";

/** Tamaño de hoja de este equipo (Carta, A4, Oficio). */
export function SelectorHoja() {
  const [prefs, guardar] = usePreferenciasImpresion();
  return (
    <select value={prefs.hoja} onChange={(e) => guardar({ hoja: e.target.value as Hoja })} className={`${campo} w-auto! h-8! py-0 pr-8`} aria-label="Tamaño de papel">
      {(Object.keys(HOJAS) as Hoja[]).map((h) => (
        <option key={h} value={h}>
          {HOJAS[h].etiqueta} ({HOJAS[h].ancho}×{HOJAS[h].alto} mm)
        </option>
      ))}
    </select>
  );
}

/** Ancho del rollo de la impresora térmica de este equipo: 58 mm, 80 mm u otro. */
export function SelectorRollo() {
  const [prefs, guardar] = usePreferenciasImpresion();
  const [otro, setOtro] = useState(!(ROLLOS as readonly number[]).includes(prefs.ticketMm));
  return (
    <span className="inline-flex items-center gap-2">
      <Segmentado
        ariaLabel="Ancho del rollo"
        valor={otro ? "otro" : String(prefs.ticketMm)}
        onChange={(v) => {
          if (v === "otro") setOtro(true);
          else {
            setOtro(false);
            guardar({ ticketMm: Number(v) });
          }
        }}
        opciones={[...ROLLOS.map((r) => ({ id: String(r), label: `${r} mm` })), { id: "otro", label: "Otro" }]}
      />
      {otro && (
        <span className="flex items-center gap-1.5">
          <input
            type="number"
            min={TICKET_MIN}
            max={TICKET_MAX}
            value={prefs.ticketMm}
            onChange={(e) => guardar({ ticketMm: Number(e.target.value) || prefs.ticketMm })}
            className={`${campo} w-20! h-8! text-right`}
            aria-label="Ancho del rollo en milímetros"
          />
          mm
        </span>
      )}
    </span>
  );
}
