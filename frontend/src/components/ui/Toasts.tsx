import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTema } from "../../tema/temaCore";
import { useEsMovil } from "../../hooks/useMediaQuery";

/** Avisos emergentes que siguen el tema claro/oscuro. */
export default function Toasts() {
  const { oscuro } = useTema();
  // En teléfono van arriba: abajo taparían la barra de navegación y los botones de cobro.
  const movil = useEsMovil();
  return (
    <ToastContainer
      position={movil ? "top-center" : "bottom-right"}
      autoClose={3000}
      hideProgressBar
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      pauseOnHover
      theme={oscuro ? "dark" : "light"}
      toastClassName="!rounded-xl !text-sm !shadow-lg"
      style={movil ? { top: "calc(0.5rem + env(safe-area-inset-top))", left: "0.5rem", right: "0.5rem", width: "auto" } : undefined}
    />
  );
}
