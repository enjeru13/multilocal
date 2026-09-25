import { useAlertasPresupuestos } from "../../hooks/useAlertasPresupuestos";

/**
 * Globito con el número de presupuestos que piden atención (rojo si ya hay vencidos, ámbar si solo
 * están por vencer). Se usa solo junto a "Presupuestos" en el menú (cada uso consulta las alertas).
 */
export default function InsigniaNav({ flotante = false }: { flotante?: boolean }) {
  const { vencidos, porVencer, total } = useAlertasPresupuestos();
  if (total === 0) return null;
  const rojo = vencidos > 0;
  const texto = `${vencidos > 0 ? `${vencidos} vencido${vencidos === 1 ? "" : "s"}` : ""}${vencidos > 0 && porVencer > 0 ? " y " : ""}${porVencer > 0 ? `${porVencer} por vencer` : ""}`;
  return (
    <span
      title={texto}
      aria-label={texto}
      className={`${flotante ? "absolute -top-1.5 -right-2.5" : ""} min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-bold leading-none flex items-center justify-center text-white ${rojo ? "bg-red-500" : "bg-amber-500"}`}
    >
      {total > 99 ? "99+" : total}
    </span>
  );
}
