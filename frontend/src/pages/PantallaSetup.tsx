import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserShield, FaStore, FaArrowRight, FaArrowLeft, FaCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import { useAuth } from "../hooks/useAuth";
import { authService } from "../services/authService";
import { configuracionService } from "../services/configuracionService";
import { RUBRO_PRESETS } from "../constants/rubroPresets";
import type { Rubro } from "@lavanderia/shared/types/types";
import Button from "../components/ui/Button";

// Primer arranque del sistema: no hay usuarios ni perfil de negocio todavía.
// En vez de mostrar un login vacío, se crea la cuenta admin y se elige el
// rubro antes de entrar. Ver PantallaLogin.tsx (redirige aquí si needsSetup).
export default function PantallaSetup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [enviando, setEnviando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nombreNegocio, setNombreNegocio] = useState("");
  const [rubro, setRubro] = useState<Rubro>("GENERICO");

  const avanzarPaso1 = () => {
    if (!nombre.trim() || !email.trim() || !password) {
      toast.error("Completa nombre, correo y contraseña.");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setPaso(2);
  };

  const finalizar = async () => {
    if (!nombreNegocio.trim()) {
      toast.error("Indica el nombre del negocio.");
      return;
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

      const preset = RUBRO_PRESETS[rubro];
      await configuracionService.update({
        nombreNegocio: nombreNegocio.trim(),
        monedaPrincipal: "USD",
        rubro,
        moduloInventario: preset.moduloInventario,
        moduloProveedores: preset.moduloProveedores,
        moduloCaja: preset.moduloCaja,
        moduloFechaEntrega: preset.moduloFechaEntrega,
        moduloClienteTipo: preset.moduloClienteTipo,
        clienteObligatorio: preset.clienteObligatorio,
        terminologia: preset.terminologia,
      });

      toast.success("¡Todo listo! Bienvenido a tu sistema.");
      navigate("/");
    } catch (error) {
      console.error("Error en el setup inicial:", error);
      toast.error("Ocurrió un error al configurar el sistema. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configuración inicial
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Antes de entrar, crea tu cuenta y dinos a qué se dedica el negocio. Paso {paso} de 2.
          </p>
        </div>

        {paso === 1 ? (
          <div className="p-8 space-y-5">
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-2">
              <FaUserShield size={22} />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Cuenta de administrador
              </h2>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Tu nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-base dark:text-gray-100"
                placeholder="Ej. María Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-base dark:text-gray-100"
                placeholder="tu@email.com"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-base dark:text-gray-100"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-base dark:text-gray-100"
                  placeholder="Repite la contraseña"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={avanzarPaso1} variant="primary" rightIcon={<FaArrowRight />}>
                Siguiente
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 space-y-5">
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-2">
              <FaStore size={22} />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Sobre tu negocio
              </h2>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Nombre del negocio
              </label>
              <input
                type="text"
                value={nombreNegocio}
                onChange={(e) => setNombreNegocio(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-base dark:text-gray-100"
                placeholder="Ej. Mi Negocio C.A."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                ¿A qué se dedica?
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {(Object.keys(RUBRO_PRESETS) as Rubro[]).map((r) => {
                  const preset = RUBRO_PRESETS[r];
                  const activo = rubro === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRubro(r)}
                      className={`text-left p-4 rounded-lg border transition-colors ${
                        activo
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500"
                          : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{preset.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{preset.descripcion}</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Esto solo precarga la configuración — todo se puede cambiar después en Configuración.
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <Button onClick={() => setPaso(1)} variant="ghost" leftIcon={<FaArrowLeft />}>
                Atrás
              </Button>
              <Button
                onClick={finalizar}
                variant="primary"
                isLoading={enviando}
                disabled={enviando}
                rightIcon={<FaCheck />}
              >
                Empezar a usar el sistema
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
