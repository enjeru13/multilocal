import { useEffect, useMemo, useState } from "react";
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
} from "react-icons/fa";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import { useConfiguracion } from "../context/configuracionCore";
import { authService } from "../services/authService";
import { configuracionService } from "../services/configuracionService";
import { RUBRO_PRESETS } from "../constants/rubroPresets";
import { experienciaDe } from "../experiencia/experiencias";
import { parsearTasa } from "../utils/monedaHelpers";
import type {
  Moneda,
  Rubro,
  Terminologia,
} from "@lavanderia/shared/types/types";
import Button from "../components/ui/Button";
import PanelMarca from "../components/PanelMarca";
import SelectorTema from "../components/ui/SelectorTema";
import VistaPreviaRubro from "../components/setup/VistaPreviaRubro";

const ICONOS: Record<Rubro, IconType> = {
  LAVANDERIA: FaTshirt,
  REPUESTOS: FaCogs,
  MINIMARKET: FaShoppingBasket,
  GENERICO: FaStore,
};

const campo =
  "w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-base text-gray-900 dark:text-gray-100";
const etiqueta =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

const PASOS = ["Tu cuenta", "Tu negocio", "Dinero y módulos"] as const;

function Interruptor({
  activo,
  onChange,
  titulo,
  detalle,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
      <span>
        <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
          {titulo}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {detalle}
        </span>
      </span>
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-blue-600 w-5 h-5 shrink-0 cursor-pointer"
      />
    </label>
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
  const [terminologia, setTerminologia] = useState<Required<Terminologia>>(
    RUBRO_PRESETS.GENERICO.terminologia,
  );
  const [moneda, setMoneda] = useState<Moneda>("USD");
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

  const emailValido = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );

  const avanzar = () => {
    if (paso === 0) {
      if (!nombre.trim() || !email.trim() || !password)
        return toast.error("Completa nombre, correo y contraseña.");
      if (!emailValido)
        return toast.error("El correo no tiene un formato válido.");
      if (password.length < 6)
        return toast.error("La contraseña debe tener al menos 6 caracteres.");
      if (password !== confirmPassword)
        return toast.error("Las contraseñas no coinciden.");
      return setPaso(1);
    }
    if (paso === 1) {
      if (!nombreNegocio.trim())
        return toast.error("Indica el nombre del negocio.");
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
        toast.error(
          "Cuenta creada, pero el inicio de sesión automático falló. Inicia sesión manualmente.",
        );
        navigate("/login");
        return;
      }

      await configuracionService.update({
        nombreNegocio: nombreNegocio.trim(),
        monedaPrincipal: moneda,
        tasaVES: moneda !== "VES" ? parsearTasa(tasaVES) : null,
        tasaCOP: moneda !== "COP" ? parsearTasa(tasaCOP) : null,
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
      const mensaje = isAxiosError(error)
        ? error.response?.data?.message
        : null;
      toast.error(
        mensaje ??
          "Ocurrió un error al configurar el sistema. Intenta de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const enter = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      paso < 2 &&
      (e.target as HTMLElement).tagName === "INPUT"
    ) {
      e.preventDefault();
      avanzar();
    }
  };

  const conVistaPrevia = paso >= 1 && rubro;

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-gray-100 dark:bg-gray-950 p-4">
      <div className="absolute top-4 right-4">
        <SelectorTema />
      </div>
      <div className="w-full max-w-6xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row md:min-h-150">
        <div className="hidden lg:flex lg:w-[34%]">
          <PanelMarca
            nombre={nombreNegocio || null}
            rubro={rubro}
            className="w-full"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col" onKeyDown={enter}>
          <div className="px-8 pt-7 pb-5 border-b border-gray-200 dark:border-gray-800">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Configuración inicial
            </h1>
            <ol className="flex items-center gap-2 mt-4 text-xs font-semibold">
              {PASOS.map((p, i) => (
                <li key={p} className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      i < paso
                        ? "bg-blue-600 text-white"
                        : i === paso
                          ? "bg-blue-600 text-white ring-4 ring-blue-500/20"
                          : "bg-gray-200 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    {i < paso ? <FaCheck size={9} /> : i + 1}
                  </span>
                  <span
                    className={
                      i === paso
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400"
                    }
                  >
                    {p}
                  </span>
                  {i < PASOS.length - 1 && (
                    <span className="w-6 h-px bg-gray-300 dark:bg-gray-700" />
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div
            className={`flex-1 p-8 grid gap-8 ${conVistaPrevia ? "xl:grid-cols-[1fr_320px]" : ""}`}
          >
            <div className="space-y-5 min-w-0">
              {paso === 0 && (
                <>
                  <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                    <FaUserShield size={22} />
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      Cuenta de administrador
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Con esta cuenta manejarás el sistema. Después podrás crear
                    usuarios para tu equipo.
                  </p>
                  <div>
                    <label className={etiqueta}>Tu nombre</label>
                    <input
                      className={campo}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. María Pérez"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className={etiqueta}>Correo electrónico</label>
                    <input
                      type="email"
                      className={campo}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={etiqueta}>Contraseña</label>
                      <input
                        type="password"
                        className={campo}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                    <div>
                      <label className={etiqueta}>Confirmar contraseña</label>
                      <input
                        type="password"
                        className={campo}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite la contraseña"
                      />
                    </div>
                  </div>
                </>
              )}

              {paso === 1 && (
                <>
                  <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                    <FaStore size={22} />
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      Sobre tu negocio
                    </h2>
                  </div>
                  <div>
                    <label className={etiqueta}>Nombre del negocio</label>
                    <input
                      className={campo}
                      value={nombreNegocio}
                      onChange={(e) => setNombreNegocio(e.target.value)}
                      placeholder="Ej. Mi Negocio C.A."
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className={etiqueta}>¿A qué se dedica?</label>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {(Object.keys(RUBRO_PRESETS) as Rubro[]).map((r) => {
                        const p = RUBRO_PRESETS[r];
                        const Icono = ICONOS[r];
                        const activo = rubro === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => elegirRubro(r)}
                            className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                              activo
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500"
                                : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                          >
                            <span className="flex items-center gap-2.5 font-semibold text-gray-900 dark:text-gray-100">
                              <Icono
                                className={
                                  activo
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-400"
                                }
                              />
                              {p.label}
                            </span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                              {p.descripcion}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      Puedes cambiarlo cuando quieras en Configuración.
                    </p>
                  </div>
                  <details className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                    <summary className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                      Datos para tus recibos (opcional)
                    </summary>
                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className={etiqueta}>
                          RIF / NIT / documento fiscal
                        </label>
                        <input
                          className={campo}
                          value={rif}
                          onChange={(e) => setRif(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={etiqueta}>Teléfono</label>
                        <input
                          className={campo}
                          value={telefono}
                          onChange={(e) => setTelefono(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={etiqueta}>Dirección</label>
                        <input
                          className={campo}
                          value={direccion}
                          onChange={(e) => setDireccion(e.target.value)}
                        />
                      </div>
                    </div>
                  </details>
                </>
              )}

              {paso === 2 && (
                <>
                  <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                    <FaCoins size={22} />
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      Dinero y módulos
                    </h2>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className={etiqueta}>Moneda principal</label>
                      <select
                        className={campo}
                        value={moneda}
                        onChange={(e) => setMoneda(e.target.value as Moneda)}
                      >
                        <option value="USD">Dólares (USD)</option>
                        <option value="VES">Bolívares (VES)</option>
                        <option value="COP">Pesos colombianos (COP)</option>
                      </select>
                    </div>
                    {moneda !== "VES" && (
                      <div>
                        <label className={etiqueta}>Tasa VES por USD</label>
                        <input
                          className={campo}
                          inputMode="decimal"
                          value={tasaVES}
                          onChange={(e) => setTasaVES(e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                    )}
                    {moneda !== "COP" && (
                      <div>
                        <label className={etiqueta}>Tasa COP por USD</label>
                        <input
                          className={campo}
                          inputMode="decimal"
                          value={tasaCOP}
                          onChange={(e) => setTasaCOP(e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 -mt-2">
                    Las tasas te permiten cobrar en varias monedas; puedes
                    dejarlas para después.
                  </p>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 divide-y divide-gray-100 dark:divide-gray-800">
                    <Interruptor
                      activo={impuestoActivo}
                      onChange={setImpuestoActivo}
                      titulo="Cobro impuesto (IVA)"
                      detalle="Se calcula solo en cada venta y se muestra desglosado."
                    />
                    {impuestoActivo && (
                      <div className="py-3 grid sm:grid-cols-[1fr_120px] gap-3 items-end">
                        <div>
                          <label className={etiqueta}>Nombre</label>
                          <input
                            className={campo}
                            value={impuestoNombre}
                            onChange={(e) => setImpuestoNombre(e.target.value)}
                            maxLength={20}
                          />
                        </div>
                        <div>
                          <label className={etiqueta}>Tasa %</label>
                          <input
                            className={campo}
                            inputMode="decimal"
                            value={impuestoTasa}
                            onChange={(e) => setImpuestoTasa(e.target.value)}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Interruptor
                            activo={preciosIncluyen}
                            onChange={setPreciosIncluyen}
                            titulo="Mis precios ya incluyen el impuesto"
                            detalle="Si no, se suma encima del precio."
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 divide-y divide-gray-100 dark:divide-gray-800">
                    <Interruptor
                      activo={moduloInventario}
                      onChange={setModuloInventario}
                      titulo="Inventario"
                      detalle="Existencias, mínimos y movimientos."
                    />
                    <Interruptor
                      activo={moduloProveedores}
                      onChange={setModuloProveedores}
                      titulo="Proveedores y compras"
                      detalle="Reposición y cuentas por pagar."
                    />
                    <Interruptor
                      activo={moduloCaja}
                      onChange={setModuloCaja}
                      titulo="Caja"
                      detalle="Apertura, egresos y cierre con arqueo."
                    />
                    <Interruptor
                      activo={moduloFechaEntrega}
                      onChange={setModuloFechaEntrega}
                      titulo="Fecha de entrega"
                      detalle="Para trabajos que se entregan después (tablero de órdenes)."
                    />
                    <Interruptor
                      activo={moduloClienteTipo}
                      onChange={setModuloClienteTipo}
                      titulo="Ficha de cliente completa"
                      detalle="Persona o empresa, documento y contactos."
                    />
                    <Interruptor
                      activo={clienteObligatorio}
                      onChange={setClienteObligatorio}
                      titulo="Cliente obligatorio"
                      detalle="Si está apagado, puedes vender sin registrar a nadie."
                    />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Ya vienen elegidos para {preset.label.toLowerCase()};
                    ajústalos si lo necesitas.
                  </p>
                </>
              )}
            </div>

            {conVistaPrevia && rubro && (
              <aside className="xl:sticky xl:top-6 self-start">
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

          <div className="px-8 py-5 border-t border-gray-200 dark:border-gray-800 flex justify-between">
            {paso > 0 ? (
              <Button
                onClick={() => setPaso((p) => (p - 1) as 0 | 1)}
                variant="ghost"
                leftIcon={<FaArrowLeft />}
                disabled={enviando}
              >
                Atrás
              </Button>
            ) : (
              <span />
            )}
            {paso < 2 ? (
              <Button
                onClick={avanzar}
                variant="primary"
                rightIcon={<FaArrowRight />}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                onClick={finalizar}
                variant="primary"
                isLoading={enviando}
                disabled={enviando}
                rightIcon={<FaCheck />}
              >
                Empezar a usar el sistema
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
