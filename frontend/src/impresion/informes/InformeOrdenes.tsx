import { useMemo } from "react";
import type { Configuracion, Moneda, Orden } from "@lavanderia/shared/types/types";
import { formatearMoneda } from "../../utils/monedaHelpers";
import { nombreCliente } from "../../utils/clienteHelpers";
import { useEtiquetas } from "../../context/configuracionCore";
import { FilaKpis, HojaReporte, KpiImpreso, SeccionImpresa, TablaImpresa } from "../Hoja";
import type { ColumnaImpresa } from "../Hoja";
import ModalImpresion from "../ModalImpresion";
import { ESTADOS, fecha } from "../etiquetas";

interface Props {
  open: boolean;
  onClose: () => void;
  ordenes: Orden[];
  monedaPrincipal: Moneda;
  configuracion?: Configuracion | null;
  filtros?: string[];
}

export default function ImprimirOrdenes({ open, onClose, ordenes, monedaPrincipal, configuracion, filtros }: Props) {
  const et = useEtiquetas();
  const fmt = (n: number) => formatearMoneda(n, monedaPrincipal);
  const conEntrega = !!configuracion?.moduloFechaEntrega;

  const vigentes = useMemo(() => ordenes.filter((o) => o.estado !== "CANCELADO"), [ordenes]);
  const anuladas = ordenes.length - vigentes.length;
  const total = vigentes.reduce((s, o) => s + (o.total || 0), 0);
  const cobrado = vigentes.reduce((s, o) => s + (o.abonado || 0), 0);
  const faltante = vigentes.reduce((s, o) => s + Math.max(o.faltante || 0, 0), 0);
  const conSaldo = vigentes.filter((o) => (o.faltante || 0) > 0.005).length;

  const columnas: ColumnaImpresa<Orden>[] = [
    { titulo: "N°", celda: (o) => <strong>#{o.id}</strong>, nowrap: true },
    { titulo: et.cliente, celda: (o) => nombreCliente(o.cliente) },
    { titulo: "Fecha", celda: (o) => fecha(o.fechaIngreso), nowrap: true },
    ...(conEntrega ? [{ titulo: "Estado", celda: (o: Orden) => ESTADOS[o.estado] } as ColumnaImpresa<Orden>] : []),
    {
      titulo: "Pago",
      nowrap: true,
      celda: (o) => (o.estado === "CANCELADO" ? "Anulada" : o.estadoPago === "COMPLETO" ? "Pagada" : o.abonado > 0 ? "Parcial" : "Sin pagar"),
    },
    { titulo: "Total", alinear: "right", nowrap: true, celda: (o) => fmt(o.total || 0), total: fmt(total) },
    { titulo: "Abonado", alinear: "right", nowrap: true, celda: (o) => fmt(o.abonado || 0), total: fmt(cobrado) },
    { titulo: "Falta", alinear: "right", nowrap: true, celda: (o) => (o.estado !== "CANCELADO" && o.faltante > 0.005 ? <strong>{fmt(o.faltante)}</strong> : "—"), total: fmt(faltante) },
  ];

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo={`Vista previa · Reporte de ${et.ordenesMin}`}
      documentTitle={`${et.ordenes}_${new Date().toISOString().slice(0, 10)}`}
      hoja={(ref) => (
        <HojaReporte ref={ref} titulo={`Reporte de ${et.ordenesMin}`} subtitulo={`${ordenes.length} ${ordenes.length === 1 ? et.ordenMin : et.ordenesMin} · importes en ${monedaPrincipal}`} filtros={filtros}>
          <FilaKpis>
            <KpiImpreso titulo={`Total ${et.ordenesMin}`} valor={fmt(total)} nota={anuladas > 0 ? `sin contar ${anuladas} anulada(s)` : undefined} />
            <KpiImpreso titulo="Cobrado" valor={fmt(cobrado)} />
            <KpiImpreso titulo="Por cobrar" valor={fmt(faltante)} tono={faltante > 0 ? "malo" : "normal"} nota={`${conSaldo} con saldo`} />
            <KpiImpreso titulo="Cantidad" valor={String(ordenes.length)} />
          </FilaKpis>
          <SeccionImpresa titulo="Detalle">
            <TablaImpresa clave={(o) => o.id} filas={ordenes} columnas={columnas} vacio={`No hay ${et.ordenesMin} con estos filtros.`} />
          </SeccionImpresa>
        </HojaReporte>
      )}
    />
  );
}
