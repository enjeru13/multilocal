/**
 * Puente con la versión de escritorio (Electron): impresión de tickets sin el diálogo de Windows.
 * En el navegador o en el teléfono no existe y todo sigue saliendo por el diálogo de siempre.
 */

export interface ImpresoraSistema {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface PuenteEscritorio {
  listarImpresoras: () => Promise<ImpresoraSistema[]>;
  imprimirTicket: (datos: { html: string; anchoMm: number; altoMm: number; impresora: string }) => Promise<{ ok: boolean; motivo?: string }>;
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

/** Todos los estilos de la página, para que el ticket se vea igual en la ventana de impresión. */
function estilosDeLaPagina(): string {
  let css = "";
  for (const hoja of Array.from(document.styleSheets)) {
    try {
      for (const regla of Array.from(hoja.cssRules)) css += `${regla.cssText}\n`;
    } catch {
      /* hoja de otro origen: no se puede leer */
    }
  }
  return css;
}

/** Documento HTML autónomo con el ticket y el tamaño de página exacto. */
export function documentoTicket(ticket: HTMLElement, anchoMm: number, altoMm: number): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${estilosDeLaPagina()}</style><style>@page{size:${anchoMm}mm ${altoMm}mm;margin:0}html,body{margin:0;padding:0;background:#fff}</style></head><body>${ticket.outerHTML}</body></html>`;
}

export async function imprimirTicketDirecto(ticket: HTMLElement, anchoMm: number, altoMm: number, impresora: string): Promise<{ ok: boolean; motivo?: string }> {
  if (!window.mostradorEscritorio) return { ok: false, motivo: "La impresión directa solo existe en la versión de escritorio." };
  return window.mostradorEscritorio.imprimirTicket({ html: documentoTicket(ticket, anchoMm, altoMm), anchoMm, altoMm, impresora });
}
