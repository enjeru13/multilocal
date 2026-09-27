import { useSyncExternalStore } from "react";

/**
 * Preferencias de papel de ESTE equipo. Cada computadora tiene su propia impresora,
 * así que se guardan en el navegador y no en la base de datos del negocio.
 */
export type Hoja = "CARTA" | "A4" | "OFICIO";
export type Formato = "hoja" | "ticket";

export interface PreferenciasImpresion {
  hoja: Hoja;
  /** Ancho del rollo de la impresora térmica, en milímetros (58, 80 u otro). */
  ticketMm: number;
  /** Último formato elegido en la vista previa. */
  formato: Formato;
  /** Versión de escritorio: impresora donde salen los tickets (nombre en Windows; vacío = sin elegir). */
  impresoraTicket: string;
  /** Versión de escritorio: mandar el ticket a esa impresora sin abrir el diálogo de impresión. */
  directa: boolean;
}

export const HOJAS: Record<Hoja, { etiqueta: string; css: string; ancho: number; alto: number }> = {
  CARTA: { etiqueta: "Carta", css: "letter", ancho: 216, alto: 279 },
  A4: { etiqueta: "A4", css: "A4", ancho: 210, alto: 297 },
  OFICIO: { etiqueta: "Oficio", css: "legal", ancho: 216, alto: 356 },
};

/** Rollos habituales; "otro" permite cualquier ancho entre TICKET_MIN y TICKET_MAX. */
export const ROLLOS = [58, 80] as const;
export const TICKET_MIN = 40;
export const TICKET_MAX = 120;

const CLAVE = "mostrador.impresion";
const PREDETERMINADAS: PreferenciasImpresion = { hoja: "CARTA", ticketMm: 80, formato: "hoja", impresoraTicket: "", directa: false };

const limitarTicket = (mm: number) => Math.min(TICKET_MAX, Math.max(TICKET_MIN, Math.round(mm)));

function leer(): PreferenciasImpresion {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return PREDETERMINADAS;
    const p = JSON.parse(crudo) as Partial<PreferenciasImpresion>;
    return {
      hoja: p.hoja && p.hoja in HOJAS ? p.hoja : PREDETERMINADAS.hoja,
      ticketMm: typeof p.ticketMm === "number" ? limitarTicket(p.ticketMm) : PREDETERMINADAS.ticketMm,
      formato: p.formato === "ticket" ? "ticket" : "hoja",
      impresoraTicket: typeof p.impresoraTicket === "string" ? p.impresoraTicket : "",
      directa: p.directa === true,
    };
  } catch {
    return PREDETERMINADAS;
  }
}

let actual = leer();
const oyentes = new Set<() => void>();

export function guardarPreferencias(cambios: Partial<PreferenciasImpresion>) {
  actual = { ...actual, ...cambios, ticketMm: limitarTicket(cambios.ticketMm ?? actual.ticketMm) };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
  oyentes.forEach((o) => o());
}

export function usePreferenciasImpresion() {
  const prefs = useSyncExternalStore(
    (cb) => {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    () => actual,
    () => PREDETERMINADAS
  );
  return [prefs, guardarPreferencias] as const;
}

/**
 * Zona realmente imprimible del rollo: las térmicas dejan ~5 mm sin imprimir en cada lado
 * (un rollo de 58 mm imprime unos 48 mm y uno de 80 mm unos 72 mm).
 */
export function anchoUtilTicket(ticketMm: number) {
  return Math.max(30, ticketMm <= 60 ? ticketMm - 10 : ticketMm - 8);
}

/** Tamaño base de letra del ticket según el ancho: más angosto, más pequeño. */
export function letraTicket(ticketMm: number) {
  if (ticketMm <= 60) return 10;
  if (ticketMm <= 82) return 11.5;
  return 13;
}

export const MM_A_PX = 96 / 25.4;
