import { FaTag, FaTimes } from "react-icons/fa";
import type { DescuentoOrden } from "@lavanderia/shared/types/types";
import { useAuth } from "../../hooks/useAuth";
import { useConfiguracion } from "../../context/configuracionCore";

interface Props {
  inputRef?: React.Ref<HTMLInputElement>;
  value: DescuentoOrden | null;
  onChange: (d: DescuentoOrden | null) => void;
  disabled?: boolean;
}

/** Descuento de la venta, en % o en monto. Quien no es admin ve el tope del negocio. */
export default function DescuentoControl({ value, onChange, disabled, inputRef }: Props) {
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const tipo = value?.tipo ?? "PORCENTAJE";
  const tope = config?.descuentoMaxPct ?? 100;
  const conTope = !hasRole(["ADMIN"]) && tope < 100;

  const cambiar = (nuevoTipo: DescuentoOrden["tipo"], texto: string) => {
    const n = parseFloat(texto.replace(",", "."));
    if (texto === "" || isNaN(n) || n <= 0) return onChange(texto === "" ? null : { tipo: nuevoTipo, valor: 0 });
    onChange({ tipo: nuevoTipo, valor: nuevoTipo === "PORCENTAJE" ? Math.min(n, 100) : n });
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <FaTag className="text-gray-400 shrink-0" size={12} />
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Descuento</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-xs">
            {(["PORCENTAJE", "MONTO"] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => onChange(value ? { tipo: t, valor: t === "PORCENTAJE" ? Math.min(value.valor, 100) : value.valor } : null)}
                className={`px-2 py-1 font-semibold cursor-pointer ${
                  tipo === t
                    ? "bg-blue-600 text-white"
                    : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {t === "PORCENTAJE" ? "%" : "$"}
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            type="number"
            min={0}
            step="any"
            disabled={disabled}
            value={value?.valor ? value.valor : ""}
            onChange={(e) => cambiar(tipo, e.target.value)}
            placeholder="0"
            aria-label="Valor del descuento"
            className="w-20 text-right px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 text-sm"
          />
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              title="Quitar descuento"
              className="text-gray-400 hover:text-red-500 cursor-pointer"
            >
              <FaTimes size={12} />
            </button>
          )}
        </div>
      </div>
      {conTope && <p className="text-[11px] text-gray-400 mt-1 text-right">Máximo permitido: {tope}%</p>}
    </div>
  );
}
