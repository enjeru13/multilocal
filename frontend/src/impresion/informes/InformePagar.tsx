import { useMemo } from "react";
import type { Compra, CuentasPorPagar } from "@lavanderia/shared/types/types";
import { diasDeAntiguedad, resumirAntiguedad } from "@lavanderia/shared/utils/antiguedad";
import { comprasService } from "../../services/comprasService";
import { formatearMoneda } from "../../utils/monedaHelpers";
import { BarrasImpresas, FilaKpis, HojaReporte, KpiImpreso, SeccionImpresa } from "../Hoja";
import { TicketPapel, TkEncabezado, TkLinea, TkPie, TkSeparador, TkTitulo } from "../Ticket";
import ModalImpresion from "../ModalImpresion";
import { useCarga } from "../useCarga";
import { fecha } from "../etiquetas";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Lo que se le debe a proveedores, con las compras vencidas señaladas. */
export default function ImprimirPorPagar({ open, onClose }: Props) {
  const { data, cargando, error } = useCarga<CuentasPorPagar>(open, () => comprasService.porPagar().then((r) => r.data));
  const d = data;
  const fmt = (n: number) => formatearMoneda(n, d?.moneda ?? "USD");

  const grupos = useMemo(() => {
    const m = new Map<number, { nombre: string; compras: (Compra & { vencida: boolean })[] }>();
    for (const c of d?.compras ?? []) {
      const g = m.get(c.proveedorId) ?? { nombre: c.proveedor?.nombre ?? `Proveedor #${c.proveedorId}`, compras: [] };
      g.compras.push(c);
      m.set(c.proveedorId, g);
    }
    return [...m.values()]
      .map((g) => ({ ...g, saldo: g.compras.reduce((s, c) => s + c.saldo, 0) }))
      .sort((a, b) => b.saldo - a.saldo);
  }, [d]);

  const antiguedad = useMemo(() => resumirAntiguedad((d?.compras ?? []).map((c) => ({ dias: diasDeAntiguedad(c.fecha), monto: c.saldo }))), [d]);
  const hoy = new Date();

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo="Vista previa · Cuentas por pagar"
      documentTitle={`Por_pagar_${new Date().toISOString().slice(0, 10)}`}
      cargando={cargando || !d}
      error={error}
      hoja={(ref) =>
        d && (
          <HojaReporte ref={ref} titulo="Cuentas por pagar" subtitulo={`${d.compras.length} ${d.compras.length === 1 ? "compra pendiente" : "compras pendientes"} · importes en ${d.moneda}`}>
            <FilaKpis>
              <KpiImpreso titulo="Total por pagar" valor={fmt(d.total)} />
              <KpiImpreso titulo="Vencido" valor={fmt(d.vencido)} tono={d.vencido > 0 ? "malo" : "normal"} />
              <KpiImpreso titulo="Proveedores" valor={String(d.proveedores.length)} />
              <KpiImpreso titulo="Compras" valor={String(d.compras.length)} />
            </FilaKpis>

            <SeccionImpresa titulo="Antigüedad de la deuda" nota="desde la fecha de la compra">
              <BarrasImpresas datos={antiguedad.map((t) => ({ etiqueta: t.etiqueta, valor: t.monto, nota: `${t.cantidad} compra(s)` }))} formato={fmt} />
            </SeccionImpresa>

            <SeccionImpresa titulo="Detalle por proveedor">
              <table className="w-full border-collapse text-[9.5pt]">
                <thead className="[display:table-header-group]">
                  <tr className="border-y border-neutral-800 bg-neutral-100 text-[8pt] font-bold uppercase tracking-wider text-neutral-700">
                    <th className="py-1.5 px-2 text-left">Proveedor / compra</th>
                    <th className="py-1.5 px-2 text-left">Fecha</th>
                    <th className="py-1.5 px-2 text-left">Vence</th>
                    <th className="py-1.5 px-2 text-right">Total</th>
                    <th className="py-1.5 px-2 text-right">Pagado</th>
                    <th className="py-1.5 px-2 text-right">Saldo</th>
                  </tr>
                </thead>
                {grupos.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={6} className="py-6 text-center italic text-neutral-500">No se debe nada a proveedores.</td>
                    </tr>
                  </tbody>
                ) : (
                  grupos.map((g) => (
                    <tbody key={g.nombre} className="break-inside-avoid">
                      <tr className="bg-neutral-50 border-b border-neutral-300 font-bold">
                        <td colSpan={5} className="py-1.5 px-2">{g.nombre}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{fmt(g.saldo)}</td>
                      </tr>
                      {g.compras.map((c) => (
                        <tr key={c.id} className="border-b border-neutral-200">
                          <td className="py-1 px-2 pl-6">Compra #{c.id}</td>
                          <td className="py-1 px-2 whitespace-nowrap">{fecha(c.fecha)}</td>
                          <td className={`py-1 px-2 whitespace-nowrap ${c.vencida ? "font-bold" : ""}`}>
                            {c.fechaVencimiento ? fecha(c.fechaVencimiento) : "—"}
                            {c.vencida ? " · VENCIDA" : ""}
                          </td>
                          <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">{fmt(c.total)}</td>
                          <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">{fmt(c.montoPagado)}</td>
                          <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">{fmt(c.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))
                )}
                <tbody>
                  <tr className="border-t-2 border-neutral-800 font-bold bg-neutral-50">
                    <td colSpan={5} className="py-2 px-2">Total por pagar</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmt(d.total)}</td>
                  </tr>
                </tbody>
              </table>
            </SeccionImpresa>
          </HojaReporte>
        )
      }
      ticket={(ref) =>
        d && (
          <TicketPapel ref={ref}>
            <TkEncabezado titulo="Por pagar" subtitulo={`al ${fecha(hoy)}`} />
            <TkSeparador />
            <TkLinea etiqueta="Total" valor={fmt(d.total)} fuerte />
            <TkLinea etiqueta="Vencido" valor={fmt(d.vencido)} />
            <TkTitulo>Proveedores</TkTitulo>
            {grupos.map((g) => (
              <TkLinea key={g.nombre} etiqueta={g.nombre} valor={fmt(g.saldo)} />
            ))}
            <TkPie />
          </TicketPapel>
        )
      }
    />
  );
}
