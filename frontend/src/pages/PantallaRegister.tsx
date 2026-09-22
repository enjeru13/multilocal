import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { FaUserPlus, FaUser, FaEnvelope, FaLock } from "react-icons/fa";
import { authService } from "../services/authService";
import { toast } from "react-toastify";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { PiEyeBold, PiEyeClosed } from "react-icons/pi";

const registerSchema = z
  .object({
    name: z.string().trim().nullable().optional(),
    email: z
      .string()
      .email("Formato de email inválido.")
      .min(1, "El email es requerido."),
    password: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres."),
    confirmPassword: z.string().min(1, "Confirma tu contraseña."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type RegisterFormInputs = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Estado para controlar si se muestra la contraseña
  const [showPassword, setShowPassword] = useState(false);
  // Estado para controlar si se muestra la contraseña
  const [showPassword2, setShowPassword2] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
      toast.info("Ya estás autenticado.");
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data: RegisterFormInputs) => {
    setError("email", { message: undefined });
    setError("password", { message: undefined });
    setError("confirmPassword", { message: undefined });

    try {
      const response = await authService.register({
        name: data.name || null,
        email: data.email,
        password: data.password,
        role: "EMPLOYEE",
      });
      toast.success(
        response.message || "Registro exitoso. Por favor, inicia sesión."
      );
      navigate("/login");
    } catch (err: unknown) {
      let errorMessage = "Error al registrar usuario.";
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          errorMessage =
            "El email ya está registrado. Por favor, usa otro o inicia sesión.";
          setError("email", { type: "manual", message: errorMessage });
        } else {
          errorMessage = err.response?.data?.message || err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      console.error("Error en el registro:", errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 p-4 font-inter transition-colors duration-300">
      <div className="flex flex-col md:flex-row bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden w-full max-w-6xl md:h-[90vh] lg:h-[80vh] transition-all duration-300 transform scale-100 border border-gray-100 dark:border-gray-800">
        <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-8 bg-linear-to-br from-green-400 to-green-700 dark:from-green-700 dark:to-green-900 min-h-[350px] md:h-full">
          <DotLottieReact
            src="https://lottie.host/44be4efd-be38-473d-9347-7481f763d414/UZK84U6TlD.lottie"
            loop
            autoplay
            className="w-full h-full object-contain max-w-[550px] pb-15"
          />
        </div>
        <div className="p-8 sm:p-12 w-full md:w-1/2 flex flex-col bg-white dark:bg-gray-900 transition-colors">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-center text-green-800 dark:text-green-500 mb-4 flex items-center justify-center gap-3">
            <FaUserPlus className="text-green-600 dark:text-green-500 text-3xl lg:text-4xl" />
            <span className="drop-shadow-sm">Registrar Cuenta</span>
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-10 max-w-md mx-auto text-lg transition-colors">
            Crea una nueva cuenta de usuario para acceder al sistema.
          </p>
          <div className="flex-1 overflow-y-auto pr-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 transition-colors"
                >
                  Nombre (opcional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <FaUser className="text-gray-400 dark:text-gray-500" />
                  </span>
                  <input
                    type="text"
                    id="name"
                    {...register("name")}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 text-base shadow-sm bg-gray-50 dark:bg-gray-950 dark:text-gray-100 transition duration-200
                      ${errors.name ? "border-red-500" : "border-gray-300 dark:border-gray-700"}`}
                    placeholder="Tu nombre"
                    disabled={isSubmitting}
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 font-medium">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 transition-colors"
                >
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <FaEnvelope className="text-gray-400 dark:text-gray-500" />
                  </span>
                  <input
                    type="email"
                    id="email"
                    {...register("email")}
                    className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-500 text-base shadow-sm bg-gray-50 dark:bg-gray-950 dark:text-gray-100 transition duration-200

                    ${errors.email ? "border-red-500" : "border-gray-300 dark:border-gray-700"}`}
                    placeholder="tu@email.com"
                    disabled={isSubmitting}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600 font-medium">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 transition-colors"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <FaLock className="text-gray-400 dark:text-gray-500" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    {...register("password")}
                    className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-500 text-base shadow-sm bg-gray-50 dark:bg-gray-950 dark:text-gray-100 transition duration-200

                    ${errors.password ? "border-red-500" : "border-gray-300 dark:border-gray-700"}`}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                  />
                  {/* Botón para alternar visibilidad */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-500 cursor-pointer focus:outline-none transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <PiEyeClosed size={22} title="Ocultar contraseña" />
                    ) : (
                      <PiEyeBold size={22} title="Mostrar contraseña" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 transition-colors"
                >
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <FaLock className="text-gray-400 dark:text-gray-500" />
                  </span>
                  <input
                    type={showPassword2 ? "text" : "password"}
                    id="confirmPassword"
                    {...register("confirmPassword")}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 text-base shadow-sm bg-gray-50 dark:bg-gray-950 dark:text-gray-100 transition duration-200
                    ${errors.confirmPassword
                        ? "border-red-500"
                        : "border-gray-300 dark:border-gray-700"
                      }`}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                  />
                  {/* Botón para alternar visibilidad */}
                  <button
                    type="button"
                    onClick={() => setShowPassword2(!showPassword2)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-500 cursor-pointer focus:outline-none transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword2 ? (
                      <PiEyeClosed size={22} title="Ocultar contraseña" />
                    ) : (
                      <PiEyeBold size={22} title="Mostrar contraseña" />
                    )}
                  </button>
                </div>

                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600 font-medium">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className={`w-full py-3.5 px-4 rounded-lg text-xl font-semibold transition-all duration-300 ease-in-out transform hover:-translate-y-1 shadow-lg
                ${isSubmitting
                    ? "bg-green-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Registrando...
                  </span>
                ) : (
                  "Registrar"
                )}
              </button>
            </form>
            <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400 transition-colors">
              ¿Ya tienes una cuenta?{" "}
              <Link
                to="/login"
                className="text-green-600 dark:text-green-500 hover:underline font-bold transition-colors duration-200"
              >
                Inicia Sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
