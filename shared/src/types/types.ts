export type Moneda = "USD" | "VES" | "COP";
export type TipoCliente = "NATURAL" | "EMPRESA";
export type EstadoOrden = "PENDIENTE" | "LISTO" | "ENTREGADO" | "CANCELADO";
export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "PAGO_MOVIL";
export type EstadoPagoRaw = "COMPLETO" | "INCOMPLETO";
export type EstadoPagoTexto = "Sin pagos" | "Parcial" | "Pagado";
export type SortDirection = "asc" | "desc";

export interface Categoria {
  id: string;
  nombre: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  tipo: TipoCliente;
  telefono: string;
  telefono_secundario: string | null;
  direccion: string;
  identificacion: string;
  email: string | null;
  fechaRegistro: string;
  ordenes?: Orden[];
}

export interface ClienteCreate {
  nombre: string;
  apellido: string;
  tipo: TipoCliente;
  telefono: string;
  telefono_secundario?: string | null;
  direccion: string;
  identificacion: string;
  email?: string | null;
}

export interface ClienteUpdatePayload {
  nombre?: string;
  apellido?: string;
  tipo?: TipoCliente;
  telefono?: string;
  telefono_secundario?: string | null;
  direccion?: string;
  identificacion?: string;
  email?: string | null;
}

export interface ClienteResumen {
  id: number;
  nombre: string;
  apellido: string;
}

export type ItemTipo = "PRODUCTO" | "SERVICIO" | "AMBOS";

export interface Servicio {
  id: number;
  nombreServicio: string;
  descripcion: string | null;
  precioBase: number;
  permiteDecimales: boolean;
  categoriaId: string;
  categoria?: Categoria;

  tipo: ItemTipo;
  unidadMedida: string;
  controlaStock: boolean;
  sku: string | null;
  codigoBarras: string | null;
  costoBase: number | null;
  stockActual: number;
  stockMinimo: number | null;
  exentoImpuesto: boolean;

  detalleOrdenes?: DetalleOrden[];
}

export interface ServicioCreate {
  nombreServicio: string;
  descripcion?: string | null;
  precioBase: number;
  permiteDecimales: boolean;
  categoriaId: string;
  tipo?: ItemTipo;
  unidadMedida?: string;
  controlaStock?: boolean;
  sku?: string | null;
  codigoBarras?: string | null;
  costoBase?: number | null;
  stockActual?: number;
  stockMinimo?: number | null;
  exentoImpuesto?: boolean;
}

export type ServicioUpdatePayload = Partial<ServicioCreate>;

export interface Proveedor {
  id: number;
  nombre: string;
  identificacion: string | null;
  telefono: string | null;
  direccion: string | null;
  email: string | null;
  createdAt: string;
  compras?: Compra[];
}

export type ProveedorCreate = Omit<Proveedor, "id" | "createdAt" | "compras">;
export type ProveedorUpdatePayload = Partial<ProveedorCreate>;

export type EstadoCompra = "PENDIENTE" | "RECIBIDA" | "CANCELADA";

export interface CompraDetalle {
  id: number;
  compraId: number;
  servicioId: number;
  cantidad: number;
  costoUnit: number;
  subtotal: number;
  servicio?: Servicio;
}

export interface CompraDetalleCreate {
  servicioId: number;
  cantidad: number;
  costoUnit: number;
}

export interface PagoCompra {
  id: number;
  compraId: number;
  fecha: string;
  /** En moneda principal: es lo que baja el saldo. */
  monto: number;
  moneda: Moneda;
  montoMoneda: number;
  tasa: number;
  metodoPago: MetodoPago;
  nota: string | null;
}

export interface Compra {
  id: number;
  proveedorId: number;
  proveedor?: Proveedor;
  fecha: string;
  estado: EstadoCompra;
  total: number;
  montoPagado: number;
  /** Lo que aún se le debe al proveedor (0 si está cancelada o saldada). */
  saldo: number;
  fechaVencimiento: string | null;
  observaciones: string | null;
  detalles: CompraDetalle[];
  pagos?: PagoCompra[];
}

export interface CompraCreate {
  proveedorId: number;
  observaciones?: string | null;
  estado?: EstadoCompra;
  detalles: CompraDetalleCreate[];
  /** Pagado al registrar (moneda principal). Sin indicar: todo si se recibe, nada si queda pendiente. */
  pagoInicial?: number;
  fechaVencimiento?: string | null;
  metodoPago?: MetodoPago;
  desdeCaja?: boolean;
}

export interface PagoCompraCreate {
  monto: number;
  moneda?: Moneda;
  metodoPago?: MetodoPago;
  nota?: string | null;
  desdeCaja?: boolean;
}

export interface CuentasPorPagar {
  moneda: Moneda;
  total: number;
  vencido: number;
  proveedores: { proveedorId: number; nombre: string; saldo: number; vencido: number; compras: number }[];
  compras: (Compra & { vencida: boolean })[];
}

export interface Gasto {
  id: number;
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  moneda: Moneda;
  montoMoneda: number;
  tasa: number;
  metodoPago: MetodoPago;
  nota: string | null;
  cajaMovimientoId: number | null;
}

export interface GastoCreate {
  concepto: string;
  categoria: string;
  monto: number;
  moneda?: Moneda;
  metodoPago?: MetodoPago;
  fecha?: string;
  nota?: string | null;
  desdeCaja?: boolean;
}

export interface GastosListado {
  moneda: Moneda;
  total: number;
  porCategoria: { categoria: string; monto: number }[];
  categoriasSugeridas: string[];
  gastos: Gasto[];
}

export type ServicioSeleccionado = {
  servicioId: number;
  cantidad: number;
  descuento?: number;
  precio?: number;
};

export interface DetalleOrden {
  id: number;
  ordenId: number;
  servicioId: number;
  cantidad: number;
  precioUnit: number;
  costoUnit?: number | null;
  subtotal: number;
  descuento: number;
  impuesto: number;
  /** Importe sin impuesto, después del descuento. */
  base: number;
  cantidadDevuelta: number;
  orden?: Orden;
  servicio?: Servicio;
}

export interface DetalleOrdenCreate {
  ordenId: number;
  servicioId: number;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
}

export type DetalleOrdenUpdatePayload = Partial<DetalleOrdenCreate>;

export interface DescuentoOrden {
  tipo: "PORCENTAJE" | "MONTO";
  valor: number;
}

export interface OrdenCreate {
  clienteId?: number | null;
  descuento?: DescuentoOrden | null;
  entregaInmediata?: boolean;
  estado: EstadoOrden;
  observaciones?: string | null;
  fechaEntrega?: string | null;
  servicios: ServicioSeleccionado[];
}

export interface OrdenUpdatePayload {
  clienteId?: number | null;
  estado?: EstadoOrden;
  observaciones?: string | null;
  fechaEntrega?: string | null;
  deliveredByUserId?: number | null;
  deliveredByUserName?: string | null;
  servicios?: ServicioSeleccionado[];
  descuento?: DescuentoOrden | null;
}

export interface Orden {
  id: number;
  clienteId: number | null;
  estado: EstadoOrden;
  fechaIngreso: string;
  fechaEntrega: string | null;
  observaciones: string | null;
  total: number;
  subtotal: number;
  descuento: number;
  descuentoTipo: "PORCENTAJE" | "MONTO" | null;
  descuentoValor: number | null;
  impuesto: number;
  impuestoTasa: number | null;
  /** Valor ya devuelto al cliente (el total ya lo descuenta). */
  devuelto: number;
  abonado: number;
  faltante: number;
  estadoPago: EstadoPagoRaw;
  devoluciones?: Devolucion[];
  cliente?: Cliente;
  detalles?: (DetalleOrden & { servicio: Servicio })[];
  pagos?: Pago[];
  deliveredByUserId?: number | null;
  deliveredByUserName?: string | null;
  deliveredBy?: {
    id: number;
    name: string | null;
    email: string;
  } | null;
}

export interface DevolucionItem {
  id: number;
  detalleOrdenId: number;
  servicioId: number;
  cantidad: number;
  monto: number;
}

export interface Devolucion {
  id: number;
  ordenId: number;
  fecha: string;
  motivo: string | null;
  total: number;
  reembolso: number;
  detalles?: DevolucionItem[];
}

export interface DevolucionCreate {
  items: { detalleId: number; cantidad: number }[];
  motivo?: string | null;
  /** Devolver el dinero cobrado de más (por defecto sí). */
  reembolsar?: boolean;
  moneda?: Moneda;
  metodoPago?: MetodoPago;
}

export interface Pago {
  id: number;
  ordenId: number;
  monto: number;
  moneda: Moneda;
  metodoPago: MetodoPago;
  tasa?: number | null;
  nota: string | null;
  fechaPago: string;
  orden?: Orden & { cliente?: { nombre: string; apellido: string } };
  vueltos?: VueltoEntregado[];
}

export interface PagoCreate {
  ordenId: number;
  monto: number;
  moneda: Moneda;
  metodoPago: MetodoPago;
  nota?: string | null;
  vueltos?: VueltoEntregadoCreate[];
}

export interface PagoUpdatePayload {
  ordenId?: number;
  monto?: number;
  moneda?: Moneda;
  metodoPago?: MetodoPago;
  nota?: string | null;
  fechaPago?: string;
  tasa?: number;
  vueltos?: VueltoEntregadoCreate[];
}

export interface VueltoEntregado {
  id: number;
  pagoId: number;
  monto: number;
  moneda: string;
  pago?: Pago;
}

export interface VueltoEntregadoCreate {
  monto: number;
  moneda: Moneda;
}

export type Rubro = "LAVANDERIA" | "REPUESTOS" | "MINIMARKET" | "GENERICO";
export type MomentoDeduccion = "CREACION" | "ENTREGA";

// Etiquetas de UI que cambian según el rubro (ej. "Servicio" -> "Producto").
// Todas opcionales: si falta una, el frontend usa el default del rubro.
export interface Terminologia {
  // Plurales: los usa el menú y los títulos de lista
  servicio?: string;
  orden?: string;
  cliente?: string;
  // Singulares: botones y formularios ("Nueva venta", "Nuevo producto")
  servicioUno?: string;
  ordenUno?: string;
  clienteUno?: string;
}

export interface Configuracion {
  id: number;
  nombreNegocio: string | null;
  monedaPrincipal: Moneda;
  /** Monedas con las que se trabaja, separadas por coma ("USD,VES"); incluye la principal. */
  monedasActivas: string;
  /** Solo en lectura: hay ventas o pagos registrados, así que la moneda principal ya no se puede cambiar. */
  principalBloqueada?: boolean;
  tasaUSD: number | null;
  tasaVES: number | null;
  tasaCOP: number | null;
  rif: string | null;
  direccion: string | null;
  telefonoPrincipal: string | null;
  telefonoSecundario: string | null;
  mensajePieRecibo: string | null;

  rubro: Rubro;
  moduloInventario: boolean;
  moduloProveedores: boolean;
  moduloCaja: boolean;
  moduloPresupuestos: boolean;
  presupuestoValidezDias: number;
  presupuestoCondiciones: string | null;
  moduloFechaEntrega: boolean;
  moduloClienteTipo: boolean;
  clienteObligatorio: boolean;
  deduccionStockEn: MomentoDeduccion;
  terminologia: Terminologia | null;

  impuestoActivo: boolean;
  impuestoNombre: string;
  impuestoTasa: number;
  preciosIncluyenImpuesto: boolean;
  descuentoMaxPct: number;
}

export interface ConfiguracionCreate {
  nombreNegocio: string;
  monedaPrincipal: Moneda;
  monedasActivas?: Moneda[];
  tasaUSD?: number | null;
  tasaVES?: number | null;
  tasaCOP?: number | null;
  rif?: string | null;
  direccion?: string | null;
  telefonoPrincipal?: string | null;
  telefonoSecundario?: string | null;
  mensajePieRecibo?: string | null;
}

export type ConfiguracionUpdatePayload = Omit<Partial<Configuracion>, "monedasActivas" | "principalBloqueada"> & {
  monedasActivas?: Moneda[];
};

export interface TasasConversion {
  USD?: number | null;
  VES?: number | null;
  COP?: number | null;
}

export type Role = "ADMIN" | "EMPLOYEE" | "CAJERO";

export interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  role: Role;
}

export interface UserRegisterPayload {
  email: string;
  password: string;
  name?: string | null;
  role?: Role;
  /** Solo en servidores en internet: código que se definió al instalarlo. */
  codigoInstalacion?: string;
}

export interface UserLoginPayload {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: UserLoginPayload) => Promise<boolean>;
  logout: () => void;
  hasRole: (requiredRole: Role | Role[]) => boolean;
}

export interface ReciboItem {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  permiteDecimales: boolean;
}

export interface ReciboClienteInfo {
  nombre: string;
  apellido: string;
  identificacion: string;
  fechaIngreso: Date;
  fechaEntrega?: Date | null;
  telefono: string;
  telefono_secundario?: string | null;
}

export interface ReciboLavanderiaInfo {
  nombre: string;
  rif: string | null;
  direccion: string | null;
  telefonoPrincipal: string | null;
  telefonoSecundario: string | null;
}

export interface ReciboData {
  clienteInfo: ReciboClienteInfo;
  items: ReciboItem[];
  abono: number;
  total: number;
  lavanderiaInfo: ReciboLavanderiaInfo;
  numeroOrden?: number;
  observaciones: string | null;
  mensajePieRecibo: string | null;
  monedaPrincipal: Moneda;
  totalCantidadPiezas: number;
  /** Quién atendió (usuario que imprime). */
  atendio?: string | null;
  /** Cómo pagó el cliente, en la moneda en que entregó cada pago (y el vuelto que recibió). */
  pagos?: {
    metodo: string;
    moneda: Moneda;
    monto: number;
    vueltos: { monto: number; moneda: string }[];
  }[];
  /** Solo cuando la venta lleva descuento o impuesto. */
  desglose?: {
    subtotal: number;
    descuento: number;
    impuesto: number;
    impuestoNombre: string;
    impuestoTasa: number | null;
    impuestoIncluido: boolean;
    devuelto: number;
  };
}

// --- Reportes y dashboard (importes en moneda principal) ---

export interface SerieReportePunto {
  fecha: string; // AAAA-MM-DD o AAAA-MM según la agrupación
  ventas: number;
  cantidad: number;
  cobrado: number;
}

export interface ReporteTopItem {
  servicioId: number;
  nombre: string;
  cantidad: number;
  total: number;
  ganancia: number | null;
}

export interface StockBajoResumen {
  cantidad: number;
  items: { id: number; nombreServicio: string; stockActual: number; stockMinimo: number | null }[];
}

export interface PorCobrarResumen {
  cantidad: number;
  monto: number;
}

export interface ReporteResumen {
  rango: { desde: string; hasta: string; dias: number; agrupar: "dia" | "mes" };
  moneda: Moneda;
  ventas: {
    cantidad: number;
    canceladas: number;
    total: number;
    ticketPromedio: number;
    descuentos: number;
    impuestos: number;
  };
  devoluciones: { cantidad: number; total: number };
  gastos: {
    cantidad: number;
    total: number;
    porCategoria: { categoria: string; monto: number }[];
    /** Ganancia (líneas con costo) menos los gastos del periodo. */
    gananciaNeta: number;
  };
  porPagar: PorCobrarResumen;
  cobros: {
    total: number;
    cantidad: number;
    porMetodo: { metodo: string; monto: number }[];
    porMoneda: { moneda: string; recibido: number; vueltos: number; neto: number }[];
  };
  ganancia: {
    ventaConCosto: number;
    costo: number;
    ganancia: number;
    margen: number | null;
    ventaSinCosto: number;
    lineasSinCosto: number;
  };
  comparacion: {
    ventasPrevias: number;
    cobradoPrevio: number;
    variacionVentas: number | null;
    variacionCobrado: number | null;
  };
  porEstado: { estado: string; cantidad: number }[];
  serie: SerieReportePunto[];
  topItems: ReporteTopItem[];
  clientes: {
    top: { clienteId: number; nombre: string; ventas: number; total: number }[];
    sinCliente: { ventas: number; total: number };
  };
  porCobrar: PorCobrarResumen;
  stockBajo: StockBajoResumen;
}

export interface DashboardData {
  moneda: Moneda;
  totalOrdenes: number;
  pendientes: number;
  listas: number;
  entregadas: number;
  ventasHoy: number;
  cobradoHoy: number;
  // Solo para ADMIN/EMPLOYEE
  ultimos7?: SerieReportePunto[];
  porCobrar?: PorCobrarResumen;
  porPagar?: PorCobrarResumen;
  stockBajo?: StockBajoResumen;
  /** Solo con el módulo de presupuestos activo. */
  presupuestos?: AlertasPresupuestos;
}

// --- Cuentas por cobrar (deudas de clientes, con antigüedad) ---

export interface CuentaPorCobrarOrden {
  id: number;
  fecha: string;
  total: number;
  abonado: number;
  faltante: number;
  dias: number;
}

export interface CuentaPorCobrarCliente {
  clienteId: number | null;
  nombre: string;
  telefono: string | null;
  /** Suma de lo que debe. */
  monto: number;
  /** Días de la deuda más antigua. */
  masAntigua: number;
  ordenes: CuentaPorCobrarOrden[];
}

export interface CuentasPorCobrar {
  moneda: Moneda;
  corte: string;
  cantidad: number;
  monto: number;
  antiguedad: { id: string; etiqueta: string; monto: number; cantidad: number }[];
  clientes: CuentaPorCobrarCliente[];
}

/** Una venta en el libro de ventas (importes en la moneda indicada por el libro, netos de devoluciones). */
export interface FilaLibroVentas {
  id: number;
  fecha: string;
  cliente: string;
  identificacion: string | null;
  /** Total de la venta con impuesto incluido. */
  total: number;
  /** Parte de la venta sin impuesto por ser exenta o por no cobrarse impuesto. */
  exento: number;
  /** Base imponible: lo gravado, sin el impuesto. */
  baseImponible: number;
  /** Alícuota aplicada (%), 0 si no hubo impuesto. */
  alicuota: number;
  iva: number;
  /** Unidades de la moneda del libro por 1 de la principal, con las que se convirtió esta venta. */
  tasa: number;
  /** false: la venta es anterior a que se guardara su tasa y se usó la actual. */
  tasaDelDia: boolean;
  /** La venta tuvo devoluciones: los importes ya las descuentan. */
  conDevolucion: boolean;
}

export interface LibroVentas {
  desde: string;
  hasta: string;
  moneda: Moneda;
  /** Moneda principal del sistema, en la que están guardadas las ventas. */
  principal: Moneda;
  contribuyente: { nombre: string; rif: string | null; direccion: string | null };
  filas: FilaLibroVentas[];
  totales: { total: number; exento: number; baseImponible: number; iva: number };
  anuladas: number;
  /** Ventas convertidas con la tasa actual por no tener guardada la de su día. */
  conTasaActual: number;
}

// ---- Presupuestos ----

export interface AlertasPresupuestos {
  /** Pendientes (borrador o enviado) cuya fecha de validez ya pasó. */
  vencidos: number;
  /** Pendientes que vencen hoy o en los próximos `diasAviso` días. */
  porVencer: number;
  diasAviso: number;
}

export type EstadoPresupuesto = "BORRADOR" | "ENVIADO" | "ACEPTADO" | "RECHAZADO" | "CONVERTIDO";
/** Lo que ve el usuario: los pendientes cuya fecha de validez ya pasó figuran como vencidos. */
export type EstadoPresupuestoVisible = EstadoPresupuesto | "VENCIDO";

export interface PresupuestoLinea {
  id: number;
  presupuestoId: number;
  servicioId: number | null;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  exento: boolean;
  subtotal: number;
  descuento: number;
  impuesto: number;
  base: number;
}

export interface Presupuesto {
  id: number;
  clienteId: number | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  fecha: string;
  validoHasta: string;
  estado: EstadoPresupuesto;
  estadoVisible: EstadoPresupuestoVisible;
  observaciones: string | null;
  condiciones: string | null;
  subtotal: number;
  descuento: number;
  descuentoTipo: "PORCENTAJE" | "MONTO" | null;
  descuentoValor: number | null;
  impuesto: number;
  impuestoTasa: number | null;
  total: number;
  ordenId: number | null;
  userName: string | null;
  cliente?: {
    id: number;
    nombre: string;
    apellido: string | null;
    telefono?: string | null;
    identificacion?: string | null;
    direccion?: string | null;
    email?: string | null;
  } | null;
  detalles?: PresupuestoLinea[];
  _count?: { detalles: number };
}

export interface PresupuestoInput {
  clienteId: number | null;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
  validoHasta?: string;
  observaciones?: string | null;
  condiciones?: string | null;
  descuento?: DescuentoOrden | null;
  lineas: { servicioId?: number | null; descripcion?: string; cantidad: number; precio: number; exento?: boolean }[];
}

// ---- Toma de inventario físico ----

export type EstadoConteo = "ABIERTO" | "APLICADO" | "CANCELADO";

export interface ConteoDetalle {
  id: number;
  conteoId: number;
  servicioId: number;
  contado: number;
  /** Al aplicar: lo que decía el sistema en ese momento. */
  esperado: number | null;
  diferencia: number | null;
  costoUnit: number | null;
  servicio: {
    id: number;
    nombreServicio: string;
    sku: string | null;
    codigoBarras: string | null;
    stockActual: number;
    costoBase: number | null;
    permiteDecimales: boolean;
    unidadMedida: string;
  };
}

export interface ResumenConteo {
  contados: number;
  conDiferencia: number;
  sobrantes: number;
  faltantes: number;
  valorSobrante: number;
  valorFaltante: number;
}

export interface ConteoInventario {
  id: number;
  nombre: string | null;
  categoriaId: string | null;
  categoriaNombre?: string | null;
  estado: EstadoConteo;
  creadoEn: string;
  aplicadoEn: string | null;
  userName: string | null;
  detalles?: ConteoDetalle[];
  resumen?: ResumenConteo;
  _count?: { detalles: number };
}
