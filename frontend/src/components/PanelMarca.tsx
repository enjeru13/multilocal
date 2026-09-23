import { FaBoxes, FaCashRegister, FaChartLine, FaWifi } from "react-icons/fa";

const LEMAS: Record<string, string> = {
  LAVANDERIA: "Órdenes, entregas y cobros en un solo lugar.",
  REPUESTOS: "Inventario, ventas y compras bajo control.",
  MINIMARKET: "Vende rápido y controla tu stock y tu caja.",
  GENERICO: "Ventas, clientes y caja, simples y en orden.",
};

const PUNTOS = [
  { icono: FaCashRegister, texto: "Ventas y cobros en varias monedas" },
  { icono: FaBoxes, texto: "Inventario, proveedores y caja" },
  { icono: FaChartLine, texto: "Reportes claros de tu negocio" },
  { icono: FaWifi, texto: "Funciona sin internet, con tus datos en tu equipo" },
];

/** Panel de marca de las pantallas de acceso: sin imágenes externas, se adapta al negocio. */
export default function PanelMarca({ nombre, rubro }: { nombre: string | null; rubro: string | null }) {
  const titulo = nombre?.trim() || "Mostrador";
  const inicial = titulo.charAt(0).toUpperCase();
  const lema = LEMAS[rubro ?? "GENERICO"] ?? LEMAS.GENERICO;

  return (
    <div className="relative w-full md:w-1/2 overflow-hidden bg-linear-to-br from-blue-600 to-indigo-800 dark:from-blue-800 dark:to-indigo-950 text-white p-8 md:p-12 flex flex-col justify-between min-h-[260px]">
      <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />

      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-3xl font-black ring-1 ring-white/30">
          {inicial}
        </div>
      </div>

      <div className="relative my-8">
        <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight break-words">{titulo}</h1>
        <p className="mt-3 text-blue-100 text-lg max-w-sm">{lema}</p>
      </div>

      <ul className="relative hidden md:block space-y-3 text-sm text-blue-50/90">
        {PUNTOS.map(({ icono: Icono, texto }) => (
          <li key={texto} className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Icono />
            </span>
            {texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
