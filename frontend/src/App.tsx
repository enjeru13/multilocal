import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import React from "react";
import DashboardLayout from "./layout/DashboardLayout";
import PantallaPrincipal from "./pages/PantallaPrincipal";
import PantallaClientes from "./pages/PantallaClientes";
import PantallaServicios from "./pages/PantallaServicios";
import PantallaOrdenes from "./pages/PantallaOrdenes";
import PantallaPagos from "./pages/PantallaPagos";
import PantallaConfiguracion from "./pages/PantallaConfiguracion";
import PantallaLogin from "./pages/PantallaLogin";
import PantallaRegister from "./pages/PantallaRegister";
import PantallaEstadoOrdenes from "./pages/PantallaEstadoOrdenes";
import PantallaEditarOrden from "./pages/PantallaEditarOrden";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import type { Role } from "@lavanderia/shared/types/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-600">
        Cargando autenticación...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !hasRole(roles)) {
    toast.error("No tienes permisos para acceder a esta sección.");
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<PantallaLogin />} />
          <Route path="/register" element={<PantallaRegister />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PantallaPrincipal />} />
            <Route path="clientes" element={<PantallaClientes />} />
            <Route path="servicios" element={<PantallaServicios />} />
            <Route path="ordenes" element={<PantallaOrdenes />} />
            <Route path="pagos" element={<PantallaPagos />} />
            <Route 
              path="ordenes/editar/:id" 
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaEditarOrden />
                </ProtectedRoute>
              } 
            />
            <Route
              path="configuracion"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <PantallaConfiguracion />
                </ProtectedRoute>
              }
            />
            <Route
              path="estado-ordenes"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <PantallaEstadoOrdenes />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </Router>
    </AuthProvider>
  );
}

export default App;
