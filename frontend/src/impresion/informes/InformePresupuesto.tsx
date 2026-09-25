import type { Presupuesto } from "@lavanderia/shared/types/types";
import { convertirDesdePrincipal, formatearMoneda } from "../../utils/monedaHelpers";
import { destinatarioPresupuesto, telefonoPresupuesto } from "../../utils/presupuestoHelpers";
import { useConfiguracion } from "../../context/configuracionCore";
import { useMonedas } from "../../context/useMonedas";
import { FirmasImpresas, HojaReporte, NotaImpresa, TablaImpresa } from "../Hoja";
import ModalImpresion from "../ModalImpresion";
import { fecha } from "../etiquetas";

interface Props {
  open: boolean;
  onClose: () => void;
  presupuesto: Presupuesto | null;
}

/** El presupuesto como documento para entregar al cliente: datos, líneas, totales, condiciones y firma. */
export default function ImprimirPresupuesto({ open, onClose, presupuesto: p }: Props) {
  const { config } = useConfiguracion();
  const negocio = useMonedas();
  const moneda = negocio.principal;
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const nombreImpuesto = config?.impuestoNombre || "IVA";

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo={`Vista previa · Presupuesto N.º ${p?.id ?? ""}`}
      documentTitle={`Presupuesto_${p?.id ?? ""}`}
      cargando={!p}
      hoja={(ref) =>
        p && (
          <HojaReporte ref={ref} titulo={`Presupuesto N.º ${p.id}`} subtitulo={`Emitido el ${fecha(p.fecha)} · Válido hasta el ${fecha(p.validoHasta)}`}>
            <div className="grid grid-cols-2 gap-8 text-[10pt]">
              <div>
                <p className="text-[8pt] font-bold uppercase tracking-wider text-neutral-500 mb-1">Para</p>
                <p className="font-bold text-[11pt]">{destinatarioPresupuesto(p)}</p>
                {p.cliente?.identificacion && <p>CI/RIF {p.cliente.identificacion}</p>}
                {telefonoPresupuesto(p) && <p>Tel. {telefonoPresupuesto(p)}</p>}
                {p.cliente?.direccion && <p>{p.cliente.direccion}</p>}
              </div>
              <div className="text-right">
                <p className="text-[8pt] font-bold uppercase tracking-wider text-neutral-500 mb-1">Datos</p>
                <p>Presupuesto N.º {p.id}</p>
                <p>Fecha: {fecha(p.fecha)}</p>
                <p>Válido hasta: {fecha(p.validoHasta)}</p>
                {p.userName && <p>Atendió: {p.userName}</p>}
              </div>
            </div>

            <TablaImpresa
              filas={p.detalles ?? []}
              clave={(d) => d.id}
              columnas={[
                { titulo: "Descripción", celda: (d) => d.descripcion },
                { titulo: "Cant.", alinear: "right", ancho: "9%", nowrap: true, celda: (d) => d.cantidad.toLocaleString("es", { maximumFractionDigits: 3 }) },
                { titulo: "Precio", alinear: "right", ancho: "17%", nowrap: true, celda: (d) => fmt(d.precioUnit) },
                { titulo: "Importe", alinear: "right", ancho: "17%", nowrap: true, celda: (d) => fmt(d.subtotal) },
              ]}
            />

            <div className="flex justify-end break-inside-avoid">
              <table className="text-[10pt] min-w-[55%]">
                <tbody>
                  <tr>
                    <td className="py-0.5 pr-8">Subtotal</td>
                    <td className="py-0.5 text-right tabular-nums">{fmt(p.subtotal)}</td>
                  </tr>
                  {p.descuento > 0 && (
                    <tr>
                      <td className="py-0.5 pr-8">Descuento{p.descuentoTipo === "PORCENTAJE" && p.descuentoValor ? ` (${p.descuentoValor}%)` : ""}</td>
                      <td className="py-0.5 text-right tabular-nums">− {fmt(p.descuento)}</td>
                    </tr>
                  )}
                  {p.impuesto > 0 && (
                    <tr>
                      <td className="py-0.5 pr-8">
                        {nombreImpuesto}
                        {p.impuestoTasa ? ` ${p.impuestoTasa}%` : ""}
                        {config?.preciosIncluyenImpuesto ? " (incluido)" : ""}
                      </td>
                      <td className="py-0.5 text-right tabular-nums">{fmt(p.impuesto)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-neutral-800 font-extrabold text-[12pt]">
                    <td className="pt-1.5 pr-8">TOTAL</td>
                    <td className="pt-1.5 text-right tabular-nums">{fmt(p.total)}</td>
                  </tr>
                  {negocio.otrasUsables.map((m) => (
                    <tr key={m} className="text-neutral-600">
                      <td className="py-0.5 pr-8">en {m}</td>
                      <td className="py-0.5 text-right tabular-nums">{formatearMoneda(convertirDesdePrincipal(p.total, m, negocio.tasas, moneda), m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {p.observaciones && (
              <div className="break-inside-avoid">
                <p className="text-[8pt] font-bold uppercase tracking-wider text-neutral-500 mb-1">Observaciones</p>
                <p className="whitespace-pre-wrap wrap-break-word">{p.observaciones}</p>
              </div>
            )}
            {p.condiciones && (
              <div className="break-inside-avoid">
                <p className="text-[8pt] font-bold uppercase tracking-wider text-neutral-500 mb-1">Condiciones</p>
                <p className="whitespace-pre-wrap wrap-break-word text-[9.5pt]">{p.condiciones}</p>
              </div>
            )}

            <NotaImpresa>
              Este presupuesto es una oferta válida hasta el {fecha(p.validoHasta)}; los precios pueden variar después de esa fecha. Documento no fiscal: no es una factura.
              {negocio.otrasUsables.length > 0 && " Los importes en otras monedas se calculan con la tasa del día en que se imprimió."}
            </NotaImpresa>
            <FirmasImpresas firmas={["Por el negocio", "Acepto el presupuesto (firma y fecha)"]} />
          </HojaReporte>
        )
      }
    />
  );
}
