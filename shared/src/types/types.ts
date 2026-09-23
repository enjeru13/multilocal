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

export interface Compra {
  id: number;
  proveedorId: number;
  proveedor?: Proveedor;
  fecha: string;
  estado: EstadoCompra;
  total: number;
  observaciones: string | null;
  detalles: CompraDetalle[];
}

export interface CompraCreate {
  proveedorId: number;
  observaciones?: string | null;
  estado?: EstadoCompra;
  detalles: CompraDetalleCreate[];
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
  subtotal: number;
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

export interface OrdenCreate {
  clienteId?: number | null;
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
}

export interface Orden {
  id: number;
  clienteId: number | null;
  estado: EstadoOrden;
  fechaIngreso: string;
  fechaEntrega: string | null;
  observaciones: string | null;
  total: number;
  abonado: number;
  faltante: number;
  estadoPago: EstadoPagoRaw;
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
  moduloFechaEntrega: boolean;
  moduloClienteTipo: boolean;
  clienteObligatorio: boolean;
  deduccionStockEn: MomentoDeduccion;
  terminologia: Terminologia | null;
}

export interface ConfiguracionCreate {
  nombreNegocio: string;
  monedaPrincipal: Moneda;
  tasaUSD?: number | null;
  tasaVES?: number | null;
  tasaCOP?: number | null;
  rif?: string | null;
  direccion?: string | null;
  telefonoPrincipal?: string | null;
  telefonoSecundario?: string | null;
  mensajePieRecibo?: string | null;
}

export type ConfiguracionUpdatePayload = Partial<Configuracion>;

export interface TasasConversion {
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
}
