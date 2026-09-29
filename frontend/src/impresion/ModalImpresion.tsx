import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { useReactToPrint } from "react-to-print";
import { FaPrint } from "react-icons/fa";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { ModalEncabezado, ModalPie, Segmentado } from "../components/ui/Formulario";
import { toast } from "react-toastify";
import { SelectorHoja, SelectorRollo } from "./SelectorPapel";
import SelectorImpresora from "./SelectorImpresora";
import { hayImpresionDirecta, imprimirTicketDirecto } from "./escritorio";
import { HOJAS, MM_A_PX, usePreferenciasImpresion, type Formato } from "./preferencias";

interface Props {
  open: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo?: string;
  /** Nombre sugerido del archivo si se guarda como PDF. */
  documentTitle: string;
  /** Reporte en hoja. Recibe la ref que debe ir en el elemento imprimible. */
  hoja?: (ref: Ref<HTMLDivElement>) => ReactNode;
  /** Versión en ticket de impresora térmica. */
  ticket?: (ref: Ref<HTMLDivElement>) => ReactNode;
  /** Para tablas anchas: abre en horizontal. */
  horizontal?: boolean;
  /** Controles propios del reporte (moneda, exportar…), junto a los del papel. */
  controles?: ReactNode;
  /** Mientras se piden los datos del reporte. */
  cargando?: boolean;
  error?: string | null;
  /** Botones extra al lado de Imprimir (p. ej. «Enviar por correo»). */
  accionesExtra?: ReactNode;
}

const MARGEN_HOJA_MM = 14;

/**
 * Vista previa e impresión de cualquier reporte. Deja elegir hoja o ticket, el papel
 * (Carta/A4/Oficio, o el ancho del rollo térmico) y la orientación; recuerda la elección
 * de este equipo y le dice al diálogo de impresión el tamaño de papel exacto.
 */
export default function ModalImpresion({ open, onClose, titulo, subtitulo, documentTitle, hoja, ticket, horizontal: horizontalInicial = false, controles, cargando = false, error = null, accionesExtra }: Props) {
  const [prefs, guardar] = usePreferenciasImpresion();
  const formato: Formato = hoja && ticket ? prefs.formato : ticket ? "ticket" : "hoja";
  const [horizontal, setHorizontal] = useState(horizontalInicial);
  const [alturaMm, setAlturaMm] = useState(200);
  const [anchoVista, setAnchoVista] = useState(900);

  const printRef = useRef<HTMLDivElement>(null);
  const zonaRef = useRef<HTMLDivElement>(null);

  const papel = HOJAS[prefs.hoja];
  const anchoHojaMm = horizontal ? papel.alto : papel.ancho;
  const altoHojaMm = horizontal ? papel.ancho : papel.alto;

  // Mide el ticket para pedir al diálogo un papel de esa altura (los rollos no tienen fin fijo).
  useLayoutEffect(() => {
    if (!open || formato !== "ticket") return;
    const el = printRef.current;
    if (!el) return;
    const medir = () => setAlturaMm(Math.ceil((el.offsetHeight / MM_A_PX) + 2));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, formato, prefs.ticketMm, cargando]);

  useEffect(() => {
    const zona = zonaRef.current;
    if (!open || !zona) return;
    const ro = new ResizeObserver(() => setAnchoVista(zona.clientWidth));
    ro.observe(zona);
    setAnchoVista(zona.clientWidth);
    return () => ro.disconnect();
  }, [open]);

  const pageStyle = useMemo(() => {
    if (formato === "ticket") {
      return `@page { size: ${prefs.ticketMm}mm ${alturaMm}mm; margin: 0; } html, body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
    }
    return `@page { size: ${papel.css} ${horizontal ? "landscape" : "portrait"}; margin: ${MARGEN_HOJA_MM}mm ${MARGEN_HOJA_MM}mm 18mm; @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt sans-serif; color: #737373; } }
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .hoja-reporte { width: 100% !important; }`;
  }, [formato, prefs.ticketMm, alturaMm, papel.css, horizontal]);

  const imprimirConDialogo = useReactToPrint({ contentRef: printRef, documentTitle, pageStyle });

  // Ticket con impresión directa (versión de escritorio): sale sin diálogo. Si falla, se ofrece el diálogo de siempre.
  const [imprimiendo, setImprimiendo] = useState(false);
  const imprimir = async () => {
    const directa = formato === "ticket" && prefs.directa && !!prefs.impresoraTicket && hayImpresionDirecta();
    if (!directa || !printRef.current) return imprimirConDialogo();
    setImprimiendo(true);
    try {
      const r = await imprimirTicketDirecto(printRef.current, prefs.ticketMm, prefs.impresoraTicket);
      if (r.ok) toast.success("Enviado a la impresora.");
      else {
        toast.error(`No se pudo imprimir directo: ${r.motivo ?? "error desconocido"}. Se abre el diálogo de impresión.`);
        imprimirConDialogo();
      }
    } finally {
      setImprimiendo(false);
    }
  };

  const escala =
    formato === "hoja"
      ? Math.min(1, (anchoVista - 48) / (anchoHojaMm * MM_A_PX))
      : Math.min(1.4, Math.max(0.6, (anchoVista - 48) / (prefs.ticketMm * MM_A_PX)));

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-5xl" className="flex flex-col h-[92dvh] overflow-hidden print:hidden">
      <ModalEncabezado icono={<FaPrint />} titulo={titulo} subtitulo={subtitulo} onClose={onClose} />

      {/* Papel */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/30">
        {controles}
        {hoja && ticket && (
          <Segmentado
            ariaLabel="Formato de impresión"
            valor={formato}
            onChange={(f) => guardar({ formato: f })}
            opciones={[
              { id: "hoja", label: "Hoja" },
              { id: "ticket", label: "Ticket" },
            ]}
          />
        )}

        {formato === "hoja" ? (
          <>
            <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
              Papel
              <SelectorHoja />
            </label>
            <Segmentado
              ariaLabel="Orientación"
              valor={horizontal ? "h" : "v"}
              onChange={(o) => setHorizontal(o === "h")}
              opciones={[
                { id: "v", label: "Vertical" },
                { id: "h", label: "Horizontal" },
              ]}
            />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
              Rollo
              <SelectorRollo />
            </div>
            <SelectorImpresora />
          </>
        )}

        <p className="ml-auto text-xs text-gray-500 dark:text-gray-400 max-w-sm">
          {formato === "hoja" ? "En el diálogo de impresión elige la misma hoja. La vista previa es continua; el papel se corta en páginas." : "Se ajusta al ancho del rollo; en el diálogo elige tu impresora térmica."}
        </p>
      </div>

      {/* Vista previa */}
      <div ref={zonaRef} className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-950 p-6">
        {cargando || error ? (
          <p className="text-center text-sm py-20 text-gray-600 dark:text-gray-400">{error ?? "Preparando el reporte…"}</p>
        ) : (
        <div className="mx-auto" style={{ width: (formato === "hoja" ? anchoHojaMm : prefs.ticketMm) * MM_A_PX * escala }}>
          {formato === "hoja" ? (
            <div
              className="bg-white text-neutral-900 shadow-xl"
              style={{ width: anchoHojaMm * MM_A_PX, minHeight: altoHojaMm * MM_A_PX, padding: MARGEN_HOJA_MM * MM_A_PX, zoom: escala }}
            >
              {hoja?.(printRef)}
            </div>
          ) : (
            <div className="shadow-xl" style={{ zoom: escala }}>
              {ticket?.(printRef)}
            </div>
          )}
        </div>
        )}
      </div>

      <ModalPie izquierda={formato === "ticket" ? `Ticket de ${prefs.ticketMm} mm` : `${papel.etiqueta} ${horizontal ? "horizontal" : "vertical"}`}>
        <Button onClick={onClose} variant="secondary">
          Cerrar
        </Button>
        {accionesExtra}
        <Button onClick={() => void imprimir()} variant="primary" leftIcon={<FaPrint />} disabled={cargando || !!error || imprimiendo} isLoading={imprimiendo}>
          Imprimir
        </Button>
      </ModalPie>
    </Modal>
  );
}
