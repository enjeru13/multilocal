import { useState } from "react";
import { FaPlus, FaTag, FaTimes } from "react-icons/fa";
import type { DescuentoOrden } from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import { useConfiguracion } from "../../context/configuracionCore";
import type { Moneda } from "../../utils/monedaHelpers";
import { CampoMontoNumero } from "../ui/CampoMonto";

interface Props {
  /** Recibe el foco al usar el atajo: es el botón "Agregar descuento" o, si ya está abierto, el campo. */
  inputRef?: React.Ref<HTMLElement>;
  value: DescuentoOrden | null;
  onChange: (d: DescuentoOrden | null) => void;
  disabled?: boolean;
}

const SIMBOLO: Record<Moneda, string> = { USD: "$", VES: "Bs.", COP: "$" };

const campoNumero =
  "h-9 w-full min-w-0 px-2.5 text-right tabular-nums text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-60";

/**
 * Descuento de la venta, en % o en monto. Cerrado es un enlace discreto; al abrirlo
 * o si ya hay descuento, muestra el tipo y el valor. Quien no es admin ve el tope.
 */
export default function DescuentoControl({ value, onChange, disabled, inputRef }: Props) {
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [pctTexto, setPctTexto] = useState(value?.tipo === "PORCENTAJE" ? String(value.valor) : "");
  const tipo = value?.tipo ?? "PORCENTAJE";
  const principal = (config?.monedaPrincipal ?? "USD") as Moneda;
  const tope = config?.descuentoMaxPct ?? 100;
  const conTope = !hasRole(["ADMIN"]) && tope < 100;

  const cambiarTipo = (nuevo: DescuentoOrden["tipo"]) => {
    if (nuevo === tipo) return;
    if (nuevo === "PORCENTAJE") setPctTexto(value && value.valor > 0 ? String(Math.min(value.valor, 100)) : "");
    onChange(value ? { tipo: nuevo, valor: nuevo === "PORCENTAJE" ? Math.min(value.valor, 100) : value.valor } : { tipo: nuevo, valor: 0 });
  };

  const cambiarPorcentaje = (texto: string) => {
    setPctTexto(texto);
    const n = parseFloat(texto.replace(",", "."));
    if (texto === "" || isNaN(n) || n <= 0) return onChange(texto === "" ? null : { tipo: "PORCENTAJE", valor: 0 });
    onChange({ tipo: "PORCENTAJE", valor: Math.min(n, 100) });
  };

  const quitar = () => {
    onChange(null);
    setAbierto(false);
  };

  if (!abierto && !value) {
    return (
      <button
        type="button"
        ref={inputRef as React.Ref<HTMLButtonElement>}
        disabled={disabled}
        onClick={() => setAbierto(true)}
        onFocus={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
      >
        <FaPlus size={10} /> Agregar descuento
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40 p-2">
        <span className="flex items-center gap-1.5 pl-1 text-sm font-semibold text-gray-600 dark:text-gray-400 shrink-0">
          <FaTag size={12} className="text-gray-400" /> Descuento
        </span>
        <div role="radiogroup" aria-label="Tipo de descuento" className="ml-auto inline-flex rounded-lg bg-gray-200/70 dark:bg-gray-800 p-0.5 shrink-0">
          {(["PORCENTAJE", "MONTO"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              disabled={disabled}
              onClick={() => cambiarTipo(t)}
              className={`min-w-9 h-7 px-2 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                tipo === t ? "bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-xs" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {t === "PORCENTAJE" ? "%" : SIMBOLO[principal]}
            </button>
          ))}
        </div>
        <div className="w-24 shrink-0">
          {tipo === "MONTO" ? (
            <CampoMontoNumero
              inputRef={inputRef as React.Ref<HTMLInputElement>}
              moneda={principal}
              disabled={disabled}
              valor={value?.valor ? value.valor : null}
              onValor={(n) => (n === null ? onChange(null) : onChange({ tipo: "MONTO", valor: n }))}
              placeholder="0.00"
              aria-label="Monto del descuento"
              className={campoNumero}
              autoFocus
            />
          ) : (
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type="text"
              inputMode="decimal"
              disabled={disabled}
              value={value === null ? "" : pctTexto}
              onChange={(e) => cambiarPorcentaje(e.target.value)}
              placeholder="0"
              aria-label="Porcentaje del descuento"
              className={campoNumero}
              autoFocus
            />
          )}
        </div>
        <button type="button" disabled={disabled} onClick={quitar} title="Quitar descuento" aria-label="Quitar descuento" className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer">
          <FaTimes size={12} />
        </button>
      </div>
      {conTope && <p className="text-[11px] text-gray-400 mt-1 text-right">Máximo permitido: {tope}%</p>}
    </div>
  );
}
