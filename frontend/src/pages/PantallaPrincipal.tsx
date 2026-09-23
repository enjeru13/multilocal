import { useEffect, useState } from "react";
import { toast } from "react-toastify";

// Componentes panel
import ClientePanel from "../components/panel/ClientePanel";
import ServiciosPanel from "../components/panel/ServiciosPanel";
import ObservacionesPanel from "../components/panel/ObservacionesPanel";
import FechaEntregaPanel from "../components/panel/FechaEntregaPanel";
import ResumenOrdenPanel from "../components/panel/ResumenOrdenPanel";
import ConfirmarOrdenPanel from "../components/panel/ConfirmarOrdenPanel";
import DashboardStats from "../components/panel/DashboardStats";

// Modales y Formularios
import FormularioCliente from "../components/formulario/FormularioCliente";
import ListaClientesModal from "../components/modal/ListaClientesModal";

// Services
import { servicioService } from "../services/serviciosService";
import { clientesService } from "../services/clientesService";
import { ordenesService } from "../services/ordenesService";
import { pagosService } from "../services/pagosService";
import { configuracionService } from "../services/configuracionService";

import type {
  Cliente,
  ClienteCreate,
  Servicio,
  ServicioSeleccionado,
  OrdenCreate,
  Moneda,
  TasasConversion,
} from "@lavanderia/shared/types/types";
import { normalizarMoneda, formatearMoneda } from "../utils/monedaHelpers";
import { calcularTotalAbonado } from "@lavanderia/shared/utils/pagoFinance";
import dayjs from "dayjs";
import { FormSkeleton } from "../components/Skeleton";

export default function PantallaPrincipal() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [mostrarFormularioCliente, setMostrarFormularioCliente] =
    useState(false);
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false);

  const [serviciosCatalogo, setServiciosCatalogo] = useState<Servicio[]>([]);
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<
    ServicioSeleccionado[]
  >([]);

  const [observaciones, setObservaciones] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");

  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [tasas, setTasas] = useState<TasasConversion>({});

  const [loading, setLoading] = useState(true);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [stats, setStats] = useState({
    totalOrdenes: 0,
    pendientes: 0,
    entregadas: 0,
    ventasHoy: "$0.00",
    cobradoHoy: "$0.00",
  });

  useEffect(() => {
    async function cargarDatosIniciales() {
      try {
        const resServicios = await servicioService.getAll();
        setServiciosCatalogo(resServicios.data);

        const resConfig = await configuracionService.get();
        const config = resConfig.data;
        setMonedaPrincipal(normalizarMoneda(config.monedaPrincipal ?? "USD"));
        setTasas({
          VES: config.tasaVES ?? null,
          COP: config.tasaCOP ?? null,
        });

        // Cargar estadísticas
        const [resOrdenes, resPagos] = await Promise.all([
          ordenesService.getAll(),
          pagosService.getAll(),
        ]);
        const ordenes = resOrdenes.data;
        const pagos = resPagos.data;

        const principal = normalizarMoneda(config.monedaPrincipal ?? "USD");
        const tasasActuales: TasasConversion = {
          VES: config.tasaVES ?? null,
          COP: config.tasaCOP ?? null,
        };
        const esHoy = (fecha: string) => dayjs(fecha).isSame(dayjs(), "day");
        const vigentes = ordenes.filter((o) => o.estado !== "CANCELADO");

        // Ventas: suma de totales de órdenes (no anuladas) creadas hoy
        const ventasHoy = vigentes.reduce(
          (acc: number, o) => (esHoy(o.fechaIngreso) ? acc + (o.total || 0) : acc),
          0
        );

        // Cobrado: pagos de hoy convertidos a moneda principal (con tasa
        // congelada del pago y netos de vueltos/reembolsos)
        const cobradoHoy = calcularTotalAbonado(
          pagos.filter((p) => esHoy(p.fechaPago)),
          tasasActuales,
          principal
        );

        setStats({
          totalOrdenes: vigentes.length,
          pendientes: vigentes.filter((o) => o.estado === "PENDIENTE").length,
          entregadas: vigentes.filter((o) => o.estado === "ENTREGADO").length,
          ventasHoy: formatearMoneda(ventasHoy, principal),
          cobradoHoy: formatearMoneda(cobradoHoy, principal),
        });
      } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
        toast.error("Error al cargar datos iniciales del sistema.");
      } finally {
        setLoading(false);
      }
    }
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    const isValid = cliente !== null && serviciosSeleccionados.length > 0;
    setIsFormValid(isValid);
  }, [cliente, serviciosSeleccionados]);

  const crearOrden = async () => {
    if (!cliente) {
      toast.error("Debes seleccionar un cliente para crear la orden.");
      return;
    }

    if (serviciosSeleccionados.length === 0) {
      toast.error("Debes seleccionar al menos un servicio.");
      return;
    }

    setIsSaving(true);

    const nuevaOrden: OrdenCreate = {
      clienteId: cliente.id,
      estado: "PENDIENTE",
      observaciones: observaciones.trim() || null,
      fechaEntrega: fechaEntrega ? dayjs(fechaEntrega).toISOString() : null,
      servicios: serviciosSeleccionados, // Aquí van incluidos los precios personalizados
    };

    try {
      await ordenesService.create(nuevaOrden);
      toast.success("Orden creada exitosamente!");

      // Resetear formulario
      setCliente(null);
      setServiciosSeleccionados([]);
      setObservaciones("");
      setFechaEntrega("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Error al crear la orden:", error);
      toast.error("Error al crear la orden.");
    } finally {
      setIsSaving(false);
    }
  };

  const cancelarOrden = () => {
    setCliente(null);
    setServiciosSeleccionados([]);
    setObservaciones("");
    setFechaEntrega("");
    toast.info("Creación de orden cancelada.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nueva Orden</h1>
        <p className="text-gray-500 dark:text-gray-400">Gestiona los servicios y clientes para tus tickets.</p>
      </header>

      <DashboardStats stats={stats} />

      <ClientePanel
        cliente={cliente}
        onAbrirFormulario={() => setMostrarFormularioCliente(true)}
        onAbrirLista={() => setMostrarListaClientes(true)}
      />

      <ServiciosPanel
        serviciosCatalogo={serviciosCatalogo}
        serviciosSeleccionados={serviciosSeleccionados}
        setServiciosSeleccionados={setServiciosSeleccionados}
        monedaPrincipal={monedaPrincipal}
      />

      <ObservacionesPanel
        observaciones={observaciones}
        setObservaciones={setObservaciones}
      />

      <FechaEntregaPanel
        fechaEntrega={fechaEntrega}
        setFechaEntrega={setFechaEntrega}
      />

      <ResumenOrdenPanel
        cliente={cliente}
        serviciosSeleccionados={serviciosSeleccionados}
        serviciosCatalogo={serviciosCatalogo}
        observaciones={observaciones}
        fechaEntrega={fechaEntrega}
        monedaPrincipal={monedaPrincipal}
      />

      <ConfirmarOrdenPanel
        serviciosSeleccionados={serviciosSeleccionados}
        serviciosCatalogo={serviciosCatalogo}
        onRegistrar={crearOrden}
        onCancelar={cancelarOrden}
        tasas={tasas}
        monedaPrincipal={monedaPrincipal}
        isFormValid={isFormValid}
        isSaving={isSaving}
      />

      {mostrarFormularioCliente && (
        <FormularioCliente
          onClose={() => setMostrarFormularioCliente(false)}
          onSubmit={async (data) => {
            try {
              const res = await clientesService.create(data as ClienteCreate);
              setCliente(res.data);
              toast.success("Cliente registrado correctamente");
            } catch (error) {
              console.error("Error al registrar cliente:", error);
              toast.error("Error al registrar cliente");
            }
            setMostrarFormularioCliente(false);
          }}
        />
      )}

      {mostrarListaClientes && (
        <ListaClientesModal
          onClose={() => setMostrarListaClientes(false)}
          onSelect={(c: Cliente) => {
            setCliente(c);
            setMostrarListaClientes(false);
          }}
        />
      )}
    </div>
  );
}
