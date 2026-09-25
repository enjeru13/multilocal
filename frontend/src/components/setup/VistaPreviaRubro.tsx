import type { Configuracion, Rubro, Terminologia } from "@lavanderia/shared/types/types";
import { experienciaDe, type ModoVenta } from "../../experiencia/experiencias";
import { construirItemNav } from "../../experiencia/navegacion";
import Kbd from "../../atajos/Kbd";

interface Props {
  rubro: Rubro;
  nombre: string;
  terminologia: Required<Terminologia>;
  moduloInventario: boolean;
  moduloProveedores: boolean;
  moduloCaja: boolean;
  moduloPresupuestos?: boolean;
  moduloFechaEntrega: boolean;
}

type Esquema = ModoVenta | "MOSTRADOR";

const PUNTOS: Record<Esquema, { abre: string; vende: string; teclas: string[] }> = {
  CAJA: {
    abre: "Directo en la caja, a pantalla completa",
    vende: "Escaneas, cobras con una tecla y dejas ventas en espera",
    teclas: ["F2", "F8", "F9"],
  },
  FACTURA: {
    abre: "Directo en la facturación",
    vende: "Buscas en el catálogo, ajustas el precio de cada línea y guardas cotizaciones",
    teclas: ["F2", "F5", "F9"],
  },
  RECEPCION: {
    abre: "En la recepción de órdenes, con un tablero para seguirlas",
    vende: "Recibes, avisas cuando está listo y entregas por número",
    teclas: ["Alt+N", "Alt+T", "F2"],
  },
  MOSTRADOR: {
    abre: "Directo en la pantalla de venta",
    vende: "Eliges productos, aplicas descuento y cobras al momento",
    teclas: ["Alt+V", "Ctrl+K", "?"],
  },
};

const Barra = ({ ancho = "w-full", alto = "h-2", tono = "bg-gray-200 dark:bg-gray-700" }: { ancho?: string; alto?: string; tono?: string }) => (
  <div className={`${ancho} ${alto} rounded-full ${tono}`} />
);

function Esbozo({ esquema }: { esquema: Esquema }) {
  if (esquema === "CAJA") {
    return (
      <div className="flex-1 p-2.5 grid grid-cols-[1fr_5.5rem] gap-2 min-w-0">
        <div className="space-y-1.5">
          <div className="h-5 rounded border-2 border-blue-500" />
          {[70, 55, 80].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <Barra ancho="w-4" />
              <div className="h-2 rounded-full bg-gray-300 dark:bg-gray-600" style={{ width: `${w}%` }} />
              <div className="ml-auto w-8"><Barra tono="bg-blue-300 dark:bg-blue-800" /></div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="h-6 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-end px-1.5 text-[10px] font-extrabold text-gray-800 dark:text-gray-100">$ 0.00</div>
          <div className="h-5 rounded bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">Cobrar F9</div>
        </div>
      </div>
    );
  }
  if (esquema === "FACTURA") {
    return (
      <div className="flex-1 p-2.5 space-y-1.5 min-w-0">
        <div className="h-5 rounded border-2 border-blue-500" />
        <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex items-center gap-2 px-1.5 py-1 ${i === 0 ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
              <Barra ancho="w-8" />
              <Barra ancho="w-1/3" tono="bg-gray-300 dark:bg-gray-600" />
              <div className="ml-auto h-3.5 w-9 rounded border border-amber-400" />
              <div className="h-3.5 w-8 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (esquema === "RECEPCION") {
    return (
      <div className="flex-1 p-2.5 grid grid-cols-3 gap-1.5 min-w-0">
        {[
          ["bg-amber-500", 3],
          ["bg-emerald-500", 2],
          ["bg-slate-400", 1],
        ].map(([color, n], c) => (
          <div key={c} className="rounded bg-gray-100 dark:bg-gray-800 p-1 space-y-1">
            <div className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${color}`} /><Barra ancho="w-2/3" /></div>
            {Array.from({ length: n as number }).map((_, i) => (
              <div key={i} className="rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1 space-y-1">
                <Barra ancho="w-1/2" tono="bg-blue-300 dark:bg-blue-800" />
                <Barra />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex-1 p-2.5 grid grid-cols-[1fr_5rem] gap-2 min-w-0">
      <div className="grid grid-cols-3 gap-1.5 content-start">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded border border-gray-200 dark:border-gray-700 p-1 space-y-1">
            <Barra ancho="w-3/4" tono="bg-gray-300 dark:bg-gray-600" />
            <Barra ancho="w-1/3" tono="bg-blue-300 dark:bg-blue-800" />
          </div>
        ))}
      </div>
      <div className="rounded border border-gray-200 dark:border-gray-700 p-1.5 space-y-1.5">
        <Barra /><Barra ancho="w-2/3" />
        <div className="h-5 rounded bg-blue-600" />
      </div>
    </div>
  );
}

/**
 * Vista previa del asistente: muestra cómo se va a sentir el sistema con el
 * rubro elegido (menú, pantalla de inicio, forma de vender y atajos).
 */
export default function VistaPreviaRubro({ rubro, nombre, terminologia, moduloInventario, moduloProveedores, moduloCaja, moduloPresupuestos, moduloFechaEntrega }: Props) {
  const experiencia = experienciaDe(rubro);
  const esquema: Esquema = !moduloFechaEntrega && experiencia.modoVenta === "RECEPCION" ? "MOSTRADOR" : experiencia.modoVenta;
  const t = (k: "orden" | "servicio" | "cliente") => terminologia[k];

  // Se arma con las mismas reglas que el menú real, como si entrara el administrador.
  const config = { rubro, moduloInventario, moduloProveedores, moduloCaja, moduloPresupuestos, moduloFechaEntrega } as Configuracion;
  const items = experiencia.secciones
    .flatMap((s) => s.items)
    .map((id) => construirItemNav(id, { experiencia, config, t, hasRole: () => true }))
    .filter((i) => i !== null)
    .filter((i) => !["configuracion", "usuarios", "respaldos"].includes(i.id))
    .slice(0, 8);

  const puntos = PUNTOS[esquema];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Así se sentirá</p>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
          {experiencia.nombre}
        </span>
      </div>

      <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-36">
        <div className="w-28 shrink-0 bg-slate-900 p-2 space-y-1 overflow-hidden">
          <p className="text-[9px] font-bold text-slate-300 truncate mb-1.5">{nombre.trim() || "Tu negocio"}</p>
          {items.map((i, idx) => (
            <div key={i.id} className={`flex items-center gap-1 rounded px-1 py-0.5 text-[9px] ${idx === 0 ? "bg-blue-500/20 text-white" : "text-slate-400"}`}>
              <span className="text-[9px]">{i.icon}</span>
              <span className="truncate">{i.label}</span>
            </div>
          ))}
        </div>
        <Esbozo esquema={esquema} />
      </div>

      <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
        <li><strong className="text-gray-800 dark:text-gray-200">Al entrar:</strong> {puntos.abre}.</li>
        <li><strong className="text-gray-800 dark:text-gray-200">Atender:</strong> {puntos.vende}.</li>
        <li className="flex items-center gap-1.5 flex-wrap">
          <strong className="text-gray-800 dark:text-gray-200">Atajos:</strong>
          {puntos.teclas.map((k) => (
            <Kbd key={k} combo={k} className="text-gray-500" />
          ))}
          <span>y <Kbd combo="Ctrl+K" className="text-gray-500" /> para buscar cualquier cosa.</span>
        </li>
      </ul>
    </div>
  );
}
