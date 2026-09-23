import { Fragment, useEffect, useState } from "react";
import { FaCoins, FaStore, FaSave, FaLayerGroup } from "react-icons/fa";
import { MdSettings } from "react-icons/md";
import { toast } from "react-toastify";
import {
  formatearTasa,
  parsearTasa,
  normalizarMoneda,
  type Moneda,
} from "../utils/monedaHelpers";
import { configuracionService } from "../services/configuracionService";
import { useConfiguracion } from "../context/configuracionCore";
import { RUBRO_PRESETS } from "../constants/rubroPresets";
import type { Configuracion, Rubro, Terminologia } from "@lavanderia/shared/types/types";
import { FormSkeleton } from "../components/Skeleton";
import Button from "../components/ui/Button";

export default function PantallaConfiguracion() {
  const { refetch } = useConfiguracion();
  const [tasas, setTasas] = useState({ VES: "", COP: "" });
  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [rif, setRif] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefonoPrincipal, setTelefonoPrincipal] = useState("");
  const [telefonoSecundario, setTelefonoSecundario] = useState("");
  const [mensajePieRecibo, setMensajePieRecibo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [loading, setLoading] = useState(true);

  const [rubro, setRubro] = useState<Rubro>("GENERICO");
  const [moduloInventario, setModuloInventario] = useState(false);
  const [moduloProveedores, setModuloProveedores] = useState(false);
  const [moduloCaja, setModuloCaja] = useState(false);
  const [moduloFechaEntrega, setModuloFechaEntrega] = useState(true);
  const [moduloClienteTipo, setModuloClienteTipo] = useState(true);
  const [clienteObligatorio, setClienteObligatorio] = useState(true);
  const [terminologia, setTerminologia] = useState<Terminologia>(
    RUBRO_PRESETS.GENERICO.terminologia
  );

  useEffect(() => {
    async function cargarConfiguracion() {
      try {
        const res = await configuracionService.get();
        const config: Configuracion = res.data;

        setNombreNegocio(config.nombreNegocio ?? "");
        setMonedaPrincipal(normalizarMoneda(config.monedaPrincipal ?? "USD"));
        setTasas({
          VES: formatearTasa(config.tasaVES ?? ""),
          COP: formatearTasa(config.tasaCOP ?? ""),
        });
        setRif(config.rif ?? "");
        setDireccion(config.direccion ?? "");
        setTelefonoPrincipal(config.telefonoPrincipal ?? "");
        setTelefonoSecundario(config.telefonoSecundario ?? "");
        setMensajePieRecibo(config.mensajePieRecibo ?? "");

        const rubroActual = config.rubro ?? "GENERICO";
        setRubro(rubroActual);
        setModuloInventario(config.moduloInventario ?? false);
        setModuloProveedores(config.moduloProveedores ?? false);
        setModuloCaja(config.moduloCaja ?? false);
        setModuloFechaEntrega(config.moduloFechaEntrega ?? true);
        setModuloClienteTipo(config.moduloClienteTipo ?? true);
        setClienteObligatorio(config.clienteObligatorio ?? true);
        setTerminologia({
          ...RUBRO_PRESETS[rubroActual].terminologia,
          ...config.terminologia,
        });
      } catch (error) {
        console.error("Error al cargar configuración:", error);
        toast.error("Error al cargar la configuración.");
      } finally {
        setLoading(false);
      }
    }
    cargarConfiguracion();
  }, []);

  const aplicarPresetRubro = (nuevoRubro: Rubro) => {
    const preset = RUBRO_PRESETS[nuevoRubro];
    setRubro(nuevoRubro);
    setModuloInventario(preset.moduloInventario);
    setModuloProveedores(preset.moduloProveedores);
    setModuloCaja(preset.moduloCaja);
    setModuloFechaEntrega(preset.moduloFechaEntrega);
    setModuloClienteTipo(preset.moduloClienteTipo);
    setClienteObligatorio(preset.clienteObligatorio);
    setTerminologia(preset.terminologia);
  };

  const guardarConfiguracion = async () => {
    setCargando(true);
    try {
      const principalValidada: Moneda = normalizarMoneda(monedaPrincipal);
      await configuracionService.update({
        nombreNegocio: nombreNegocio.trim() || null,
        monedaPrincipal: principalValidada,
        tasaVES: parsearTasa(tasas.VES),
        tasaCOP: parsearTasa(tasas.COP),
        rif: rif.trim() || null,
        direccion: direccion.trim() || null,
        telefonoPrincipal: telefonoPrincipal.trim() || null,
        telefonoSecundario: telefonoSecundario.trim() || null,
        mensajePieRecibo: mensajePieRecibo.trim() || null,
        rubro,
        moduloInventario,
        moduloProveedores,
        moduloCaja,
        moduloFechaEntrega,
        moduloClienteTipo,
        clienteObligatorio,
        terminologia,
      });
      await refetch();
      toast.success("Configuración guardada correctamente.");
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      toast.error("Error al guardar la configuración.");
    } finally {
      setCargando(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10">
      <header className="pb-4 border-b border-gray-200 dark:border-gray-800 mb-6">
        <h1 className="text-4xl font-extrabold flex items-center gap-3 text-gray-900 dark:text-gray-100">
          <MdSettings size={36} className="text-indigo-600 dark:text-indigo-400" />
          Configuración del sistema
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
          Ajusta datos generales del negocio y tasas monetarias.
        </p>
      </header>

      <section className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-gray-100 transition-colors">
          <FaStore size={28} className="text-indigo-500 dark:text-indigo-400" />
          Información del negocio
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Nombre comercial
            </label>
            <input
              type="text"
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 shadow-sm transition duration-200"
              placeholder="Ej. Mi Negocio C.A."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              RIF
            </label>
            <input
              type="text"
              value={rif}
              onChange={(e) => setRif(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 shadow-sm transition duration-200"
              placeholder="Ej. J-12345678-9"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Dirección fiscal
            </label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 shadow-sm transition duration-200"
              placeholder="Ej. Av. Libertador, Local 5"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Teléfono principal
            </label>
            <input
              type="text"
              value={telefonoPrincipal}
              onChange={(e) => setTelefonoPrincipal(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 shadow-sm transition duration-200"
              placeholder="Ej. 0414-5551122"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Teléfono secundario
            </label>
            <input
              type="text"
              value={telefonoSecundario}
              onChange={(e) => setTelefonoSecundario(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 shadow-sm transition duration-200"
              placeholder="Ej. 0412-7773344"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Mensaje pie de recibo
            </label>
            <textarea
              value={mensajePieRecibo}
              onChange={(e) => setMensajePieRecibo(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 resize-y min-h-[100px] shadow-sm transition duration-200"
              placeholder="Ej. Gracias por su preferencia. Este ticket es indispensable para reclamos."
              rows={4}
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-gray-100">
            <FaLayerGroup size={26} className="text-purple-500 dark:text-purple-400" />
            Rubro y módulos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Elige a qué se dedica el negocio para precargar qué está activo. Puedes ajustar cada cosa después.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.keys(RUBRO_PRESETS) as Rubro[]).map((r) => {
            const preset = RUBRO_PRESETS[r];
            const activo = rubro === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => aplicarPresetRubro(r)}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  activo
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500"
                    : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <p className="font-semibold text-gray-900 dark:text-gray-100">{preset.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{preset.descripcion}</p>
              </button>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 pt-2">
          <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 py-1">
            Control de inventario/stock
            <input
              type="checkbox"
              checked={moduloInventario}
              onChange={(e) => setModuloInventario(e.target.checked)}
              className="accent-purple-600 w-5 h-5 cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 py-1">
            Proveedores y compras
            <input
              type="checkbox"
              checked={moduloProveedores}
              onChange={(e) => setModuloProveedores(e.target.checked)}
              className="accent-purple-600 w-5 h-5 cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 py-1">
            Caja (apertura/cierre)
            <input
              type="checkbox"
              checked={moduloCaja}
              onChange={(e) => setModuloCaja(e.target.checked)}
              className="accent-purple-600 w-5 h-5 cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 py-1">
            Fecha de entrega (trabajos que se entregan después)
            <input
              type="checkbox"
              checked={moduloFechaEntrega}
              onChange={(e) => setModuloFechaEntrega(e.target.checked)}
              className="accent-purple-600 w-5 h-5 cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 py-1">
            Ficha de cliente completa (natural/empresa, RIF, etc.)
            <input
              type="checkbox"
              checked={moduloClienteTipo}
              onChange={(e) => setModuloClienteTipo(e.target.checked)}
              className="accent-purple-600 w-5 h-5 cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 py-1">
            Cliente obligatorio para vender
            <input
              type="checkbox"
              checked={clienteObligatorio}
              onChange={(e) => setClienteObligatorio(e.target.checked)}
              className="accent-purple-600 w-5 h-5 cursor-pointer"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 mb-3">
            Nombres que se muestran en los menús, botones y recibos.
          </p>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-3 items-center">
            <span />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Plural</span>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Singular</span>
            {(
              [
                ["Lo que vendes", "servicio", "servicioUno"],
                ["Cada transacción", "orden", "ordenUno"],
                ["A quién le vendes", "cliente", "clienteUno"],
              ] as const
            ).map(([etiqueta, plural, singular]) => (
              <Fragment key={plural}>
                <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{etiqueta}</span>
                {[plural, singular].map((clave) => (
                  <input
                    key={clave}
                    type="text"
                    value={terminologia[clave] ?? ""}
                    onChange={(e) => setTerminologia({ ...terminologia, [clave]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 text-sm dark:text-gray-100"
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-gray-100 transition-colors">
          <FaCoins size={28} className="text-green-500 dark:text-green-400" />
          Tasas de conversión
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Moneda principal
            </label>
            <select
              value={monedaPrincipal}
              onChange={(e) =>
                setMonedaPrincipal(normalizarMoneda(e.target.value))
              }
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 shadow-sm transition duration-200"
            >
              <option value="USD">Dólares (USD)</option>
              <option value="VES">Bolívares (VES)</option>
              <option value="COP">Pesos Colombianos (COP)</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Tasa VES por USD
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={tasas.VES}
                onChange={(e) =>
                  setTasas({ ...tasas, VES: e.target.value.replace(".", ",") })
                }
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 shadow-sm transition duration-200"
                placeholder="Ej. 140,00"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Tasa COP por USD
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={tasas.COP}
                onChange={(e) =>
                  setTasas({ ...tasas, COP: e.target.value.replace(".", ",") })
                }
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base dark:text-gray-100 shadow-sm transition duration-200"
                placeholder="Ej. 4000,00"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CON BOTÓN ACTUALIZADO */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
        <Button
          onClick={guardarConfiguracion}
          isLoading={cargando}
          disabled={cargando}
          variant="primary"
          size="lg"
          leftIcon={<FaSave />}
        >
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}