import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { toast } from "react-toastify";
import Toasts from "./components/ui/Toasts";
import React from "react";
import DashboardLayout from "./layout/DashboardLayout";
import PantallaPrincipal from "./pages/PantallaPrincipal";
import PantallaClientes from "./pages/PantallaClientes";
import PantallaServicios from "./pages/PantallaServicios";
import PantallaOrdenes from "./pages/PantallaOrdenes";
import PantallaPagos from "./pages/PantallaPagos";
import PantallaConfiguracion from "./pages/PantallaConfiguracion";
import PantallaLogin from "./pages/PantallaLogin";
import PantallaUsuarios from "./pages/PantallaUsuarios";
import PantallaRespaldos from "./pages/PantallaRespaldos";
import PantallaSetup from "./pages/PantallaSetup";
import PantallaEstadoOrdenes from "./pages/PantallaEstadoOrdenes";
import PantallaEditarOrden from "./pages/PantallaEditarOrden";
import PantallaInventario from "./pages/PantallaInventario";
import PantallaProveedores from "./pages/PantallaProveedores";
import PantallaCaja from "./pages/PantallaCaja";
import PantallaPresupuestos from "./pages/PantallaPresupuestos";
import PantallaPresupuesto from "./pages/PantallaPresupuesto";
import PantallaVenta from "./pages/PantallaVenta";
import PantallaReportes from "./pages/PantallaReportes";
import PantallaGastos from "./pages/PantallaGastos";
import PantallaTablero from "./pages/PantallaTablero";
import { AtajosProvider } from "./atajos/AtajosProvider";
import InicioSegunNegocio from "./experiencia/InicioSegunNegocio";
import PantallaCuentasPorPagar from "./pages/PantallaCuentasPorPagar";
import { AuthProvider } from "./context/AuthContext";
import { ConfiguracionProvider } from "./context/ConfiguracionContext";
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
      <div className="flex justify-center items-center h-dvh text-gray-600">
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
      <ConfiguracionProvider>
      <Router>
        <AtajosProvider>
        <Routes>
          <Route path="/login" element={<PantallaLogin />} />
          <Route path="/setup" element={<PantallaSetup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<InicioSegunNegocio />} />
            <Route path="resumen" element={<PantallaPrincipal />} />
            <Route path="tablero" element={<PantallaTablero />} />
            <Route path="clientes" element={<PantallaClientes />} />
            <Route
              path="servicios"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaServicios />
                </ProtectedRoute>
              }
            />
            <Route path="ordenes" element={<PantallaOrdenes />} />
            <Route
              path="presupuestos"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaPresupuestos />
                </ProtectedRoute>
              }
            />
            <Route
              path="presupuestos/nuevo"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaPresupuesto />
                </ProtectedRoute>
              }
            />
            <Route
              path="presupuestos/:id"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaPresupuesto />
                </ProtectedRoute>
              }
            />
            <Route
              path="pagos"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <PantallaPagos />
                </ProtectedRoute>
              }
            />
            <Route
              path="inventario"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaInventario />
                </ProtectedRoute>
              }
            />
            <Route path="caja" element={<PantallaCaja />} />
            <Route path="venta" element={<PantallaVenta />} />
            <Route
              path="gastos"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaGastos />
                </ProtectedRoute>
              }
            />
            <Route
              path="por-pagar"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaCuentasPorPagar />
                </ProtectedRoute>
              }
            />
            <Route
              path="reportes"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <PantallaReportes />
                </ProtectedRoute>
              }
            />
            <Route
              path="proveedores"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaProveedores />
                </ProtectedRoute>
              }
            />
            <Route 
              path="ordenes/editar/:id" 
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <PantallaEditarOrden />
                </ProtectedRoute>
              } 
            />
            <Route
              path="usuarios"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <PantallaUsuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="respaldos"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <PantallaRespaldos />
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
        </AtajosProvider>
        <Toasts />
      </Router>
      </ConfiguracionProvider>
    </AuthProvider>
  );
}

export default App;
