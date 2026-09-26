import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { formatoDeCodigo } from "../../utils/etiquetas";

/** Código de barras en SVG (vectorial: sale nítido a cualquier tamaño de impresora). */
export default function CodigoBarras({ valor, alto = 30, ancho = 1.2 }: { valor: string; alto?: number; ancho?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !valor) return;
    const opciones = { width: ancho, height: alto, displayValue: false, margin: 0, background: "transparent" };
    try {
      JsBarcode(ref.current, valor, { ...opciones, format: formatoDeCodigo(valor) });
    } catch {
      // Un EAN con dígito de control inválido, por ejemplo: se imprime igual como Code 128.
      try {
        JsBarcode(ref.current, valor, { ...opciones, format: "CODE128" });
      } catch {
        /* código que no se puede dibujar */
      }
    }
  }, [valor, alto, ancho]);

  return <svg ref={ref} className="max-w-full" preserveAspectRatio="none" style={{ width: "100%", height: `${alto}px` }} aria-label={`Código de barras ${valor}`} />;
}
