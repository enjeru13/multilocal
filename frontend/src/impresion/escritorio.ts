/**
 * Puente con la versión de escritorio (Electron): impresión de tickets sin el diálogo de Windows.
 * En el navegador o en el teléfono no existe y todo sigue saliendo por el diálogo de siempre.
 */
import { columnasDelRollo, extraerLineasTicket, type LineaTicket } from "./escpos";

export interface ImpresoraSistema {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface PuenteEscritorio {
  listarImpresoras: () => Promise<ImpresoraSistema[]>;
  imprimirTicket: (datos: { lineas: LineaTicket[]; columnas: number; impresora: string }) => Promise<{ ok: boolean; motivo?: string }>;
}

declare global {
  interface Window {
    mostradorEscritorio?: PuenteEscritorio;
  }
}

export const hayImpresionDirecta = () => typeof window !== "undefined" && !!window.mostradorEscritorio;

export async function listarImpresoras(): Promise<ImpresoraSistema[]> {
  try {
    return (await window.mostradorEscritorio?.listarImpresoras()) ?? [];
  } catch {
    return [];
  }
}

/**
 * Manda el ticket a la impresora en crudo (ESC/POS), sin pasar por el diálogo de Windows ni por
 * el tamaño de página que Chromium le pide al driver (varios drivers de térmicas baratas lo
 * ignoran y sacan el ticket diminuto sobre una hoja larga). Se arma como texto plano a partir de
 * lo que ya está en pantalla, así que se ve igual a la vista previa salvo el formato de letra.
 */
export async function imprimirTicketDirecto(ticket: HTMLElement, ticketMm: number, impresora: string): Promise<{ ok: boolean; motivo?: string }> {
  if (!window.mostradorEscritorio) return { ok: false, motivo: "La impresión directa solo existe en la versión de escritorio." };
  const lineas = extraerLineasTicket(ticket);
  if (lineas.length === 0) return { ok: false, motivo: "El ticket no tiene contenido para imprimir." };
  return window.mostradorEscritorio.imprimirTicket({ lineas, columnas: columnasDelRollo(ticketMm), impresora });
}
