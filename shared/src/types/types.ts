export type Moneda = "USD" | "VES" | "COP";
export type TipoCliente = "NATURAL" | "EMPRESA";
export type EstadoOrden = "PENDIENTE" | "ENTREGADO";
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

export interface Servicio {
  id: number;
  nombreServicio: string;
  descripcion: string | null;
  precioBase: number;
  permiteDecimales: boolean;
  categoriaId: string;
  categoria?: Categoria;

  detalleOrdenes?: DetalleOrden[];
}

export interface ServicioCreate {
  nombreServicio: string;
  descripcion?: string | null;
  precioBase: number;
  permiteDecimales: boolean;
  categoriaId: string;
}

export type ServicioUpdatePayload = Partial<ServicioCreate>;

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
  clienteId: number;
  estado: EstadoOrden;
  observaciones?: string | null;
  fechaEntrega?: string | null;
  servicios: ServicioSeleccionado[];
}

export interface OrdenUpdatePayload {
  clienteId?: number;
  estado?: EstadoOrden;
  observaciones?: string | null;
  fechaEntrega?: string | null;
  deliveredByUserId?: number | null;
  deliveredByUserName?: string | null;
  servicios?: ServicioSeleccionado[];
}

export interface Orden {
  id: number;
  clienteId: number;
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

export type Role = "ADMIN" | "EMPLOYEE";

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
