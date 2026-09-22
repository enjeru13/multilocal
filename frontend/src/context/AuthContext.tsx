import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authService } from "../services/authService";
import type {
  User,
  UserLoginPayload,
  Role,
  AuthContextType,
} from "@lavanderia/shared/types/types";
import { toast } from "react-toastify";
import axios from "axios";

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => false,
  logout: () => {},
  hasRole: () => false,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${storedToken}`;
      } catch (error) {
        console.error(
          "Error al parsear usuario o token de localStorage:",
          error
        );
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, [token]);

  const login = useCallback(
    async (credentials: UserLoginPayload): Promise<boolean> => {
      try {
        const response = await authService.login(credentials);
        if (response.token && response.user) {
          setUser(response.user);
          setToken(response.token);
          localStorage.setItem("token", response.token);
          localStorage.setItem("user", JSON.stringify(response.user));
          axios.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${response.token}`;
          toast.success(response.message || "Inicio de sesión exitoso.");
          return true;
        }
        return false;
      } catch (error: unknown) {
        let errorMessage = "Error al iniciar sesión.";
        if (axios.isAxiosError(error)) {
          errorMessage = error.response?.data?.message || error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        console.error("Error en el login:", errorMessage);
        toast.error(errorMessage);
        return false;
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    toast.info("Sesión cerrada.");
  }, []);

  const hasRole = useCallback(
    (requiredRole: Role | Role[]): boolean => {
      if (!user) return false;

      const userRole = user.role;
      if (Array.isArray(requiredRole)) {
        return requiredRole.includes(userRole);
      }
      return userRole === requiredRole;
    },
    [user]
  );

  const isAuthenticated = !!user && !!token;

  const contextValue: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export { AuthContext };
