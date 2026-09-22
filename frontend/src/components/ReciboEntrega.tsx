import { forwardRef } from "react";
import { formatearMoneda } from "../../../shared/src/utils/monedaHelpers";
import dayjs from "dayjs";
import "dayjs/locale/es";
import type { ReciboData as ReciboProps } from "@lavanderia/shared/types/types";

dayjs.locale("es");

const ReciboEntrega = forwardRef<HTMLDivElement, ReciboProps>(
  (
    {
      clienteInfo,
      items,
      abono,
      total,
      lavanderiaInfo,
      numeroOrden,
      observaciones,
      mensajePieRecibo,
      monedaPrincipal,
      totalCantidadPiezas,
    },
    ref
  ) => {
    const restante = Math.max(total - abono, 0);
    console.log(clienteInfo.telefono_secundario, clienteInfo.telefono)

    const formatDate = (date: string | Date | undefined | null) => {
      if (!date) return "";
      const fecha = dayjs(date);
      return fecha.isValid() ? fecha.format("DD/MM/YYYY") : "";
    };

    // Componente auxiliar para líneas de totales alineadas
    const LineaTotal = ({ label, valor, bold = false }: { label: string, valor: string | number, bold?: boolean }) => (
      <div className={`flex justify-between w-full font-mono text-xs ${bold ? 'font-black text-sm' : ''}`}>
        <span>{label}</span>
        <span>{valor}</span>
      </div>
    );

    // Separador estilo ticket (línea punteada negra)
    const Separador = () => (
      <div className="border-t-2 border-dashed border-black my-2 w-full" />
    );

    return (
      <div
        ref={ref}
        className="mx-auto bg-white text-black p-4 shadow-lg"
        style={{
          width: "80mm", // Ancho estándar de impresora térmica
          minHeight: "100mm",
          fontFamily: "'Courier New', Courier, monospace", // Fuente monoespaciada tipo ticket
        }}
      >
        {/* --- ENCABEZADO --- */}
        <div className="flex flex-col items-center text-center uppercase">
          <h1 className="text-xl font-black leading-none mb-2">
            {lavanderiaInfo.nombre}
          </h1>

          <div className="text-[10px] font-bold leading-tight space-y-0.5">
            {lavanderiaInfo.rif && <p>RIF: {lavanderiaInfo.rif}</p>}
            {lavanderiaInfo.direccion && <p>{lavanderiaInfo.direccion}</p>}

            {(lavanderiaInfo.telefonoPrincipal || lavanderiaInfo.telefonoSecundario) && (
              <div className="mt-1">
                {lavanderiaInfo.telefonoPrincipal && <p>Whatsapp: {lavanderiaInfo.telefonoPrincipal}</p>}
                {lavanderiaInfo.telefonoSecundario && <p>CANTV: {lavanderiaInfo.telefonoSecundario}</p>}
              </div>
            )}
          </div>

          {numeroOrden && (
            <div className="mt-3 mb-1">
              <span className="text-sm font-bold">N° ORDEN: </span>
              <span className="text-xl font-black">#{numeroOrden}</span>
            </div>
          )}
        </div>

        <Separador />

        {/* --- DATOS DEL CLIENTE --- */}
        <div className="text-xs font-mono uppercase leading-snug space-y-1">
          <div className="flex">
            <span className="font-bold w-24 shrink-0">CLIENTE:</span>
            <span className="truncate">{clienteInfo.nombre} {clienteInfo.apellido}</span>
          </div>
          <div className="flex">
            <span className="font-bold w-24 shrink-0">CI/RIF:</span>
            <span>{clienteInfo.identificacion}</span>
          </div>

          {/* TELÉFONO PRINCIPAL */}
          {clienteInfo.telefono && (
            <div className="flex">
              <span className="font-bold w-24 shrink-0">TELÉFONO:</span>
              <span>{clienteInfo.telefono}</span>
            </div>
          )}

          {/* TELÉFONO SECUNDARIO (Usando la propiedad exacta de types.ts) */}
          {clienteInfo.telefono_secundario && (
            <div className="flex">
              <span className="font-bold w-24 shrink-0">OTRO TEL.:</span>
              <span>{clienteInfo.telefono_secundario}</span>
            </div>
          )}

          <div className="flex">
            <span className="font-bold w-24 shrink-0">FECHA ING.:</span>
            <span>{formatDate(clienteInfo.fechaIngreso)}</span>
          </div>
          {clienteInfo.fechaEntrega && (
            <div className="flex">
              <span className="font-bold w-24 shrink-0">FECHA ENT.:</span>
              <span>{formatDate(clienteInfo.fechaEntrega)}</span>
            </div>
          )}
        </div>

        <Separador />

        {/* --- TABLA DE ITEMS --- */}
        <div className="text-xs font-mono uppercase">
          {/* Header Tabla */}
          <div className="flex font-black border-b border-black border-dashed pb-1 mb-1">
            <span className="flex-1 text-left">DESCRIPCIÓN</span>
            <span className="w-10 text-center">CANT</span>
            <span className="w-20 text-right">TOTAL</span>
          </div>

          {/* Lista Items */}
          <div className="space-y-1">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start">
                <span className="flex-1 text-left pr-1 leading-tight truncate">
                  {item.descripcion}
                </span>
                <span className="w-10 text-center font-bold">
                  {item.cantidad}
                </span>
                <span className="w-20 text-right font-bold">
                  {formatearMoneda(item.cantidad * item.precioUnitario, monedaPrincipal)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separador />

        {/* --- TOTALES --- */}
        <div className="flex flex-col gap-1 uppercase">
          <LineaTotal
            label="TOTAL PIEZAS:"
            valor={totalCantidadPiezas}
          />
          <div className="my-1 border-t border-dotted border-gray-400" />

          <LineaTotal
            label="TOTAL A PAGAR:"
            valor={formatearMoneda(total, monedaPrincipal)}
            bold
          />
          <LineaTotal
            label="ABONO:"
            valor={formatearMoneda(abono, monedaPrincipal)}
          />
          <div className="my-1 border-t border-dotted border-gray-400" />

          <div className="flex justify-between w-full font-black text-sm mt-1">
            <span>RESTA POR PAGAR:</span>
            <span>{formatearMoneda(restante, monedaPrincipal)}</span>
          </div>
        </div>

        <Separador />

        {/* --- OBSERVACIONES --- */}
        {observaciones && (
          <>
            <div className="text-xs font-mono uppercase mb-2">
              <p className="font-black underline mb-1">OBSERVACIONES:</p>
              <p className="leading-tight">{observaciones}</p>
            </div>
            <Separador />
          </>
        )}

        {/* --- PIE DE PAGINA --- */}
        <div className="text-center mt-4 uppercase">
          <p className="text-xs font-bold mb-1">¡GRACIAS POR SU PREFERENCIA!</p>

          <p className="text-[10px] leading-tight px-2 mb-2">
            {mensajePieRecibo || "* ESTE COMPROBANTE NO DA DERECHO A RECLAMO SIN TICKET *"}
          </p>

          <p className="text-[10px] font-black">
            (NO DA DERECHO A CRÉDITO FISCAL)
          </p>
        </div>
      </div>
    );
  }
);

ReciboEntrega.displayName = "ReciboEntrega";

export default ReciboEntrega;