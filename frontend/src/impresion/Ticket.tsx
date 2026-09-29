import { forwardRef } from "react";
import type { ReactNode } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useConfiguracion } from "../context/configuracionCore";
import { anchoUtilTicket, letraTicket, usePreferenciasImpresion } from "./preferencias";

dayjs.locale("es");

/**
 * Piezas para tickets de impresora térmica. Se adaptan al rollo elegido en las
 * preferencias (58 mm, 80 mm u otro): la zona imprimible y la letra escalan solas, los
 * nombres largos se parten en varias líneas y las cifras siempre quedan a la derecha.
 */

interface PapelProps {
  children: ReactNode;
}

export const TicketPapel = forwardRef<HTMLDivElement, PapelProps>(({ children }, ref) => {
  const [{ ticketMm }] = usePreferenciasImpresion();
  const util = anchoUtilTicket(ticketMm);
  const margen = (ticketMm - util) / 2;
  return (
    <div
      ref={ref}
      className="ticket-papel bg-white text-black"
      style={{
        width: `${ticketMm}mm`,
        padding: `4mm ${margen}mm 6mm`,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: `${letraTicket(ticketMm)}px`,
        lineHeight: 1.3,
      }}
    >
      {children}
    </div>
  );
});
TicketPapel.displayName = "TicketPapel";

export function TkEncabezado({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const { config } = useConfiguracion();
  const rif = config?.rif?.replace(/^RIF:?\s*/i, "");
  return (
    <div className="text-center">
      <p data-tk="texto" data-centrado data-negrita data-grande className="font-black uppercase leading-tight" style={{ fontSize: "1.25em" }}>
        {config?.nombreNegocio || "Mi negocio"}
      </p>
      {rif && (
        <p data-tk="texto" data-centrado style={{ fontSize: "0.85em" }}>
          RIF {rif}
        </p>
      )}
      {config?.direccion && (
        <p data-tk="texto" data-centrado className="leading-tight" style={{ fontSize: "0.8em" }}>
          {config.direccion}
        </p>
      )}
      {config?.telefonoPrincipal && (
        <p data-tk="texto" data-centrado style={{ fontSize: "0.85em" }}>
          WhatsApp {config.telefonoPrincipal}
        </p>
      )}
      {config?.telefonoSecundario && (
        <p data-tk="texto" data-centrado style={{ fontSize: "0.85em" }}>
          Tel. {config.telefonoSecundario}
        </p>
      )}
      <TkSeparador fuerte />
      <p data-tk="texto" data-centrado data-negrita className="font-black uppercase" style={{ fontSize: "1.05em" }}>
        {titulo}
      </p>
      {subtitulo && (
        <p data-tk="texto" data-centrado style={{ fontSize: "0.85em" }}>
          {subtitulo}
        </p>
      )}
      <p data-tk="texto" data-centrado style={{ fontSize: "0.8em" }}>
        {dayjs().format("DD/MM/YYYY hh:mm A")}
      </p>
    </div>
  );
}

export function TkSeparador({ fuerte = false }: { fuerte?: boolean }) {
  return <div data-tk="separador" data-fuerte={fuerte ? "1" : undefined} className={`my-1.5 border-t ${fuerte ? "border-t-2" : ""} border-dashed border-black`} />;
}

export function TkTitulo({ children }: { children: ReactNode }) {
  return (
    <p data-tk="texto" data-negrita data-mayus className="mt-2 mb-0.5 font-black uppercase" style={{ fontSize: "0.95em" }}>
      {children}
    </p>
  );
}

/**
 * Rótulo a la izquierda y cifra a la derecha; si el rótulo es largo, se parte sin tocar la cifra.
 * Con `apilar`, el valor va debajo del rótulo (nombres largos que no caben al lado).
 */
export function TkLinea({ etiqueta, valor, fuerte = false, sangria = false, apilar = false }: { etiqueta: ReactNode; valor?: ReactNode; fuerte?: boolean; sangria?: boolean; apilar?: boolean }) {
  if (apilar && valor !== undefined) {
    return (
      <div data-tk="linea" data-fuerte={fuerte ? "1" : undefined} data-sangria={sangria ? "1" : undefined} data-apilar="1" className={sangria ? "pl-2" : ""}>
        <p style={{ fontSize: "0.8em" }} className="uppercase leading-tight">
          {etiqueta}
        </p>
        <p className={`break-words leading-tight ${fuerte ? "font-black" : "font-bold"}`}>{valor}</p>
      </div>
    );
  }
  return (
    <div
      data-tk="linea"
      data-fuerte={fuerte ? "1" : undefined}
      data-sangria={sangria ? "1" : undefined}
      className={`flex justify-between items-baseline gap-2 ${fuerte ? "font-black" : ""} ${sangria ? "pl-2" : ""}`}
      style={fuerte ? { fontSize: "1.1em" } : undefined}
    >
      <span className="min-w-0 break-words">{etiqueta}</span>
      {valor !== undefined && <span className="shrink-0 tabular-nums text-right">{valor}</span>}
    </div>
  );
}

/** Renglón de detalle: nombre arriba, y debajo cantidad × precio y el importe. */
export function TkRenglon({ nombre, detalle, valor }: { nombre: string; detalle?: string; valor: string }) {
  return (
    <div data-tk="renglon" className="mb-1 break-inside-avoid">
      <p className="font-bold leading-tight break-words">{nombre}</p>
      <div className="flex justify-between gap-2" style={{ fontSize: "0.9em" }}>
        <span>{detalle}</span>
        <span className="tabular-nums">{valor}</span>
      </div>
    </div>
  );
}

export function TkPie({ children }: { children?: ReactNode }) {
  return (
    <div className="text-center mt-2" style={{ fontSize: "0.8em" }}>
      <TkSeparador />
      {children}
    </div>
  );
}

/** Espacio para firmar. */
export function TkFirma({ etiqueta }: { etiqueta: string }) {
  return (
    <div className="mt-8 text-center">
      <div className="border-t border-black" />
      <p data-tk="texto" data-centrado style={{ fontSize: "0.8em" }}>
        {etiqueta}
      </p>
    </div>
  );
}
