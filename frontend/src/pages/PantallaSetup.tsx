import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FaUserShield,
  FaStore,
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
  FaTshirt,
  FaCogs,
  FaShoppingBasket,
  FaCoins,
  FaBoxes,
  FaTruck,
  FaCashRegister,
  FaCalendarAlt,
  FaAddressCard,
  FaUserCheck,
  FaPercent,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/configuracionCore";
import { authService } from "../services/authService";
import { configuracionService } from "../services/configuracionService";
import { RUBRO_PRESETS } from "../constants/rubroPresets";
import { experienciaDe } from "../experiencia/experiencias";
import { parsearTasa, monedasActivas as monedasActivasDe } from "../utils/monedaHelpers";
import type { Moneda, Rubro, Terminologia } from "@lavanderia/shared/types/types";
import Button from "../components/ui/Button";
import Interruptor from "../components/ui/Interruptor";
import { Campo, campo } from "../components/ui/Formulario";
import SelectorMonedas from "../components/ui/SelectorMonedas";
import PanelMarca from "../components/PanelMarca";
import SelectorTema from "../components/ui/SelectorTema";
import VistaPreviaRubro from "../components/setup/VistaPreviaRubro";

const ICONOS: Record<Rubro, IconType> = {
  LAVANDERIA: FaTshirt,
  REPUESTOS: FaCogs,
  MINIMARKET: FaShoppingBasket,
  GENERICO: FaStore,
};

const PASOS = [
  { titulo: "Tu cuenta", corto: "Cuenta" },
  { titulo: "Tu negocio", corto: "Negocio" },
  { titulo: "Dinero y módulos", corto: "Dinero" },
] as const;

/** Encabezado de cada paso: recuadro con icono, título y una línea que explica para qué sirve. */
function EncabezadoPaso({ icono, titulo, detalle }: { icono: ReactNode; titulo: string; detalle: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shrink-0">{icono}</span>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{titulo}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{detalle}</p>
      </div>
    </div>
  );
}

/** Bloque con título, explicación y contenido: separa las decisiones de cada paso. */
function Bloque({ titulo, detalle, opcional, children }: { titulo: string; detalle?: string; opcional?: boolean; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{titulo}</h3>
          {detalle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{detalle}</p>}
        </div>
        {opcional && <span className="text-[11px] text-gray-400 shrink-0">Opcional</span>}
      </div>
      {children}
    </section>
  );
}

// Primer arranque: no hay usuarios ni perfil de negocio. Se crea la cuenta
// administradora, se elige el rubro viendo cómo se sentirá el sistema y se
// dejan listos moneda, impuesto y módulos, todo antes de entrar por primera vez.
export default function PantallaSetup() {
  const { login } = useAuth();
  const { refetch } = useConfiguracion();
  const navigate = useNavigate();
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  const [enviando, setEnviando] = useState(false);

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Paso 2
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [rubro, setRubro] = useState<Rubro | null>(null);
  const [rif, setRif] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");

  // Paso 3
  const preset = RUBRO_PRESETS[rubro ?? "GENERICO"];
  const [moduloInventario, setModuloInventario] = useState(false);
  const [moduloProveedores, setModuloProveedores] = useState(false);
  const [moduloCaja, setModuloCaja] = useState(false);
  const [moduloFechaEntrega, setModuloFechaEntrega] = useState(true);
  const [moduloClienteTipo, setModuloClienteTipo] = useState(true);
  const [clienteObligatorio, setClienteObligatorio] = useState(true);
  const [terminologia, setTerminologia] = useState<Required<Terminologia>>(RUBRO_PRESETS.GENERICO.terminologia);
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [monedasActivas, setMonedasActivas] = useState<Moneda[]>(["USD", "VES", "COP"]);
  const [tasaVES, setTasaVES] = useState("");
  const [tasaCOP, setTasaCOP] = useState("");
  const [impuestoActivo, setImpuestoActivo] = useState(false);
  const [impuestoNombre, setImpuestoNombre] = useState("IVA");
  const [impuestoTasa, setImpuestoTasa] = useState("16");
  const [preciosIncluyen, setPreciosIncluyen] = useState(true);

  const elegirRubro = (r: Rubro) => {
    const p = RUBRO_PRESETS[r];
    setRubro(r);
    setModuloInventario(p.moduloInventario);
    setModuloProveedores(p.moduloProveedores);
    setModuloCaja(p.moduloCaja);
    setModuloFechaEntrega(p.moduloFechaEntrega);
    setModuloClienteTipo(p.moduloClienteTipo);
    setClienteObligatorio(p.clienteObligatorio);
    setTerminologia(p.terminologia);
  };

  // El color de la pantalla ya es el del rubro elegido: se siente desde el primer paso.
  const acento = experienciaDe(rubro ?? "GENERICO").acento;
  useEffect(() => {
    document.documentElement.dataset.acento = acento;
    return () => {
      delete document.documentElement.dataset.acento;
    };
  }, [acento]);

  const emailValido = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);

  const avanzar = () => {
    if (paso === 0) {
      if (!nombre.trim() || !email.trim() || !password) return toast.error("Completa nombre, correo y contraseña.");
      if (!emailValido) return toast.error("El correo no tiene un formato válido.");
      if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
      if (password !== confirmPassword) return toast.error("Las contraseñas no coinciden.");
      return setPaso(1);
    }
    if (paso === 1) {
      if (!nombreNegocio.trim()) return toast.error("Indica el nombre del negocio.");
      if (!rubro) return toast.error("Elige a qué se dedica el negocio.");
      return setPaso(2);
    }
  };

  const finalizar = async () => {
    if (!rubro) return;
    const tasaImp = parseFloat(impuestoTasa.replace(",", "."));
    if (impuestoActivo && (isNaN(tasaImp) || tasaImp < 0 || tasaImp > 100)) {
      return toast.error("La tasa del impuesto debe estar entre 0 y 100.");
    }
    setEnviando(true);
    try {
      await authService.register({
        name: nombre.trim(),
        email: email.trim(),
        password,
        role: "ADMIN",
      });

      const loginOk = await login({ email: email.trim(), password });
      if (!loginOk) {
        toast.error("Cuenta creada, pero el inicio de sesión automático falló. Inicia sesión manualmente.");
        navigate("/login");
        return;
      }

      await configuracionService.update({
        nombreNegocio: nombreNegocio.trim(),
        monedaPrincipal: moneda,
        monedasActivas: monedasActivasDe(monedasActivas.join(","), moneda),
        tasaVES: parsearTasa(tasaVES),
        tasaCOP: parsearTasa(tasaCOP),
        rif: rif.trim() || null,
        direccion: direccion.trim() || null,
        telefonoPrincipal: telefono.trim() || null,
        rubro,
        moduloInventario,
        moduloProveedores,
        moduloCaja,
        moduloFechaEntrega,
        moduloClienteTipo,
        clienteObligatorio,
        terminologia,
        impuestoActivo,
        impuestoNombre: impuestoNombre.trim() || "IVA",
        impuestoTasa: isNaN(tasaImp) ? 0 : tasaImp,
        preciosIncluyenImpuesto: preciosIncluyen,
      });

      // El perfil se cargó al iniciar sesión (aún por defecto): se relee para que el menú ya sea el del rubro.
      await refetch();
      toast.success("¡Todo listo! Bienvenido a tu sistema.");
      navigate("/");
    } catch (error) {
      console.error("Error en el setup inicial:", error);
      const mensaje = isAxiosError(error) ? error.response?.data?.message : null;
      toast.error(mensaje ?? "Ocurrió un error al configurar el sistema. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const enter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && paso < 2 && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      avanzar();
    }
  };

  const conVistaPrevia = paso >= 1 && rubro;

  return (
    <div className="min-h-dvh flex items-center justify-center relative bg-gray-100 dark:bg-gray-950 p-0 sm:p-4">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
        <SelectorTema />
      </div>
      <div className="w-full max-w-7xl bg-white dark:bg-gray-900 sm:rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-clip flex flex-col lg:flex-row min-h-dvh sm:min-h-150 sm:my-8">
        <div className="lg:flex lg:w-[30%] shrink-0">
          <PanelMarca nombre={nombreNegocio || null} rubro={rubro} className="w-full" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col" onKeyDown={enter}>
          <header className="px-5 sm:px-8 pt-6 pb-5 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 pr-24 sm:pr-0">Configuración inicial</h1>
              <span className="text-xs font-medium text-gray-400 shrink-0 max-sm:hidden">
                Paso {paso + 1} de {PASOS.length}
              </span>
            </div>
            <ol className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {PASOS.map((p, i) => (
                <li key={p.titulo} aria-current={i === paso ? "step" : undefined}>
                  <span className={`block h-1.5 rounded-full transition-colors ${i <= paso ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-800"}`} />
                  <span className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${i === paso ? "text-gray-900 dark:text-gray-100" : i < paso ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
                    {i < paso ? <FaCheck size={9} /> : <span className="tabular-nums">{i + 1}.</span>}
                    <span className="sm:hidden">{p.corto}</span>
                    <span className="max-sm:hidden">{p.titulo}</span>
                  </span>
                </li>
              ))}
            </ol>
          </header>

          <div className={`flex-1 px-5 sm:px-8 py-6 sm:py-7 grid gap-8 content-start ${conVistaPrevia ? "xl:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
            <div className="@container space-y-7 min-w-0 max-w-2xl">
              {paso === 0 && (
                <>
                  <EncabezadoPaso icono={<FaUserShield />} titulo="Cuenta de administrador" detalle="Con ella manejarás el sistema y crearás las cuentas de tu equipo." />
                  <div className="space-y-4">
                    <Campo etiqueta="Tu nombre">
                      <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. María Pérez" autoComplete="name" autoFocus />
                    </Campo>
                    <Campo etiqueta="Correo electrónico">
                      <input type="email" className={campo} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" />
                    </Campo>
                    <div className="grid @xl:grid-cols-2 gap-4">
                      <Campo etiqueta="Contraseña" ayuda="Mínimo 6 caracteres.">
                        <input type="password" className={campo} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                      </Campo>
                      <Campo etiqueta="Confirmar contraseña">
                        <input type="password" className={campo} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                      </Campo>
                    </div>
                  </div>
                </>
              )}

              {paso === 1 && (
                <>
                  <EncabezadoPaso icono={<FaStore />} titulo="Sobre tu negocio" detalle="Con esto el sistema se adapta a lo que vendes." />

                  <Bloque titulo="Nombre del negocio">
                    <input className={campo} value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} placeholder="Ej. Mi Negocio C.A." autoFocus />
                  </Bloque>

                  <Bloque titulo="¿A qué se dedica?" detalle="Prepara el menú, los términos y los módulos. Puedes cambiarlo después en Configuración.">
                    <div role="radiogroup" aria-label="Rubro" className="grid @xl:grid-cols-2 gap-3">
                      {(Object.keys(RUBRO_PRESETS) as Rubro[]).map((r) => {
                        const p = RUBRO_PRESETS[r];
                        const Icono = ICONOS[r];
                        const activo = rubro === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={activo}
                            onClick={() => elegirRubro(r)}
                            className={`relative h-full flex items-start gap-3.5 text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                              activo ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10 ring-1 ring-blue-500" : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            }`}
                          >
                            <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0 ${activo ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                              <Icono />
                            </span>
                            <span className="min-w-0 flex-1 pr-5">
                              <span className="block font-semibold text-gray-900 dark:text-gray-100 leading-tight">{p.label}</span>
                              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{p.descripcion}</span>
                            </span>
                            <span className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center ${activo ? "bg-blue-600 text-white" : "border border-gray-300 dark:border-gray-600"}`}>
                              {activo && <FaCheck size={9} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Bloque>

                  <Bloque titulo="Datos para tus recibos" detalle="Salen en el encabezado de recibos y facturas. Puedes completarlos después." opcional>
                    <div className="grid @xl:grid-cols-2 gap-4">
                      <Campo etiqueta="RIF / NIT / documento fiscal">
                        <input className={campo} value={rif} onChange={(e) => setRif(e.target.value)} placeholder="J-12345678-9" />
                      </Campo>
                      <Campo etiqueta="Teléfono">
                        <input className={campo} type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="0414-1234567" />
                      </Campo>
                      <Campo etiqueta="Dirección" className="@xl:col-span-2">
                        <input className={campo} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, sector, ciudad" />
                      </Campo>
                    </div>
                  </Bloque>
                </>
              )}

              {paso === 2 && (
                <>
                  <EncabezadoPaso icono={<FaCoins />} titulo="Dinero y módulos" detalle={`Ya vienen elegidos para ${preset.label.toLowerCase()}; ajústalos si lo necesitas.`} />

                  <SelectorMonedas
                    principal={moneda}
                    activas={monedasActivas}
                    tasas={{ VES: tasaVES, COP: tasaCOP }}
                    onPrincipal={setMoneda}
                    onActivas={setMonedasActivas}
                    onTasas={(t) => {
                      setTasaVES(t.VES);
                      setTasaCOP(t.COP);
                    }}
                  />
                  {monedasActivas.length > 1 && <p className="text-xs text-gray-400 -mt-4">Las tasas puedes dejarlas para después: sin ellas solo podrás cobrar en la moneda principal.</p>}

                  <Bloque titulo="Impuesto">
                    <div className={`rounded-xl border ${impuestoActivo ? "border-blue-500/60" : "border-gray-200 dark:border-gray-800"}`}>
                      <div className="p-1">
                        <Interruptor activo={impuestoActivo} onChange={setImpuestoActivo} icono={<FaPercent />} titulo="Cobro impuesto (IVA)" detalle="Se calcula solo en cada venta y se muestra desglosado." variante="fila" />
                      </div>
                      {impuestoActivo && (
                        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
                          <div className="grid grid-cols-[1fr_7rem] gap-3">
                            <Campo etiqueta="Nombre">
                              <input className={campo} value={impuestoNombre} onChange={(e) => setImpuestoNombre(e.target.value)} maxLength={20} />
                            </Campo>
                            <Campo etiqueta="Tasa %">
                              <input className={`${campo} text-right`} inputMode="decimal" value={impuestoTasa} onChange={(e) => setImpuestoTasa(e.target.value)} />
                            </Campo>
                          </div>
                          <Interruptor activo={preciosIncluyen} onChange={setPreciosIncluyen} titulo="Mis precios ya incluyen el impuesto" detalle="Si lo apagas, se suma encima del precio." />
                        </div>
                      )}
                    </div>
                  </Bloque>

                  <Bloque titulo="Qué necesitas controlar" detalle="Se pueden activar o apagar cuando quieras.">
                    <div className="grid @xl:grid-cols-2 gap-3">
                      <Interruptor variante="tarjeta" activo={moduloInventario} onChange={setModuloInventario} icono={<FaBoxes />} titulo="Inventario" detalle="Existencias, mínimos y movimientos." />
                      <Interruptor variante="tarjeta" activo={moduloProveedores} onChange={setModuloProveedores} icono={<FaTruck />} titulo="Proveedores y compras" detalle="Reposición y cuentas por pagar." />
                      <Interruptor variante="tarjeta" activo={moduloCaja} onChange={setModuloCaja} icono={<FaCashRegister />} titulo="Caja" detalle="Apertura, egresos y cierre con arqueo." />
                      <Interruptor variante="tarjeta" activo={moduloFechaEntrega} onChange={setModuloFechaEntrega} icono={<FaCalendarAlt />} titulo="Fecha de entrega" detalle="Para trabajos que se entregan después." />
                    </div>
                  </Bloque>

                  <Bloque titulo="Cómo tratas a tus clientes">
                    <div className="grid @xl:grid-cols-2 gap-3">
                      <Interruptor variante="tarjeta" activo={moduloClienteTipo} onChange={setModuloClienteTipo} icono={<FaAddressCard />} titulo="Ficha de cliente completa" detalle="Persona o empresa, documento y contactos." />
                      <Interruptor variante="tarjeta" activo={clienteObligatorio} onChange={setClienteObligatorio} icono={<FaUserCheck />} titulo="Cliente obligatorio" detalle="Apagado, puedes vender sin registrar a nadie." />
                    </div>
                  </Bloque>
                </>
              )}
            </div>

            {conVistaPrevia && rubro && (
              <aside className="xl:sticky xl:top-6 self-start min-w-0">
                <VistaPreviaRubro
                  rubro={rubro}
                  nombre={nombreNegocio}
                  terminologia={terminologia}
                  moduloInventario={moduloInventario}
                  moduloProveedores={moduloProveedores}
                  moduloCaja={moduloCaja}
                  moduloFechaEntrega={moduloFechaEntrega}
                />
              </aside>
            )}
          </div>

          <footer className="sticky bottom-0 z-10 px-5 sm:px-8 py-4 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {paso > 0 ? (
              <Button onClick={() => setPaso((p) => (p - 1) as 0 | 1)} variant="ghost" leftIcon={<FaArrowLeft />} disabled={enviando}>
                Atrás
              </Button>
            ) : (
              <span />
            )}
            {paso < 2 ? (
              <Button onClick={avanzar} variant="primary" rightIcon={<FaArrowRight />}>
                Siguiente
              </Button>
            ) : (
              <Button onClick={finalizar} variant="primary" isLoading={enviando} disabled={enviando} rightIcon={<FaCheck />}>
                Empezar a usar el sistema
              </Button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
