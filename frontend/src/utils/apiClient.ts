import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

/** URL de la foto de un producto (o null si no tiene). */
export const urlImagenServicio = (imagen: string | null | undefined): string | null => (imagen ? `${API_URL}/archivos/imagenes/${imagen}` : null);

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const esAuth = String(error.config?.url ?? "").includes("/auth/");
    if (error.response?.status === 401 && !esAuth) {
      // Sesión vencida, usuario desactivado o respaldo restaurado: volver al login.
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
