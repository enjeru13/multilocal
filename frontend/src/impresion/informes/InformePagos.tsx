import { useMemo } from "react";
import type { Configuracion, Moneda, Pago } from "@lavanderia/shared/types/types";
import { calcularTotalAbonado } from "@lavanderia/shared/utils/pagoFinance";
import { formatearMoneda } from "../../utils/monedaHelpers";
import { nombreCliente } from "../../utils/clienteHelpers";
import { useEtiquetas } from "../../context/configuracionCore";
import { BarrasImpresas, FilaKpis, HojaReporte, KpiImpreso, SeccionImpresa, TablaImpresa } from "../Hoja";
import ModalImpresion from "../ModalImpresion";
import { METODOS, fecha } from "../etiquetas";

interface Props {
  open: boolean;
  onClose: () => void;
  pagos: Pago[];
  monedaPrincipal: Moneda;
  configuracion?: Configuracion | null;
  /** Filtros de la pantalla, para dejarlos escritos en el papel. */
  filtros?: string[];
}

export default function ImprimirPagos({ open, onClose, pagos, monedaPrincipal, configuracion, filtros }: Props) {
  const et = useEtiquetas();
  const tasas = useMemo(() => ({ VES: configuracion?.tasaVES ?? null, COP: configuracion?.tasaCOP ?? null }), [configuracion]);
  const fmt = (n: number) => formatearMoneda(n, monedaPrincipal);

  const filas = useMemo(
    () => pagos.map((p) => ({ p, principal: calcularTotalAbonado([{ ...p, tasa: p.tasa ?? null, vueltos: p.vueltos ?? [] }], tasas, monedaPrincipal) })),
    [pagos, tasas, monedaPrincipal]
  );
  const total = filas.reduce((s, f) => s + f.principal, 0);

  const porMetodo = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filas) m.set(f.p.metodoPago, (m.get(f.p.metodoPago) ?? 0) + f.principal);
    return [...m.entries()].map(([k, v]) => ({ etiqueta: METODOS[k] ?? k, valor: v })).sort((a, b) => b.valor - a.valor);
  }, [filas]);

  const porMoneda = useMemo(() => {
    const m = new Map<Moneda, { bruto: number; n: number }>();
    for (const { p } of filas) {
      const x = m.get(p.moneda) ?? { bruto: 0, n: 0 };
      x.bruto += p.monto;
      x.n += 1;
      m.set(p.moneda, x);
    }
    return [...m.entries()];
  }, [filas]);

  const devoluciones = filas.filter((f) => f.p.monto < 0);

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo="Vista previa · Reporte de pagos"
      documentTitle={`Pagos_${new Date().toISOString().slice(0, 10)}`}
      hoja={(ref) => (
        <HojaReporte ref={ref} titulo="Reporte de pagos" subtitulo={`${filas.length} ${filas.length === 1 ? "pago" : "pagos"} · importes en ${monedaPrincipal}`} filtros={filtros}>
          <FilaKpis columnas={3}>
            <KpiImpreso titulo="Total cobrado" valor={fmt(total)} nota={devoluciones.length > 0 ? `incluye ${devoluciones.length} devolución(es)` : undefined} />
            <KpiImpreso titulo="Pagos registrados" valor={String(filas.length)} />
            <KpiImpreso titulo="Pago promedio" valor={fmt(filas.length ? total / filas.length : 0)} />
          </FilaKpis>

          {(porMetodo.length > 0 || porMoneda.length > 0) && (
            <div className="grid grid-cols-2 gap-8">
              <SeccionImpresa titulo="Por método de pago">
                <BarrasImpresas datos={porMetodo} formato={fmt} />
              </SeccionImpresa>
              <SeccionImpresa titulo="Por moneda recibida" nota="en la moneda original">
                <ul className="space-y-1.5 text-[9.5pt]">
                  {porMoneda.map(([m, x]) => (
                    <li key={m} className="flex justify-between gap-3">
                      <span>
                        {m} <span className="text-neutral-500">· {x.n}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatearMoneda(x.bruto, m)}</span>
                    </li>
                  ))}
                </ul>
              </SeccionImpresa>
            </div>
          )}

          <SeccionImpresa titulo="Detalle">
            <TablaImpresa
              clave={(f) => f.p.id}
              filas={filas}
              vacio="No hay pagos con estos filtros."
              columnas={[
                { titulo: "Fecha", celda: (f) => fecha(f.p.fechaPago), nowrap: true },
                { titulo: et.orden, celda: (f) => <strong>#{f.p.ordenId}</strong>, nowrap: true },
                { titulo: et.cliente, celda: (f) => nombreCliente(f.p.orden?.cliente) },
                { titulo: "Método", celda: (f) => METODOS[f.p.metodoPago] ?? f.p.metodoPago },
                { titulo: "Recibido", alinear: "right", nowrap: true, celda: (f) => formatearMoneda(f.p.monto, f.p.moneda) },
                {
                  titulo: "Tasa",
                  alinear: "right",
                  celda: (f) => (f.p.moneda !== monedaPrincipal && f.p.tasa && f.p.tasa > 1 ? Number(f.p.tasa).toLocaleString("es", { maximumFractionDigits: 2 }) : "—"),
                },
                { titulo: `En ${monedaPrincipal}`, alinear: "right", nowrap: true, celda: (f) => fmt(f.principal), total: fmt(total) },
              ]}
            />
          </SeccionImpresa>
        </HojaReporte>
      )}
    />
  );
}
