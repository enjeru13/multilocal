/**
 * Convierte un ticket ya renderizado (los bloques de Ticket.tsx, marcados con `data-tk`) en una
 * lista de líneas simples que el proceso de escritorio arma como texto ESC/POS e imprime en
 * crudo. Ver por qué: `desktop/main.js`, el bloque "Impresión directa de tickets".
 */

export type LineaTicket =
  | { tipo: "texto"; texto: string; centrado?: boolean; negrita?: boolean; grande?: boolean; mayus?: boolean }
  | { tipo: "separador"; fuerte?: boolean }
  | { tipo: "linea"; etiqueta: string; valor?: string; fuerte?: boolean }
  | { tipo: "renglon"; nombre: string; detalle?: string; valor: string };

/** Columnas de texto que caben en el rollo (una térmica típica imprime ~32 a 58 mm y ~48 a 80 mm). */
export function columnasDelRollo(ticketMm: number): number {
  const util = Math.max(30, ticketMm <= 60 ? ticketMm - 10 : ticketMm - 8);
  return Math.max(24, Math.round((util * 2) / 3));
}

export function extraerLineasTicket(raiz: HTMLElement): LineaTicket[] {
  const lineas: LineaTicket[] = [];
  const nodos = raiz.querySelectorAll<HTMLElement>("[data-tk]");
  nodos.forEach((el) => {
    const tipo = el.dataset.tk;
    if (tipo === "texto") {
      const texto = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!texto) return;
      lineas.push({
        tipo: "texto",
        texto,
        centrado: el.hasAttribute("data-centrado"),
        negrita: el.hasAttribute("data-negrita"),
        grande: el.hasAttribute("data-grande"),
        mayus: el.hasAttribute("data-mayus"),
      });
    } else if (tipo === "separador") {
      lineas.push({ tipo: "separador", fuerte: el.hasAttribute("data-fuerte") });
    } else if (tipo === "linea") {
      const hijos = Array.from(el.children) as HTMLElement[];
      const etiqueta = (hijos[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
      const valor = hijos[1] ? (hijos[1].textContent ?? "").replace(/\s+/g, " ").trim() : undefined;
      if (!etiqueta && !valor) return;
      lineas.push({ tipo: "linea", etiqueta, valor, fuerte: el.hasAttribute("data-fuerte") });
    } else if (tipo === "renglon") {
      const hijos = Array.from(el.children) as HTMLElement[];
      const nombre = (hijos[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
      const fila = hijos[1];
      const spans = fila ? (Array.from(fila.children) as HTMLElement[]) : [];
      const detalle = (spans[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
      const valor = (spans[1]?.textContent ?? "").replace(/\s+/g, " ").trim();
      lineas.push({ tipo: "renglon", nombre, detalle: detalle || undefined, valor });
    }
  });
  return lineas;
}
