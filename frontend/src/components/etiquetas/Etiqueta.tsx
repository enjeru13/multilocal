import type { FormatoEtiqueta } from "../../utils/etiquetas";
import CodigoBarras from "./CodigoBarras";

export interface DatosEtiqueta {
  nombre: string;
  codigo: string;
  precio?: string;
}

interface Props {
  formato: FormatoEtiqueta;
  datos: DatosEtiqueta;
  negocio?: string;
}

/** Una etiqueta con el tamaño real (mm): nombre, código de barras, código y precio. */
export default function Etiqueta({ formato, datos, negocio }: Props) {
  const pequena = formato.alto <= 26;
  return (
    <div
      className="etiqueta bg-white text-black overflow-hidden box-border flex flex-col justify-between"
      style={{ width: `${formato.ancho}mm`, height: `${formato.alto}mm`, padding: "1.4mm 2mm", breakInside: "avoid", pageBreakInside: "avoid" }}
    >
      <div className="leading-tight">
        {negocio && <p style={{ fontSize: "5pt" }} className="uppercase tracking-wide text-neutral-600 truncate">{negocio}</p>}
        <p className="font-bold overflow-hidden" style={{ fontSize: pequena ? "6.5pt" : "8pt", display: "-webkit-box", WebkitLineClamp: pequena ? 1 : 2, WebkitBoxOrient: "vertical", lineHeight: 1.1 }}>
          {datos.nombre}
        </p>
      </div>
      <div>
        <CodigoBarras valor={datos.codigo} alto={pequena ? 22 : 34} ancho={1.4} />
        <div className="flex items-end justify-between gap-1 mt-0.5">
          <span className="font-mono truncate" style={{ fontSize: "6pt" }}>{datos.codigo}</span>
          {datos.precio && <span className="font-extrabold whitespace-nowrap" style={{ fontSize: pequena ? "9pt" : "12pt", lineHeight: 1 }}>{datos.precio}</span>}
        </div>
      </div>
    </div>
  );
}
