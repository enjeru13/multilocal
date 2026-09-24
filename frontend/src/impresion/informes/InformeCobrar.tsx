import { Fragment } from "react";
import type { CuentasPorCobrar } from "@lavanderia/shared/types/types";
import { reportesService } from "../../services/reportesService";
import { formatearMoneda } from "../../utils/monedaHelpers";
import { useEtiquetas } from "../../context/configuracionCore";
import { BarrasImpresas, FilaKpis, HojaReporte, KpiImpreso, NotaImpresa, SeccionImpresa } from "../Hoja";
import { TicketPapel, TkEncabezado, TkLinea, TkPie, TkSeparador, TkTitulo } from "../Ticket";
import ModalImpresion from "../ModalImpresion";
import { useCarga } from "../useCarga";
import { fecha } from "../etiquetas";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Quién le debe al negocio, agrupado por cliente y con la antigüedad de cada deuda. */
export default function ImprimirPorCobrar({ open, onClose }: Props) {
  const et = useEtiquetas();
  const { data, cargando, error } = useCarga<CuentasPorCobrar>(open, () => reportesService.porCobrar().then((r) => r.data));
  const d = data;
  const fmt = (n: number) => formatearMoneda(n, d?.moneda ?? "USD");
  const vencido60 = d ? d.antiguedad.filter((t) => t.id === "D61_90" || t.id === "D90_MAS").reduce((s, t) => s + t.monto, 0) : 0;
  const masAntigua = d ? Math.max(0, ...d.clientes.map((c) => c.masAntigua)) : 0;

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo={`Vista previa · Cuentas por cobrar`}
      documentTitle={`Por_cobrar_${new Date().toISOString().slice(0, 10)}`}
      cargando={cargando || !d}
      error={error}
      hoja={(ref) =>
        d && (
          <HojaReporte ref={ref} titulo="Cuentas por cobrar" subtitulo={`${d.cantidad} ${d.cantidad === 1 ? et.ordenMin : et.ordenesMin} con saldo · importes en ${d.moneda}`}>
            <FilaKpis>
              <KpiImpreso titulo="Total por cobrar" valor={fmt(d.monto)} tono={d.monto > 0 ? "malo" : "normal"} />
              <KpiImpreso titulo={`${et.clientes} con deuda`} valor={String(d.clientes.filter((c) => c.clienteId !== null).length)} />
              <KpiImpreso titulo="Deuda más antigua" valor={`${masAntigua} ${masAntigua === 1 ? "día" : "días"}`} />
              <KpiImpreso titulo="Con más de 60 días" valor={fmt(vencido60)} tono={vencido60 > 0 ? "malo" : "normal"} />
            </FilaKpis>

            <SeccionImpresa titulo="Antigüedad de la deuda" nota="desde la fecha de la venta">
              <BarrasImpresas datos={d.antiguedad.map((t) => ({ etiqueta: t.etiqueta, valor: t.monto, nota: `${t.cantidad} ${t.cantidad === 1 ? et.ordenMin : et.ordenesMin}` }))} formato={fmt} />
            </SeccionImpresa>

            <SeccionImpresa titulo={`Detalle por ${et.clienteMin}`}>
              <table className="w-full border-collapse text-[9.5pt]">
                <thead className="[display:table-header-group]">
                  <tr className="border-y border-neutral-800 bg-neutral-100 text-[8pt] font-bold uppercase tracking-wider text-neutral-700">
                    <th className="py-1.5 px-2 text-left">{et.cliente} / {et.orden}</th>
                    <th className="py-1.5 px-2 text-left">Fecha</th>
                    <th className="py-1.5 px-2 text-right">Días</th>
                    <th className="py-1.5 px-2 text-right">Total</th>
                    <th className="py-1.5 px-2 text-right">Abonado</th>
                    <th className="py-1.5 px-2 text-right">Debe</th>
                  </tr>
                </thead>
                {d.clientes.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={6} className="py-6 text-center italic text-neutral-500">Nadie tiene saldo pendiente.</td>
                    </tr>
                  </tbody>
                ) : (
                  d.clientes.map((c) => (
                    <tbody key={c.clienteId ?? "sin"} className="break-inside-avoid">
                      <tr className="bg-neutral-50 border-b border-neutral-300 font-bold">
                        <td colSpan={5} className="py-1.5 px-2">
                          {c.nombre}
                          {c.telefono && <span className="ml-3 font-normal text-neutral-600">{c.telefono}</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{fmt(c.monto)}</td>
                      </tr>
                      {c.ordenes.map((o) => (
                        <Fragment key={o.id}>
                          <tr className="border-b border-neutral-200">
                            <td className="py-1 px-2 pl-6">#{o.id}</td>
                            <td className="py-1 px-2 whitespace-nowrap">{fecha(o.fecha)}</td>
                            <td className={`py-1 px-2 text-right tabular-nums ${o.dias > 60 ? "font-bold" : ""}`}>{o.dias}</td>
                            <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">{fmt(o.total)}</td>
                            <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">{fmt(o.abonado)}</td>
                            <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">{fmt(o.faltante)}</td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  ))
                )}
                <tbody>
                  <tr className="border-t-2 border-neutral-800 font-bold bg-neutral-50">
                    <td colSpan={5} className="py-2 px-2">Total por cobrar</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmt(d.monto)}</td>
                  </tr>
                </tbody>
              </table>
              <NotaImpresa>Los días se cuentan desde la fecha de cada venta hasta el {fecha(d.corte)}.</NotaImpresa>
            </SeccionImpresa>
          </HojaReporte>
        )
      }
      ticket={(ref) =>
        d && (
          <TicketPapel ref={ref}>
            <TkEncabezado titulo="Por cobrar" subtitulo={`al ${fecha(d.corte)}`} />
            <TkSeparador />
            <TkLinea etiqueta="Total" valor={fmt(d.monto)} fuerte />
            <TkLinea etiqueta={`${et.ordenes} con saldo`} valor={String(d.cantidad)} />
            <TkTitulo>Antigüedad</TkTitulo>
            {d.antiguedad.map((t) => (
              <TkLinea key={t.id} etiqueta={t.etiqueta} valor={fmt(t.monto)} />
            ))}
            <TkTitulo>{et.clientes}</TkTitulo>
            {d.clientes.slice(0, 40).map((c) => (
              <TkLinea key={c.clienteId ?? "sin"} etiqueta={c.nombre} valor={fmt(c.monto)} />
            ))}
            {d.clientes.length > 40 && <p style={{ fontSize: "0.85em" }}>… y {d.clientes.length - 40} más. Imprime la hoja para ver todos.</p>}
            <TkPie />
          </TicketPapel>
        )
      }
    />
  );
}
