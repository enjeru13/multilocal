import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { InputHTMLAttributes, Ref } from "react";
import { formatearEntradaMonto, montoAEntrada, parsearMonto, type Moneda } from "../../utils/monedaHelpers";
import { campo } from "./Formulario";

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode">;

interface TextoProps extends Base {
  moneda: Moneda;
  /** Texto del campo, ya con formato (ver `montoAEntrada`). Se interpreta con `parsearMonto`. */
  value: string;
  onValue: (texto: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Campo de dinero que agrupa los miles mientras se escribe ("1.500.000,50" en
 * bolívares y pesos, "1,500,000.50" en dólares), para ver de un vistazo cuánto
 * se está poniendo. El estado guarda el texto formateado; se lee con `parsearMonto`.
 */
export default function CampoMonto({ moneda, value, onValue, className, inputRef, ...resto }: TextoProps) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && cursor.current !== null && document.activeElement === el) {
      el.setSelectionRange(cursor.current, cursor.current);
    }
    cursor.current = null;
  });

  return (
    <input
      {...resto}
      ref={(el) => {
        ref.current = el;
        if (typeof inputRef === "function") inputRef(el);
        else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el;
      }}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      className={className ?? campo}
      onChange={(e) => {
        const el = e.target;
        const crudo = el.value;
        const formateado = formatearEntradaMonto(crudo, moneda, value);
        const alFinal = (el.selectionStart ?? crudo.length) >= crudo.length;
        if (alFinal) {
          cursor.current = formateado.length;
        } else {
          // Conserva el cursor contando los dígitos que quedaron a su izquierda.
          const digitos = crudo.slice(0, el.selectionStart ?? 0).replace(/\D/g, "").length;
          let vistos = 0;
          let pos = 0;
          while (pos < formateado.length && vistos < digitos) {
            if (/\d/.test(formateado[pos])) vistos++;
            pos++;
          }
          cursor.current = pos;
        }
        onValue(formateado);
      }}
    />
  );
}

interface NumeroProps extends Base {
  moneda: Moneda;
  inputRef?: Ref<HTMLInputElement>;
  valor: number | null;
  onValor: (n: number | null) => void;
}

/** Igual que `CampoMonto`, pero el estado del formulario es un número (o null si está vacío). */
export function CampoMontoNumero({ moneda, valor, onValor, ...resto }: NumeroProps) {
  const [texto, setTexto] = useState(valor === null ? "" : montoAEntrada(valor, moneda));

  // Si el formulario cambia el valor por fuera (p. ej. al cargar un registro), refleja el cambio.
  useEffect(() => {
    const actual = texto === "" ? null : parsearMonto(texto, moneda);
    if (actual !== valor) setTexto(valor === null ? "" : montoAEntrada(valor, moneda));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, moneda]);

  return (
    <CampoMonto
      {...resto}
      moneda={moneda}
      value={texto}
      onValue={(t) => {
        setTexto(t);
        onValor(t === "" ? null : parsearMonto(t, moneda));
      }}
    />
  );
}
