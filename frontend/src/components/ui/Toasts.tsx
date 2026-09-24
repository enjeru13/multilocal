import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTema } from "../../tema/temaCore";

/** Avisos emergentes que siguen el tema claro/oscuro. */
export default function Toasts() {
  const { oscuro } = useTema();
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={3000}
      hideProgressBar
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      pauseOnHover
      theme={oscuro ? "dark" : "light"}
      toastClassName="!rounded-xl !text-sm !shadow-lg"
    />
  );
}
