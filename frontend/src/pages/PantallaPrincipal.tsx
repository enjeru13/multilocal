import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { FaCashRegister } from "react-icons/fa";
import { useConfiguracion, useEtiquetas } from "../context/configuracionCore";

// Componentes panel
import ClientePanel from "../components/panel/ClientePanel";
import ServiciosPanel from "../components/panel/ServiciosPanel";
import ObservacionesPanel from "../components/panel/ObservacionesPanel";
import FechaEntregaPanel from "../components/panel/FechaEntregaPanel";
import ResumenOrdenPanel from "../components/panel/ResumenOrdenPanel";
import ConfirmarOrdenPanel from "../components/panel/ConfirmarOrdenPanel";
import DashboardStats from "../components/panel/DashboardStats";
import DashboardTendencia from "../components/panel/DashboardTendencia";

// Modales y Formularios
import FormularioCliente from "../components/formulario/FormularioCliente";
import ListaClientesModal from "../components/modal/ListaClientesModal";

// Services
import { servicioService } from "../services/serviciosService";
import { clientesService } from "../services/clientesService";
import { ordenesService } from "../services/ordenesService";
import { reportesService } from "../services/reportesService";
import { configuracionService } from "../services/configuracionService";

import type {
  Cliente,
  ClienteCreate,
  Servicio,
  ServicioSeleccionado,
  OrdenCreate,
  Moneda,
  TasasConversion,
  DashboardData,
} from "@lavanderia/shared/types/types";
import { normalizarMoneda } from "../utils/monedaHelpers";
import dayjs from "dayjs";
import { FormSkeleton } from "../components/Skeleton";

export default function PantallaPrincipal() {
  const { config } = useConfiguracion();
  const et = useEtiquetas();
  const clienteObligatorio = config?.clienteObligatorio !== false;
  const modoMostrador = config?.moduloFechaEntrega === false;
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

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

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

        // Cifras del día calculadas en el servidor (no se descarga el historial)
        const resDash = await reportesService.dashboard();
        setDashboard(resDash.data);
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
    const isValid =
      (cliente !== null || !clienteObligatorio) && serviciosSeleccionados.length > 0;
    setIsFormValid(isValid);
  }, [cliente, serviciosSeleccionados, clienteObligatorio]);

  const crearOrden = async () => {
    if (!cliente && clienteObligatorio) {
      toast.error(`Debes seleccionar un ${et.clienteMin} para crear la ${et.ordenMin}.`);
      return;
    }

    if (serviciosSeleccionados.length === 0) {
      toast.error(`Debes seleccionar al menos un ${et.servicioMin}.`);
      return;
    }

    setIsSaving(true);

    const nuevaOrden: OrdenCreate = {
      clienteId: cliente?.id ?? null,
      estado: "PENDIENTE",
      observaciones: observaciones.trim() || null,
      fechaEntrega: fechaEntrega ? dayjs(fechaEntrega).toISOString() : null,
      servicios: serviciosSeleccionados, // Aquí van incluidos los precios personalizados
    };

    try {
      await ordenesService.create(nuevaOrden);
      toast.success(`${et.orden} creada exitosamente!`);

      // Resetear formulario
      setCliente(null);
      setServiciosSeleccionados([]);
      setObservaciones("");
      setFechaEntrega("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      reportesService.dashboard().then((r) => setDashboard(r.data)).catch(() => {});
    } catch (error) {
      console.error("Error al crear la orden:", error);
      toast.error(`Error al crear la ${et.ordenMin}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelarOrden = () => {
    setCliente(null);
    setServiciosSeleccionados([]);
    setObservaciones("");
    setFechaEntrega("");
    toast.info(`Creación de ${et.ordenMin} cancelada.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }

  // Negocios de mostrador: se vende desde la pantalla de venta rápida; aquí solo el resumen.
  if (modoMostrador) {
    return (
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Resumen</h1>
            <p className="text-gray-500 dark:text-gray-400">Cómo va el negocio hoy.</p>
          </div>
          <Link
            to="/venta"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
          >
            <FaCashRegister /> Nueva {et.ordenMin}
          </Link>
        </header>
        <DashboardStats data={dashboard} />
        <DashboardTendencia data={dashboard} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nueva {et.orden}</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Gestiona {et.serviciosMin} y {et.clientesMin}.
        </p>
      </header>

      <DashboardStats data={dashboard} />

      <ClientePanel
        cliente={cliente}
        onAbrirFormulario={() => setMostrarFormularioCliente(true)}
        onAbrirLista={() => setMostrarListaClientes(true)}
        onQuitar={() => setCliente(null)}
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
            const res = await clientesService.create(data as ClienteCreate);
            setCliente(res.data);
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
