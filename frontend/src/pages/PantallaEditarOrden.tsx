import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useParams, useNavigate } from "react-router-dom";

// Componentes panel (REUTILIZAMOS LOS MISMOS QUE YA TIENES)
import ClientePanel from "../components/panel/ClientePanel";
import ServiciosPanel from "../components/panel/ServiciosPanel";
import ObservacionesPanel from "../components/panel/ObservacionesPanel";
import FechaEntregaPanel from "../components/panel/FechaEntregaPanel";
import ResumenOrdenPanel from "../components/panel/ResumenOrdenPanel";
import ConfirmarOrdenPanel from "../components/panel/ConfirmarOrdenPanel";

// Services
import { servicioService } from "../services/serviciosService";
import { ordenesService } from "../services/ordenesService";
import { configuracionService } from "../services/configuracionService";

import type {
  Cliente,
  Servicio,
  ServicioSeleccionado,
  Moneda,
  TasasConversion,
  DescuentoOrden,
} from "@lavanderia/shared/types/types";
import { normalizarMoneda } from "../utils/monedaHelpers";
import dayjs from "dayjs";
import { FormSkeleton } from "../components/Skeleton";
import { useConfiguracion, useEtiquetas } from "../context/configuracionCore";
import { totalesDeSeleccion } from "../utils/totales";

export default function EditarOrdenPage() {
  const et = useEtiquetas();
  const { config } = useConfiguracion();
  const clienteObligatorio = config?.clienteObligatorio !== false;
  const { id } = useParams(); // ID DE LA ORDEN A EDITAR
  const navigate = useNavigate();

  // Estados idénticos a la pantalla de crear
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [serviciosCatalogo, setServiciosCatalogo] = useState<Servicio[]>([]);
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<
    ServicioSeleccionado[]
  >([]);
  const [observaciones, setObservaciones] = useState("");
  const [descuento, setDescuento] = useState<DescuentoOrden | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [monedaPrincipal, setMonedaPrincipal] = useState<Moneda>("USD");
  const [tasas, setTasas] = useState<TasasConversion>({});

  const [loading, setLoading] = useState(true);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. CARGAR CONFIGURACIÓN (Igual que siempre)
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
      } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
        toast.error("Error al cargar datos iniciales.");
      }
    }
    cargarDatosIniciales();
  }, []);

  // 2. LOGICA ÚNICA DE ESTA PÁGINA: CARGAR LA ORDEN EXISTENTE
  useEffect(() => {
    async function cargarOrdenExistente() {
      if (!id) return;

      try {
        setLoading(true);
        const res = await ordenesService.getById(Number(id));
        const orden = res.data;

        // Rellenamos los estados con la data que viene del backend
        setCliente(orden.cliente || null);
        setObservaciones(orden.observaciones || "");
        setDescuento(
          orden.descuentoTipo && orden.descuentoValor
            ? { tipo: orden.descuentoTipo, valor: orden.descuentoValor }
            : null
        );

        if (orden.fechaEntrega) {
          setFechaEntrega(dayjs(orden.fechaEntrega).format("YYYY-MM-DD"));
        }

        // Convertimos los detalles de la BD al formato que usa el panel
        if (orden.detalles) {
          const serviciosMapeados: ServicioSeleccionado[] = orden.detalles.map(
            (detalle) => ({
              servicioId: detalle.servicio?.id || 0,
              cantidad: detalle.cantidad,
              // IMPORTANTE: Recuperamos el precio guardado
              precio: detalle.precioUnit,
            })
          );
          setServiciosSeleccionados(serviciosMapeados);
        }
      } catch (error) {
        console.error("Error al cargar la orden:", error);
        toast.error("No se pudo cargar la orden.");
        navigate("/ordenes");
      } finally {
        setLoading(false);
      }
    }

    // Ejecutamos carga cuando tenemos el ID
    cargarOrdenExistente();
  }, [id, navigate]);

  // Validación
  useEffect(() => {
    const isValid = (cliente !== null || !clienteObligatorio) && serviciosSeleccionados.length > 0;
    setIsFormValid(isValid);
  }, [cliente, serviciosSeleccionados, clienteObligatorio]);

  const totales = useMemo(
    () => totalesDeSeleccion(serviciosSeleccionados, serviciosCatalogo, config, descuento),
    [serviciosSeleccionados, serviciosCatalogo, config, descuento]
  );

  // 3. LOGICA ÚNICA: ACTUALIZAR EN VEZ DE CREAR
  const guardarCambios = async () => {
    if ((!cliente && clienteObligatorio) || serviciosSeleccionados.length === 0) return;

    setIsSaving(true);

    const payload = {
      observaciones: observaciones.trim() || null,
      fechaEntrega: fechaEntrega ? dayjs(fechaEntrega).toISOString() : null,
      servicios: serviciosSeleccionados, // Enviamos la lista con precios
      descuento: descuento && descuento.valor > 0 ? descuento : null,
    };

    try {
      await ordenesService.update(Number(id), payload);
      toast.success(`${et.orden} #${id} actualizada exitosamente.`);
      navigate("/ordenes"); // Volvemos al historial
    } catch (error) {
      console.error("Error al actualizar:", error);
      toast.error("Error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto pb-20">
      <header className="flex flex-col mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Editar Orden <span className="text-blue-600 dark:text-blue-400">#{id}</span>
          </h1>
          <button
            onClick={() => navigate("/ordenes")}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline cursor-pointer"
          >
            Volver al historial
          </button>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Modifica los detalles según sea necesario.</p>
      </header>

      <ClientePanel
        cliente={cliente}
        onAbrirFormulario={() => { }}
        onAbrirLista={() =>
          toast.info(`Para cambiar el ${et.clienteMin}, crea ${et.ordenMin === "orden" ? "una orden nueva" : `otra ${et.ordenMin}`}.`)
        }
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

      {/* AQUÍ ESTÁ LA CORRECCIÓN CLAVE: */}
      <ConfirmarOrdenPanel
        totales={totales}
        descuento={descuento}
        onDescuento={setDescuento}
        onRegistrar={guardarCambios}
        onCancelar={() => navigate("/ordenes")}
        tasas={tasas}
        monedaPrincipal={monedaPrincipal}
        isFormValid={isFormValid}
        isSaving={isSaving}
      />
    </div>
  );
}
