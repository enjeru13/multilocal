import { Link } from "react-router-dom";
import { useNavegacion } from "../../experiencia/navegacion";
import Kbd from "../../atajos/Kbd";

/** Accesos directos del negocio: lo que más se hace en un rubro, a un clic o una tecla. */
export default function AccesosDirectos({ compacto = false }: { compacto?: boolean }) {
  const { accesos, experiencia } = useNavegacion();
  // En la pantalla de trabajo ya estás en la recepción/venta: no se repite.
  const lista = accesos.filter((a) => (compacto ? a.to !== "/" && a.to !== "/venta" : true));
  if (lista.length === 0) return null;

  if (compacto) {
    return (
      <nav aria-label="Accesos directos" className="flex flex-wrap gap-2">
        {lista.map((a) => (
          <Link
            key={a.id}
            to={a.to}
            title={a.descripcion}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <span className="text-blue-600 dark:text-blue-400">{a.icon}</span>
            {a.label}
            {a.atajo && <Kbd combo={a.atajo} className="text-gray-400" />}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <section aria-label={`Accesos directos de ${experiencia.nombre}`}>
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Accesos directos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {lista.map((a) => (
          <Link
            key={a.id}
            to={a.to}
            className="group rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 hover:border-blue-400 hover:shadow-sm transition"
          >
            <span className="text-2xl text-blue-600 dark:text-blue-400 block mb-3">{a.icon}</span>
            <span className="block font-semibold text-gray-900 dark:text-gray-100 leading-tight">{a.label}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{a.descripcion}</span>
            {a.atajo && <Kbd combo={a.atajo} className="mt-2 text-gray-400" />}
          </Link>
        ))}
      </div>
    </section>
  );
}
