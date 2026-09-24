import { useMemo } from "react";
import type { Servicio } from "@lavanderia/shared/types/types";
import { servicioService } from "../../services/serviciosService";
import { formatearMoneda, type Moneda } from "../../utils/monedaHelpers";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";
import { FilaKpis, HojaReporte, KpiImpreso, NotaImpresa, SeccionImpresa, TablaImpresa } from "../Hoja";
import { TicketPapel, TkEncabezado, TkLinea, TkPie, TkRenglon, TkSeparador } from "../Ticket";
import ModalImpresion from "../ModalImpresion";
import { useCarga } from "../useCarga";

export type ModoInventario = "existencias" | "reposicion";

interface Props {
  open: boolean;
  onClose: () => void;
  modo: ModoInventario;
}

const num = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 2 });
const bajo = (s: Servicio) => s.stockMinimo !== null && s.stockActual <= s.stockMinimo;

/**
 * Inventario para imprimir: las existencias con su valor, o la lista de reposición
 * (lo que está en el mínimo o debajo) con un espacio para anotar cuánto pedir.
 */
export default function ImprimirInventario({ open, onClose, modo }: Props) {
  const et = useEtiquetas();
  const { config } = useConfiguracion();
  const moneda = (config?.monedaPrincipal ?? "USD") as Moneda;
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const { data, cargando, error } = useCarga<Servicio[]>(open, () => servicioService.getAll().then((r) => r.data.filter((s) => s.controlaStock)));

  const items = useMemo(() => [...(data ?? [])].sort((a, b) => (a.categoria?.nombre ?? "").localeCompare(b.categoria?.nombre ?? "") || a.nombreServicio.localeCompare(b.nombreServicio)), [data]);
  const aReponer = useMemo(() => items.filter(bajo).sort((a, b) => a.stockActual - (a.stockMinimo ?? 0) - (b.stockActual - (b.stockMinimo ?? 0))), [items]);

  const unidades = items.reduce((s, i) => s + Math.max(i.stockActual, 0), 0);
  const valorCosto = items.reduce((s, i) => s + Math.max(i.stockActual, 0) * (i.costoBase ?? 0), 0);
  const valorVenta = items.reduce((s, i) => s + Math.max(i.stockActual, 0) * i.precioBase, 0);
  const sinCosto = items.filter((i) => i.costoBase === null && i.stockActual > 0).length;
  const faltan = (s: Servicio) => Math.max(0, (s.stockMinimo ?? 0) - s.stockActual);

  const esReposicion = modo === "reposicion";

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo={esReposicion ? "Vista previa · Lista de reposición" : "Vista previa · Inventario"}
      documentTitle={`${esReposicion ? "Reposicion" : "Inventario"}_${new Date().toISOString().slice(0, 10)}`}
      cargando={cargando || !data}
      error={error}
      hoja={(ref) =>
        data &&
        (esReposicion ? (
          <HojaReporte ref={ref} titulo="Lista de reposición" subtitulo={`${aReponer.length} ${aReponer.length === 1 ? et.servicioMin : et.serviciosMin} en el mínimo o por debajo`}>
            <TablaImpresa
              clave={(s) => s.id}
              filas={aReponer}
              vacio="Nada por reponer: todo está sobre su mínimo."
              columnas={[
                { titulo: et.servicio, celda: (s) => <><strong>{s.nombreServicio}</strong>{s.categoria && <span className="text-neutral-500"> · {s.categoria.nombre}</span>}</> },
                { titulo: "Código", celda: (s) => s.sku || s.codigoBarras || "—" },
                { titulo: "Hay", alinear: "right", celda: (s) => <strong>{num(s.stockActual)}</strong> },
                { titulo: "Mínimo", alinear: "right", celda: (s) => num(s.stockMinimo ?? 0) },
                { titulo: "Faltan", alinear: "right", celda: (s) => num(faltan(s)) },
                { titulo: "Costo unit.", alinear: "right", nowrap: true, celda: (s) => (s.costoBase === null ? "—" : fmt(s.costoBase)) },
                { titulo: "Pedir", ancho: "16%", celda: () => <span className="block border-b border-neutral-500 h-4" /> },
              ]}
            />
            <NotaImpresa>«Faltan» es lo que necesitas para volver al mínimo; anota en «Pedir» cuánto vas a comprar.</NotaImpresa>
          </HojaReporte>
        ) : (
          <HojaReporte ref={ref} titulo="Inventario" subtitulo={`${items.length} ${items.length === 1 ? et.servicioMin : et.serviciosMin} con control de existencias · valores en ${moneda}`}>
            <FilaKpis>
              <KpiImpreso titulo={et.servicios} valor={String(items.length)} nota={`${num(unidades)} unidades`} />
              <KpiImpreso titulo="Valor a costo" valor={fmt(valorCosto)} nota={sinCosto > 0 ? `${sinCosto} sin costo registrado` : undefined} />
              <KpiImpreso titulo="Valor a precio de venta" valor={fmt(valorVenta)} />
              <KpiImpreso titulo="Por reponer" valor={String(aReponer.length)} tono={aReponer.length > 0 ? "malo" : "normal"} nota="en el mínimo o debajo" />
            </FilaKpis>
            <SeccionImpresa titulo="Existencias">
              <TablaImpresa
                clave={(s) => s.id}
                filas={items}
                vacio="No hay productos con control de existencias."
                columnas={[
                  { titulo: et.servicio, celda: (s) => <strong>{s.nombreServicio}</strong> },
                  { titulo: "Categoría", celda: (s) => s.categoria?.nombre ?? "—" },
                  { titulo: "Código", celda: (s) => s.sku || s.codigoBarras || "—" },
                  { titulo: "Existencia", alinear: "right", celda: (s) => (bajo(s) ? <strong>{num(s.stockActual)} ▼</strong> : num(s.stockActual)), total: num(unidades) },
                  { titulo: "Mínimo", alinear: "right", celda: (s) => (s.stockMinimo === null ? "—" : num(s.stockMinimo)) },
                  { titulo: "Costo", alinear: "right", nowrap: true, celda: (s) => (s.costoBase === null ? "—" : fmt(s.costoBase)) },
                  { titulo: "Precio", alinear: "right", nowrap: true, celda: (s) => fmt(s.precioBase) },
                  { titulo: "Valor a costo", alinear: "right", nowrap: true, celda: (s) => (s.costoBase === null ? "—" : fmt(Math.max(s.stockActual, 0) * s.costoBase)), total: fmt(valorCosto) },
                ]}
              />
              <NotaImpresa>▼ indica que la existencia está en el mínimo o por debajo.</NotaImpresa>
            </SeccionImpresa>
          </HojaReporte>
        ))
      }
      ticket={
        esReposicion
          ? (ref) => (
              <TicketPapel ref={ref}>
                <TkEncabezado titulo="Reposición" subtitulo={`${aReponer.length} por pedir`} />
                <TkSeparador />
                {aReponer.length === 0 && <p className="text-center">Nada por reponer.</p>}
                {aReponer.map((s) => (
                  <TkRenglon key={s.id} nombre={s.nombreServicio} detalle={`Hay ${num(s.stockActual)} · mín. ${num(s.stockMinimo ?? 0)}`} valor="Pedir ____" />
                ))}
                <TkLinea etiqueta="Total artículos" valor={String(aReponer.length)} fuerte />
                <TkPie />
              </TicketPapel>
            )
          : undefined
      }
    />
  );
}
