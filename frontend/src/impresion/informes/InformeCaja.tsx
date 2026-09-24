import { useMemo } from "react";
import { cajaService, type ComprobanteCaja, type DetalleCierreMoneda } from "../../services/cajaService";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import { FilaKpis, FirmasImpresas, HojaReporte, KpiImpreso, NotaImpresa, SeccionImpresa, TablaImpresa } from "../Hoja";
import { TicketPapel, TkEncabezado, TkFirma, TkLinea, TkPie, TkSeparador, TkTitulo } from "../Ticket";
import ModalImpresion from "../ModalImpresion";
import { useCarga } from "../useCarga";
import { NOMBRE_MONEDA, fechaHora } from "../etiquetas";

interface Props {
  open: boolean;
  onClose: () => void;
  sesionId: number | null;
}

function leerDetalle(json: string | null | undefined): DetalleCierreMoneda[] {
  if (!json) return [];
  try {
    const d = JSON.parse(json);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

/** Arqueo de una sesión de caja: comprobante de cierre (o arqueo parcial si sigue abierta). */
export default function ImprimirCierreCaja({ open, onClose, sesionId }: Props) {
  const { data, cargando, error } = useCarga<ComprobanteCaja>(open && sesionId !== null, () => cajaService.comprobante(sesionId!).then((r) => r.data), [sesionId]);
  const detalle = useMemo(() => leerDetalle(data?.sesion.detalleCierre), [data]);

  const cerrada = data?.sesion.estado === "CERRADA";
  const titulo = cerrada ? `Cierre de caja N.º ${data?.sesion.id}` : `Arqueo de caja N.º ${data?.sesion.id} (en curso)`;

  const c = data;
  const principal: Moneda = c?.principal ?? "USD";
  const fmt = (n: number) => formatearMoneda(n, principal);
  const quien = c?.sesion.usuarioApertura ? c.sesion.usuarioApertura.name || c.sesion.usuarioApertura.email : "—";

  const filas = (c?.porMoneda ?? []).map((f) => {
    const d = detalle.find((x) => x.moneda === f.moneda);
    return { ...f, contado: d ? d.contado : null, diferencia: d ? d.diferencia : null };
  });
  // Una moneda contada que no tuvo movimiento también aparece.
  for (const d of detalle) {
    if (!filas.some((f) => f.moneda === d.moneda)) filas.push({ moneda: d.moneda, inicial: 0, cobrado: 0, vueltos: 0, ingresos: 0, egresos: 0, esperado: d.esperado, contado: d.contado, diferencia: d.diferencia });
  }

  const diferencia = c?.sesion.diferencia ?? null;
  const tonoDif = diferencia === null ? "normal" : Math.abs(diferencia) < 0.005 ? "bueno" : "malo";
  const textoDif = (n: number, m: Moneda) => (Math.abs(n) < 0.005 ? "Cuadra" : `${n > 0 ? "Sobra" : "Falta"} ${formatearMoneda(Math.abs(n), m)}`);

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo={`Vista previa · ${cerrada ? "Cierre" : "Arqueo"} de caja`}
      documentTitle={`Caja_${sesionId ?? ""}`}
      cargando={cargando || !c}
      error={error}
      horizontal
      hoja={(ref) =>
        c && (
          <HojaReporte ref={ref} titulo={titulo} subtitulo={cerrada ? `Cerrada el ${fechaHora(c.sesion.fechaCierre)}` : "La caja sigue abierta: cifras hasta este momento"}>
            <div className="grid grid-cols-4 gap-4 text-[10pt]">
              {[
                ["Abierta por", quien],
                ["Apertura", fechaHora(c.sesion.fechaApertura)],
                ["Cierre", cerrada ? fechaHora(c.sesion.fechaCierre) : "Aún abierta"],
                ["Cobros registrados", String(c.cantidadPagos)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[8pt] font-bold uppercase tracking-wider text-neutral-500">{k}</p>
                  <p className="font-semibold">{v}</p>
                </div>
              ))}
            </div>

            <FilaKpis columnas={3}>
              <KpiImpreso titulo={`Efectivo esperado (${principal})`} valor={fmt(c.sesion.montoFinalSistema ?? c.efectivoEsperado)} nota="fondo + cobros − vueltos + ingresos − egresos" />
              <KpiImpreso titulo={`Efectivo contado (${principal})`} valor={c.sesion.montoFinalContado !== null ? fmt(c.sesion.montoFinalContado) : "—"} nota={cerrada ? "convertido a la tasa del cierre" : "aún sin contar"} />
              <KpiImpreso titulo="Diferencia" valor={diferencia === null ? "—" : textoDif(diferencia, principal)} tono={tonoDif} />
            </FilaKpis>

            <SeccionImpresa titulo="Efectivo por moneda" nota="cada moneda se cuenta por separado">
              <TablaImpresa
                clave={(f) => f.moneda}
                filas={filas}
                vacio="Sin movimientos de efectivo."
                columnas={[
                  { titulo: "Moneda", celda: (f) => <strong>{NOMBRE_MONEDA[f.moneda]}</strong> },
                  { titulo: "Fondo inicial", alinear: "right", nowrap: true, celda: (f) => formatearMoneda(f.inicial, f.moneda) },
                  { titulo: "Cobrado", alinear: "right", nowrap: true, celda: (f) => formatearMoneda(f.cobrado, f.moneda) },
                  { titulo: "Vueltos", alinear: "right", nowrap: true, celda: (f) => (f.vueltos ? `− ${formatearMoneda(f.vueltos, f.moneda)}` : "—") },
                  { titulo: "Ingresos", alinear: "right", nowrap: true, celda: (f) => (f.ingresos ? formatearMoneda(f.ingresos, f.moneda) : "—") },
                  { titulo: "Egresos", alinear: "right", nowrap: true, celda: (f) => (f.egresos ? `− ${formatearMoneda(f.egresos, f.moneda)}` : "—") },
                  { titulo: "Esperado", alinear: "right", nowrap: true, celda: (f) => <strong>{formatearMoneda(f.esperado, f.moneda)}</strong> },
                  { titulo: "Contado", alinear: "right", nowrap: true, celda: (f) => (f.contado === null ? "—" : formatearMoneda(f.contado, f.moneda)) },
                  { titulo: "Diferencia", alinear: "right", nowrap: true, celda: (f) => (f.diferencia === null ? "—" : <strong>{textoDif(f.diferencia, f.moneda)}</strong>) },
                ]}
              />
              {c.otrosMetodos > 0 && <NotaImpresa>Además se cobraron {fmt(c.otrosMetodos)} por transferencia o pago móvil; ese dinero no entra al cajón.</NotaImpresa>}
            </SeccionImpresa>

            {c.sesion.movimientos.length > 0 && (
              <SeccionImpresa titulo="Ingresos y egresos manuales">
                <TablaImpresa
                  clave={(m) => m.id}
                  filas={c.sesion.movimientos}
                  columnas={[
                    { titulo: "Hora", celda: (m) => fechaHora(m.fecha), nowrap: true },
                    { titulo: "Tipo", celda: (m) => (m.tipo === "INGRESO" ? "Ingreso" : "Egreso") },
                    { titulo: "Concepto", celda: (m) => m.concepto },
                    { titulo: "Monto", alinear: "right", nowrap: true, celda: (m) => `${m.tipo === "INGRESO" ? "+" : "−"} ${formatearMoneda(m.monto, m.moneda as Moneda)}` },
                  ]}
                />
              </SeccionImpresa>
            )}

            {c.sesion.observacionCierre && (
              <SeccionImpresa titulo="Observación">
                <p className="text-[10pt]">{c.sesion.observacionCierre}</p>
              </SeccionImpresa>
            )}

            {cerrada && <FirmasImpresas firmas={["Cajero", "Supervisor"]} />}
          </HojaReporte>
        )
      }
      ticket={(ref) =>
        c && (
          <TicketPapel ref={ref}>
            <TkEncabezado titulo={cerrada ? "Cierre de caja" : "Arqueo de caja"} subtitulo={`N.º ${c.sesion.id}`} />
            <TkSeparador />
            <TkLinea etiqueta="Abrió" valor={quien} />
            <TkLinea etiqueta="Apertura" valor={fechaHora(c.sesion.fechaApertura)} />
            <TkLinea etiqueta="Cierre" valor={cerrada ? fechaHora(c.sesion.fechaCierre) : "Abierta"} />
            <TkLinea etiqueta="Cobros" valor={String(c.cantidadPagos)} />

            {filas.map((f) => (
              <div key={f.moneda}>
                <TkTitulo>{NOMBRE_MONEDA[f.moneda]}</TkTitulo>
                <TkLinea etiqueta="Fondo inicial" valor={formatearMoneda(f.inicial, f.moneda)} />
                <TkLinea etiqueta="Cobrado" valor={formatearMoneda(f.cobrado, f.moneda)} />
                {f.vueltos > 0 && <TkLinea etiqueta="Vueltos" valor={`-${formatearMoneda(f.vueltos, f.moneda)}`} />}
                {f.ingresos > 0 && <TkLinea etiqueta="Ingresos" valor={formatearMoneda(f.ingresos, f.moneda)} />}
                {f.egresos > 0 && <TkLinea etiqueta="Egresos" valor={`-${formatearMoneda(f.egresos, f.moneda)}`} />}
                <TkLinea etiqueta="Esperado" valor={formatearMoneda(f.esperado, f.moneda)} fuerte />
                {f.contado !== null && <TkLinea etiqueta="Contado" valor={formatearMoneda(f.contado, f.moneda)} fuerte />}
                {f.diferencia !== null && <TkLinea etiqueta="Diferencia" valor={textoDif(f.diferencia, f.moneda)} />}
              </div>
            ))}

            <TkSeparador />
            <TkLinea etiqueta={`Esperado ${principal}`} valor={fmt(c.sesion.montoFinalSistema ?? c.efectivoEsperado)} />
            {c.sesion.montoFinalContado !== null && <TkLinea etiqueta={`Contado ${principal}`} valor={fmt(c.sesion.montoFinalContado)} />}
            {diferencia !== null && <TkLinea etiqueta="Diferencia" valor={textoDif(diferencia, principal)} fuerte />}
            {c.otrosMetodos > 0 && <TkLinea etiqueta="Transf./P.móvil" valor={fmt(c.otrosMetodos)} />}
            {c.sesion.observacionCierre && <p className="mt-1" style={{ fontSize: "0.85em" }}>Obs: {c.sesion.observacionCierre}</p>}
            {cerrada && <TkFirma etiqueta="Firma del cajero" />}
            <TkPie />
          </TicketPapel>
        )
      }
    />
  );
}
