import dayjs from "dayjs";
import "dayjs/locale/es";
import type { ReciboData } from "@lavanderia/shared/types/types";
import { convertirDesdePrincipal, formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import { useEtiquetas } from "../../context/configuracionCore";
import { useMonedas } from "../../context/useMonedas";
import { FirmasImpresas, HojaReporte, NotaImpresa, SeccionImpresa, TablaImpresa } from "../Hoja";
import { TicketPapel, TkEncabezado, TkLinea, TkPie, TkRenglon, TkSeparador, TkTitulo } from "../Ticket";
import ModalImpresion from "../ModalImpresion";

interface Props {
  open: boolean;
  onClose: () => void;
  datos: ReciboData;
}

const fechaLarga = (d: Date | string | null | undefined) => (d && dayjs(d).isValid() ? dayjs(d).locale("es").format("DD/MM/YYYY") : "");
const cantidad = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 3 });

/**
 * Recibo de una venta u orden: ticket para la impresora térmica (se adapta al rollo) y
 * versión en hoja. Muestra los importes en la moneda principal y su equivalente en las
 * demás monedas del negocio, cómo pagó el cliente y lo que aún debe.
 */
export default function ImprimirRecibo({ open, onClose, datos }: Props) {
  const et = useEtiquetas();
  const negocio = useMonedas();
  const { principal, tasas } = negocio;
  const fmt = (n: number) => formatearMoneda(n, principal);
  const enOtras = (n: number) => negocio.otrasUsables.map((m) => ({ moneda: m, texto: formatearMoneda(convertirDesdePrincipal(n, m, tasas, principal), m) }));

  const restante = Math.max(datos.total - datos.abono, 0);
  const saldada = restante < 0.005;
  const d = datos.desglose;
  const cliente = `${datos.clienteInfo.nombre} ${datos.clienteInfo.apellido}`.trim();
  const numero = datos.numeroOrden ? `N.º ${datos.numeroOrden}` : "";
  const titulo = `${et.orden} ${numero}`.trim();
  const base = d ? d.subtotal - d.descuento - (d.impuestoIncluido ? d.impuesto : 0) : null;
  const etiquetaImpuesto = d ? `${d.impuestoNombre}${d.impuestoTasa ? ` ${d.impuestoTasa}%` : ""}` : "";
  const pie = datos.mensajePieRecibo || "Conserve este comprobante para cualquier reclamo.";

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo={`Vista previa · Recibo ${numero}`}
      documentTitle={`Recibo_${datos.numeroOrden ?? ""}`}
      ticket={(ref) => (
        <TicketPapel ref={ref}>
          <TkEncabezado titulo={titulo} subtitulo={saldada ? "PAGADO" : "PENDIENTE DE PAGO"} />
          <TkSeparador />

          <TkLinea etiqueta={et.cliente} valor={cliente || "—"} apilar />
          {datos.clienteInfo.identificacion && <TkLinea etiqueta="CI/RIF" valor={datos.clienteInfo.identificacion} />}
          {datos.clienteInfo.telefono && <TkLinea etiqueta="Teléfono" valor={datos.clienteInfo.telefono} />}
          <TkLinea etiqueta="Fecha" valor={fechaLarga(datos.clienteInfo.fechaIngreso)} />
          {datos.clienteInfo.fechaEntrega && <TkLinea etiqueta="Entrega" valor={fechaLarga(datos.clienteInfo.fechaEntrega)} />}
          {datos.atendio && <TkLinea etiqueta="Atendió" valor={datos.atendio} apilar />}

          <TkSeparador />
          <div className="flex justify-between font-black" style={{ fontSize: "0.85em" }}>
            <span>DESCRIPCIÓN</span>
            <span>IMPORTE</span>
          </div>
          <div className="mt-1">
            {datos.items.map((i, k) => (
              <TkRenglon key={k} nombre={i.descripcion} detalle={`${cantidad(i.cantidad)} x ${fmt(i.precioUnitario)}`} valor={fmt(i.cantidad * i.precioUnitario)} />
            ))}
          </div>

          <TkSeparador />
          <TkLinea etiqueta="Artículos" valor={cantidad(datos.totalCantidadPiezas)} />
          {d && <TkLinea etiqueta="Subtotal" valor={fmt(d.subtotal)} />}
          {d && d.descuento > 0 && <TkLinea etiqueta="Descuento" valor={`-${fmt(d.descuento)}`} />}
          {d && d.impuesto > 0 && !d.impuestoIncluido && <TkLinea etiqueta={etiquetaImpuesto} valor={fmt(d.impuesto)} />}
          {d && d.devuelto > 0 && <TkLinea etiqueta="Devuelto" valor={`-${fmt(d.devuelto)}`} />}

          <div className="mt-1 pt-1 border-t border-black">
            <TkLinea etiqueta="TOTAL" valor={fmt(datos.total)} fuerte />
          </div>
          {enOtras(datos.total).map((o) => (
            <TkLinea key={o.moneda} etiqueta={<span style={{ fontSize: "0.85em" }}>en {o.moneda}</span>} valor={<span style={{ fontSize: "0.9em" }}>{o.texto}</span>} />
          ))}
          {d && d.impuesto > 0 && d.impuestoIncluido && base !== null && (
            <p className="mt-1" style={{ fontSize: "0.8em" }}>
              Incluye {etiquetaImpuesto}: {fmt(d.impuesto)} (base {fmt(base)})
            </p>
          )}

          {datos.pagos && datos.pagos.length > 0 && (
            <>
              <TkTitulo>Pagado con</TkTitulo>
              {datos.pagos.map((p, i) => (
                <div key={i}>
                  <TkLinea etiqueta={p.metodo} valor={formatearMoneda(p.monto, p.moneda)} />
                  {p.vueltos.map((v, j) => (
                    <TkLinea key={j} sangria etiqueta="Vuelto" valor={formatearMoneda(v.monto, v.moneda as Moneda)} />
                  ))}
                </div>
              ))}
            </>
          )}
          <TkLinea etiqueta="Abonado" valor={fmt(datos.abono)} />
          {saldada ? (
            <p className="mt-1 text-center font-black border border-black py-0.5" style={{ fontSize: "1.1em" }}>
              *** PAGADO ***
            </p>
          ) : (
            <>
              <TkLinea etiqueta="RESTA POR PAGAR" valor={fmt(restante)} fuerte />
              {enOtras(restante).map((o) => (
                <TkLinea key={o.moneda} etiqueta={<span style={{ fontSize: "0.85em" }}>en {o.moneda}</span>} valor={<span style={{ fontSize: "0.9em" }}>{o.texto}</span>} />
              ))}
            </>
          )}

          {datos.observaciones && (
            <>
              <TkTitulo>Observaciones</TkTitulo>
              <p className="leading-tight break-words">{datos.observaciones}</p>
            </>
          )}

          <TkPie>
            <p className="font-black uppercase" style={{ fontSize: "1.1em" }}>
              ¡Gracias por su preferencia!
            </p>
            <p className="leading-tight mt-0.5">{pie}</p>
            {!(d && d.impuesto > 0) && <p className="font-bold mt-0.5">(No da derecho a crédito fiscal)</p>}
          </TkPie>
        </TicketPapel>
      )}
      hoja={(ref) => (
        <HojaReporte ref={ref} titulo={`Recibo de ${et.ordenMin} ${numero}`.trim()} subtitulo={`${fechaLarga(datos.clienteInfo.fechaIngreso)} · ${saldada ? "Pagado" : "Pendiente de pago"}`}>
          <div className="grid grid-cols-2 gap-8 text-[10pt]">
            <div>
              <p className="text-[8pt] font-bold uppercase tracking-wider text-neutral-500 mb-1">{et.cliente}</p>
              <p className="font-bold text-[11pt]">{cliente || "—"}</p>
              {datos.clienteInfo.identificacion && <p>CI/RIF {datos.clienteInfo.identificacion}</p>}
              {datos.clienteInfo.telefono && <p>Tel. {datos.clienteInfo.telefono}</p>}
            </div>
            <div className="text-right">
              <p className="text-[8pt] font-bold uppercase tracking-wider text-neutral-500 mb-1">Datos</p>
              <p>Fecha: {fechaLarga(datos.clienteInfo.fechaIngreso)}</p>
              {datos.clienteInfo.fechaEntrega && <p>Entrega: {fechaLarga(datos.clienteInfo.fechaEntrega)}</p>}
              {datos.atendio && <p>Atendió: {datos.atendio}</p>}
            </div>
          </div>

          <SeccionImpresa titulo="Detalle">
            <TablaImpresa
              clave={(_, i) => i}
              filas={datos.items}
              columnas={[
                { titulo: "Descripción", celda: (i) => i.descripcion },
                { titulo: "Cant.", alinear: "right", celda: (i) => cantidad(i.cantidad) },
                { titulo: "Precio", alinear: "right", nowrap: true, celda: (i) => fmt(i.precioUnitario) },
                { titulo: "Importe", alinear: "right", nowrap: true, celda: (i) => fmt(i.cantidad * i.precioUnitario) },
              ]}
            />
          </SeccionImpresa>

          <div className="grid grid-cols-2 gap-8 break-inside-avoid">
            <div>
              {datos.pagos && datos.pagos.length > 0 && (
                <SeccionImpresa titulo="Pagado con">
                  <ul className="space-y-1 text-[10pt]">
                    {datos.pagos.map((p, i) => (
                      <li key={i}>
                        <div className="flex justify-between gap-3">
                          <span>{p.metodo}</span>
                          <span className="tabular-nums font-semibold">{formatearMoneda(p.monto, p.moneda)}</span>
                        </div>
                        {p.vueltos.map((v, j) => (
                          <div key={j} className="flex justify-between gap-3 pl-4 text-neutral-600">
                            <span>Vuelto entregado</span>
                            <span className="tabular-nums">{formatearMoneda(v.monto, v.moneda as Moneda)}</span>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </SeccionImpresa>
              )}
              {datos.observaciones && (
                <div className="mt-4">
                  <SeccionImpresa titulo="Observaciones">
                    <p className="text-[10pt]">{datos.observaciones}</p>
                  </SeccionImpresa>
                </div>
              )}
            </div>
            <table className="w-full text-[10pt] self-start">
              <tbody>
                {d && (
                  <tr>
                    <td className="py-0.5 text-neutral-600">Subtotal</td>
                    <td className="py-0.5 text-right tabular-nums">{fmt(d.subtotal)}</td>
                  </tr>
                )}
                {d && d.descuento > 0 && (
                  <tr>
                    <td className="py-0.5 text-neutral-600">Descuento</td>
                    <td className="py-0.5 text-right tabular-nums">− {fmt(d.descuento)}</td>
                  </tr>
                )}
                {d && d.impuesto > 0 && !d.impuestoIncluido && (
                  <tr>
                    <td className="py-0.5 text-neutral-600">{etiquetaImpuesto}</td>
                    <td className="py-0.5 text-right tabular-nums">{fmt(d.impuesto)}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-neutral-900 text-[13pt] font-extrabold">
                  <td className="pt-1.5">Total</td>
                  <td className="pt-1.5 text-right tabular-nums">{fmt(datos.total)}</td>
                </tr>
                {enOtras(datos.total).map((o) => (
                  <tr key={o.moneda} className="text-neutral-600">
                    <td className="py-0.5">en {o.moneda}</td>
                    <td className="py-0.5 text-right tabular-nums">{o.texto}</td>
                  </tr>
                ))}
                {d && d.impuesto > 0 && d.impuestoIncluido && base !== null && (
                  <tr className="text-neutral-500 text-[9pt]">
                    <td colSpan={2} className="pt-1">
                      Incluye {etiquetaImpuesto} de {fmt(d.impuesto)} (base {fmt(base)}).
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="pt-2 text-neutral-600">Abonado</td>
                  <td className="pt-2 text-right tabular-nums">{fmt(datos.abono)}</td>
                </tr>
                <tr className={`font-bold ${saldada ? "" : "text-[11.5pt]"}`}>
                  <td>{saldada ? "Estado" : "Resta por pagar"}</td>
                  <td className="text-right tabular-nums">{saldada ? "PAGADO" : fmt(restante)}</td>
                </tr>
                {!saldada &&
                  enOtras(restante).map((o) => (
                    <tr key={o.moneda} className="text-neutral-600">
                      <td className="py-0.5">en {o.moneda}</td>
                      <td className="py-0.5 text-right tabular-nums">{o.texto}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <NotaImpresa>{pie}</NotaImpresa>
          <FirmasImpresas firmas={["Entregado por", "Recibí conforme"]} />
        </HojaReporte>
      )}
    />
  );
}
