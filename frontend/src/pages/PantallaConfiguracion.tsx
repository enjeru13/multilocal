import { Fragment, useEffect, useState } from "react";
import { FaCoins, FaStore, FaSave, FaLayerGroup, FaPercent, FaPrint, FaBoxes, FaTruck, FaCashRegister, FaCalendarAlt, FaAddressCard, FaUserCheck, FaFileSignature } from "react-icons/fa";
import { SelectorHoja, SelectorRollo } from "../impresion/SelectorPapel";
import { MdSettings } from "react-icons/md";
import { toast } from "react-toastify";
import {
  formatearTasa,
  parsearTasa,
  normalizarMoneda,
  monedasActivas as monedasActivasDe,
  type Moneda,
} from "../utils/monedaHelpers";
import { configuracionService } from "../services/configuracionService";
import { useConfiguracion } from "../context/configuracionCore";
import { RUBRO_PRESETS } from "../constants/rubroPresets";
import type { Configuracion, Rubro, Terminologia } from "@lavanderia/shared/types/types";
import { FormSkeleton } from "../components/Skeleton";
import Button from "../components/ui/Button";
import SelectorMonedas from "../components/ui/SelectorMonedas";
import Interruptor from "../components/ui/Interruptor";

export default function PantallaConfiguracion() {
  const { refetch } = useConfiguracion();
  const [tasas, setTasas] = useState({ VES: "", COP: "" });
  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [monedasActivas, setMonedasActivas] = useState<Moneda[]>(["USD", "VES", "COP"]);
  const [principalBloqueada, setPrincipalBloqueada] = useState(false);
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
  const [moduloPresupuestos, setModuloPresupuestos] = useState(false);
  const [presupuestoValidezDias, setPresupuestoValidezDias] = useState("15");
  const [presupuestoCondiciones, setPresupuestoCondiciones] = useState("");
  const [moduloFechaEntrega, setModuloFechaEntrega] = useState(true);
  const [moduloClienteTipo, setModuloClienteTipo] = useState(true);
  const [clienteObligatorio, setClienteObligatorio] = useState(true);
  const [impuestoActivo, setImpuestoActivo] = useState(false);
  const [impuestoNombre, setImpuestoNombre] = useState("IVA");
  const [impuestoTasa, setImpuestoTasa] = useState("16");
  const [preciosIncluyenImpuesto, setPreciosIncluyenImpuesto] = useState(true);
  const [descuentoMaxPct, setDescuentoMaxPct] = useState("100");
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
        setMonedasActivas(monedasActivasDe(config.monedasActivas, normalizarMoneda(config.monedaPrincipal ?? "USD")));
        setPrincipalBloqueada(!!config.principalBloqueada);
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
        setModuloPresupuestos(config.moduloPresupuestos ?? false);
        setPresupuestoValidezDias(String(config.presupuestoValidezDias ?? 15));
        setPresupuestoCondiciones(config.presupuestoCondiciones ?? "");
        setModuloFechaEntrega(config.moduloFechaEntrega ?? true);
        setModuloClienteTipo(config.moduloClienteTipo ?? true);
        setClienteObligatorio(config.clienteObligatorio ?? true);
        setImpuestoActivo(config.impuestoActivo ?? false);
        setImpuestoNombre(config.impuestoNombre ?? "IVA");
        setImpuestoTasa(String(config.impuestoTasa ?? 16));
        setPreciosIncluyenImpuesto(config.preciosIncluyenImpuesto ?? true);
        setDescuentoMaxPct(String(config.descuentoMaxPct ?? 100));
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
    setModuloPresupuestos(preset.moduloPresupuestos);
    setModuloFechaEntrega(preset.moduloFechaEntrega);
    setModuloClienteTipo(preset.moduloClienteTipo);
    setClienteObligatorio(preset.clienteObligatorio);
    setTerminologia(preset.terminologia);
  };

  const guardarConfiguracion = async () => {
    const tasaImp = parseFloat(impuestoTasa.replace(",", "."));
    const maxDesc = parseFloat(descuentoMaxPct.replace(",", "."));
    if (impuestoActivo && (isNaN(tasaImp) || tasaImp < 0 || tasaImp > 100)) {
      toast.error("La tasa del impuesto debe estar entre 0 y 100.");
      return;
    }
    if (isNaN(maxDesc) || maxDesc < 0 || maxDesc > 100) {
      toast.error("El descuento máximo debe estar entre 0 y 100.");
      return;
    }
    const validez = parseInt(presupuestoValidezDias, 10);
    if (moduloPresupuestos && (isNaN(validez) || validez < 1 || validez > 365)) {
      toast.error("La validez de los presupuestos debe estar entre 1 y 365 días.");
      return;
    }
    setCargando(true);
    try {
      const principalValidada: Moneda = normalizarMoneda(monedaPrincipal);
      await configuracionService.update({
        nombreNegocio: nombreNegocio.trim() || null,
        monedaPrincipal: principalValidada,
        monedasActivas: monedasActivasDe(monedasActivas.join(","), principalValidada),
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
        moduloPresupuestos,
        ...(moduloPresupuestos ? { presupuestoValidezDias: validez } : {}),
        presupuestoCondiciones: presupuestoCondiciones.trim() || null,
        moduloFechaEntrega,
        moduloClienteTipo,
        clienteObligatorio,
        terminologia,
        impuestoActivo,
        impuestoNombre: impuestoNombre.trim() || "IVA",
        impuestoTasa: isNaN(tasaImp) ? 0 : tasaImp,
        preciosIncluyenImpuesto,
        descuentoMaxPct: maxDesc,
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
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6 sm:space-y-10">
      <header className="pb-4 border-b border-gray-200 dark:border-gray-800 sm:mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-gray-900 dark:text-gray-100">
          <MdSettings className="text-3xl sm:text-4xl shrink-0 text-indigo-600 dark:text-indigo-400" />
          Configuración del sistema
        </h1>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mt-2">
          Ajusta datos generales del negocio y tasas monetarias.
        </p>
      </header>

      <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-3 text-gray-900 dark:text-gray-100 transition-colors">
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

      <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-3 text-gray-900 dark:text-gray-100">
            <FaLayerGroup size={26} className="text-purple-500 dark:text-purple-400" />
            Rubro y módulos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Elige a qué se dedica el negocio para precargar qué está activo. Puedes ajustar cada cosa después.
          </p>
        </div>

        <div role="radiogroup" aria-label="Rubro" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.keys(RUBRO_PRESETS) as Rubro[]).map((r) => {
            const preset = RUBRO_PRESETS[r];
            const activo = rubro === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => aplicarPresetRubro(r)}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  activo
                    ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10 ring-1 ring-blue-500"
                    : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <p className="font-semibold text-gray-900 dark:text-gray-100">{preset.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{preset.descripcion}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-5 pt-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Qué controlas</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Interruptor variante="tarjeta" activo={moduloInventario} onChange={setModuloInventario} icono={<FaBoxes />} titulo="Inventario" detalle="Existencias, mínimos y movimientos." />
              <Interruptor variante="tarjeta" activo={moduloProveedores} onChange={setModuloProveedores} icono={<FaTruck />} titulo="Proveedores y compras" detalle="Reposición y cuentas por pagar." />
              <Interruptor variante="tarjeta" activo={moduloCaja} onChange={setModuloCaja} icono={<FaCashRegister />} titulo="Caja" detalle="Apertura, egresos y cierre con arqueo." />
              <Interruptor variante="tarjeta" activo={moduloFechaEntrega} onChange={setModuloFechaEntrega} icono={<FaCalendarAlt />} titulo="Fecha de entrega" detalle="Para trabajos que se entregan después." />
              <Interruptor variante="tarjeta" activo={moduloPresupuestos} onChange={setModuloPresupuestos} icono={<FaFileSignature />} titulo="Presupuestos" detalle="Cotizaciones con número y validez que se vuelven venta." />
            </div>
            {moduloPresupuestos && (
              <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-800 p-4 grid sm:grid-cols-[10rem_1fr] gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Validez (días)</label>
                  <input type="text" inputMode="numeric" value={presupuestoValidezDias} onChange={(e) => setPresupuestoValidezDias(e.target.value.replace(/D/g, ""))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 text-sm dark:text-gray-100" />
                  <p className="text-xs text-gray-400 mt-1">Cuánto dura cada presupuesto nuevo.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Condiciones que salen en cada presupuesto</label>
                  <textarea rows={3} maxLength={2000} value={presupuestoCondiciones} onChange={(e) => setPresupuestoCondiciones(e.target.value)} placeholder="Ej. Precios sujetos a disponibilidad. Se requiere 50 % de anticipo. Garantía de instalación: 3 meses." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 text-sm dark:text-gray-100 resize-y" />
                </div>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Cómo tratas a tus clientes</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Interruptor variante="tarjeta" activo={moduloClienteTipo} onChange={setModuloClienteTipo} icono={<FaAddressCard />} titulo="Ficha de cliente completa" detalle="Persona o empresa, documento y contactos." />
              <Interruptor variante="tarjeta" activo={clienteObligatorio} onChange={setClienteObligatorio} icono={<FaUserCheck />} titulo="Cliente obligatorio" detalle="Apagado, puedes vender sin registrar a nadie." />
            </div>
          </div>
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

      <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-3 text-gray-900 dark:text-gray-100 transition-colors">
          <FaPercent size={26} className="text-amber-500 dark:text-amber-400" />
          Impuestos y descuentos
        </h2>

        <Interruptor variante="tarjeta" activo={impuestoActivo} onChange={setImpuestoActivo} icono={<FaPercent />} titulo="Cobrar impuesto en las ventas" detalle="Se calcula solo en cada venta y se muestra desglosado." />

        {impuestoActivo && (
          <div className="space-y-4 pl-4 border-l-2 border-amber-300 dark:border-amber-700">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Nombre del impuesto</label>
                <input type="text" value={impuestoNombre} maxLength={20} onChange={(e) => setImpuestoNombre(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 text-sm dark:text-gray-100" placeholder="IVA" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Tasa (%)</label>
                <input type="text" inputMode="decimal" value={impuestoTasa} onChange={(e) => setImpuestoTasa(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 text-sm dark:text-gray-100" placeholder="16" />
              </div>
            </div>
            <Interruptor variante="tarjeta" activo={preciosIncluyenImpuesto} onChange={setPreciosIncluyenImpuesto} titulo="Los precios ya incluyen el impuesto" detalle="Activo: el total no cambia y el impuesto se muestra desglosado. Apagado: se suma encima del precio." />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Puedes marcar productos como exentos en su ficha. Las ventas ya hechas conservan el impuesto con que se cobraron.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 max-w-xs">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
            Descuento máximo para empleados y cajeros (%)
          </label>
          <input type="text" inputMode="decimal" value={descuentoMaxPct} onChange={(e) => setDescuentoMaxPct(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-950 text-sm dark:text-gray-100" placeholder="100" />
          <p className="text-xs text-gray-400 mt-1">Los administradores no tienen tope. 100 = sin límite.</p>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-3 text-gray-900 dark:text-gray-100 transition-colors">
          <FaCoins size={28} className="text-green-500 dark:text-green-400" />
          Monedas y tasas
        </h2>

        <SelectorMonedas
          principal={monedaPrincipal}
          activas={monedasActivas}
          tasas={tasas}
          bloqueada={principalBloqueada}
          onPrincipal={setMonedaPrincipal}
          onActivas={setMonedasActivas}
          onTasas={setTasas}
        />
      </section>

      <section className="bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800/50 space-y-5">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-3 text-gray-900 dark:text-gray-100">
            <FaPrint size={26} className="text-blue-500 dark:text-blue-400" />
            Papel de impresión
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vale solo para este equipo, porque cada computadora tiene su impresora. Se guarda al elegirlo y también puedes cambiarlo al imprimir cada reporte.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reportes en hoja</p>
            <SelectorHoja />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Rollo de la impresora térmica</p>
            <SelectorRollo />
            <p className="text-xs text-gray-500 dark:text-gray-400">Suelen ser de 58 mm o de 80 mm; si el tuyo es distinto, elige «Otro» y escribe el ancho.</p>
          </div>
        </div>
      </section>

      {/* FOOTER CON BOTÓN ACTUALIZADO */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800 max-md:sticky max-md:bottom-0 max-md:z-20 max-md:-mx-4 max-md:-mb-4 max-md:px-4 max-md:py-3 max-md:pt-3 max-md:bg-white/95 max-md:dark:bg-gray-900/95 max-md:backdrop-blur">
        <Button
          className="max-md:w-full"
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