import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
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
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("authToken");
      console.error(
        "Token de autenticación expirado o inválido. Redirigiendo al login."
      );
    }
    return Promise.reject(error);
  }
);

export default apiClient;
