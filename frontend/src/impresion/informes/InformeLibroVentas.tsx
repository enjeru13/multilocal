import { useEffect, useState } from "react";
import { FaDownload } from "react-icons/fa";
import type { FilaLibroVentas, LibroVentas, Moneda } from "@lavanderia/shared/types/types";
import { reportesService } from "../../services/reportesService";
import { formatearMoneda } from "../../utils/monedaHelpers";
import { exportarLibroVentasCsv } from "../../utils/libroVentasCsv";
import { useMonedas } from "../../context/useMonedas";
import Button from "../../components/ui/Button";
import { Segmentado } from "../../components/ui/Formulario";
import { FilaKpis, HojaReporte, KpiImpreso, NotaImpresa, TablaImpresa } from "../Hoja";
import ModalImpresion from "../ModalImpresion";
import { useCarga } from "../useCarga";
import { fecha, textoPeriodo } from "../etiquetas";

interface Props {
  open: boolean;
  onClose: () => void;
  desde: string;
  hasta: string;
}

/**
 * Libro de ventas del periodo: cada venta con su exento, base imponible e IVA, listo para
 * imprimir o llevar a Excel. Por defecto en bolívares si el negocio los usa, que es como
 * se declara en Venezuela.
 */
export default function ImprimirLibroVentas({ open, onClose, desde, hasta }: Props) {
  const negocio = useMonedas();
  const [moneda, setMoneda] = useState<Moneda>(negocio.principal);

  // Al abrir, propone bolívares si se pueden usar; luego se puede cambiar.
  useEffect(() => {
    if (open) setMoneda(negocio.usables.includes("VES") ? "VES" : negocio.principal);
  }, [open, negocio.usables, negocio.principal]);

  const { data: d, cargando, error } = useCarga<LibroVentas>(open, () => reportesService.libroVentas(desde, hasta, moneda).then((r) => r.data), [desde, hasta, moneda]);
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const convertido = !!d && d.moneda !== d.principal;
  const tasaTexto = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 4 });

  const controles = (
    <>
      {negocio.usables.length > 1 && (
        <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
          Moneda
          <Segmentado ariaLabel="Moneda del libro" valor={moneda} onChange={setMoneda} opciones={negocio.usables.map((m) => ({ id: m, label: m }))} />
        </label>
      )}
      <Button variant="secondary" size="sm" leftIcon={<FaDownload />} disabled={!d || cargando} onClick={() => d && exportarLibroVentasCsv(d)}>
        Exportar CSV
      </Button>
    </>
  );

  return (
    <ModalImpresion
      open={open}
      onClose={onClose}
      titulo="Vista previa · Libro de ventas"
      documentTitle={`Libro_de_ventas_${desde}_${hasta}`}
      horizontal
      controles={controles}
      cargando={cargando || !d}
      error={error}
      hoja={(ref) =>
        d && (
          <HojaReporte
            ref={ref}
            titulo="Libro de ventas"
            subtitulo={`${textoPeriodo(d.desde, d.hasta)} · importes en ${d.moneda}`}
            filtros={[d.contribuyente.rif ? `RIF ${d.contribuyente.rif.replace(/^RIF:?\s*/i, "")}` : "Sin RIF registrado en Configuración"]}
          >
            <FilaKpis>
              <KpiImpreso titulo="Ventas" valor={String(d.filas.length)} nota={d.anuladas > 0 ? `${d.anuladas} anulada(s) no incluidas` : undefined} />
              <KpiImpreso titulo="Total con IVA" valor={fmt(d.totales.total)} />
              <KpiImpreso titulo="Base imponible" valor={fmt(d.totales.baseImponible)} />
              <KpiImpreso titulo="IVA" valor={fmt(d.totales.iva)} />
            </FilaKpis>

            <TablaImpresa
              filas={d.filas}
              clave={(f) => f.id}
              vacio="No hay ventas en este periodo."
              columnas={[
                { titulo: "N.º", ancho: "5%", celda: (_f, i) => i + 1 },
                { titulo: "Fecha", ancho: "9%", nowrap: true, celda: (f) => fecha(f.fecha) },
                {
                  titulo: "Cliente",
                  celda: (f) => (
                    <>
                      {f.cliente}
                      {f.conDevolucion && <span className="block text-[8pt] text-neutral-500">Neto de devolución</span>}
                    </>
                  ),
                },
                { titulo: "RIF / cédula", ancho: "12%", nowrap: true, celda: (f) => f.identificacion ?? "—" },
                { titulo: "Venta", ancho: "7%", nowrap: true, celda: (f) => `#${f.id}`, total: "Totales" },
                { titulo: "Total con IVA", alinear: "right", nowrap: true, celda: (f) => fmt(f.total), total: fmt(d.totales.total) },
                { titulo: "Exento", alinear: "right", nowrap: true, celda: (f) => fmt(f.exento), total: fmt(d.totales.exento) },
                { titulo: "Base imponible", alinear: "right", nowrap: true, celda: (f) => fmt(f.baseImponible), total: fmt(d.totales.baseImponible) },
                { titulo: "%", alinear: "right", ancho: "5%", celda: (f) => (f.alicuota ? `${f.alicuota}` : "—") },
                { titulo: "IVA", alinear: "right", nowrap: true, celda: (f) => fmt(f.iva), total: fmt(d.totales.iva) },
                ...(convertido
                  ? [{ titulo: `Tasa (${d.moneda}/${d.principal})`, alinear: "right" as const, nowrap: true, celda: (f: FilaLibroVentas) => `${tasaTexto(f.tasa)}${f.tasaDelDia ? "" : " *"}` }]
                  : []),
              ]}
            />

            <NotaImpresa>
              Cada venta aparece con lo que vale tras sus devoluciones.
              {convertido && ` Cada venta se convirtió de ${d.principal} a ${d.moneda} con la tasa que había el día en que se hizo (última columna).`}
              {d.conTasaActual > 0 && ` * ${d.conTasaActual} venta(s) son anteriores a que el sistema guardara la tasa y se convirtieron con la tasa actual.`}{" "}
              Este listado sale de las ventas del sistema y no sustituye las facturas fiscales: confírmalo con tu contador antes de usarlo en una declaración.
            </NotaImpresa>
          </HojaReporte>
        )
      }
    />
  );
}
