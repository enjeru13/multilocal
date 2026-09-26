import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { FaUser, FaBuilding, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaFileSignature, FaPlus, FaWhatsapp, FaCopy, FaMoneyBillWave } from "react-icons/fa";
import type { Cliente, CuentaPorCobrarCliente, Presupuesto } from "@lavanderia/shared/types/types";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { ModalEncabezado, ModalPie } from "../ui/Formulario";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";
import { useAuth } from "../../hooks/useAuth";
import { presupuestosService } from "../../services/presupuestosService";
import { reportesService } from "../../services/reportesService";
import { useMonedas } from "../../context/useMonedas";
import { enlaceEstadoCuenta, textoEstadoCuenta } from "../../utils/estadoCuenta";
import { formatearMoneda, normalizarMoneda } from "../../utils/monedaHelpers";
import EtiquetaEstado from "../presupuesto/EtiquetaEstado";

type Props = {
  cliente: Cliente;
  onClose: () => void;
};

function Dato({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs shrink-0">{icono}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{etiqueta}</p>
        <div className="text-sm text-gray-900 dark:text-gray-100 break-words">{children}</div>
      </div>
    </div>
  );
}

const nombreDe = (c: Cliente) => [c.nombre, c.apellido].filter(Boolean).join(" ") || "cliente";

export default function ModalInfoCliente({ cliente, onClose }: Props) {
  const et = useEtiquetas();
  const navigate = useNavigate();
  const { config } = useConfiguracion();
  const { hasRole } = useAuth();
  const verPresupuestos = !!config?.moduloPresupuestos && hasRole(["ADMIN", "EMPLOYEE"]);
  const moneda = normalizarMoneda(config?.monedaPrincipal ?? "USD");
  const [presupuestos, setPresupuestos] = useState<Presupuesto[] | null>(null);

  // Lo que debe este cliente: se pide el reporte de cuentas por cobrar y se toma su parte.
  const negocioMonedas = useMonedas();
  const verCuenta = hasRole(["ADMIN", "EMPLOYEE"]);
  const [cuenta, setCuenta] = useState<CuentaPorCobrarCliente | null | undefined>(undefined);

  useEffect(() => {
    if (!verCuenta) return;
    reportesService
      .porCobrar()
      .then((r) => setCuenta(r.data.clientes.find((c) => c.clienteId === cliente.id) ?? null))
      .catch(() => setCuenta(null));
  }, [verCuenta, cliente.id]);

  const opcionesCuenta = { negocio: config?.nombreNegocio || "nuestro negocio", moneda: negocioMonedas.principal, otras: negocioMonedas.otrasUsables, tasas: negocioMonedas.tasas, documento: et.ordenMin };
  const conCuenta = cuenta ? { ...cuenta, nombre: nombreDe(cliente) } : null;
  const enlaceCuenta = conCuenta ? enlaceEstadoCuenta(conCuenta, cliente.telefono, opcionesCuenta) : null;
  const copiarCuenta = async () => {
    if (!conCuenta) return;
    try {
      await navigator.clipboard.writeText(textoEstadoCuenta(conCuenta, opcionesCuenta));
      toast.success("Estado de cuenta copiado.");
    } catch {
      toast.error("No se pudo copiar el texto.");
    }
  };

  useEffect(() => {
    if (!verPresupuestos) return;
    presupuestosService
      .getAll({ clienteId: cliente.id })
      .then((r) => setPresupuestos(r.data))
      .catch(() => setPresupuestos([]));
  }, [verPresupuestos, cliente.id]);

  const ir = (ruta: string) => {
    onClose();
    navigate(ruta);
  };

  const nombre = [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") || "Sin nombre";
  const vacio = <span className="text-gray-400">—</span>;

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md" className="max-h-[92dvh] flex flex-col overflow-hidden">
      <ModalEncabezado
        icono={cliente.tipo === "EMPRESA" ? <FaBuilding /> : <FaUser />}
        titulo={nombre}
        subtitulo={`${et.cliente} · ${cliente.identificacion || "sin documento"}`}
        onClose={onClose}
      />
      <div className="px-4 sm:px-6 py-2 flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        <Dato icono={<FaPhoneAlt />} etiqueta="Teléfono">
          {cliente.telefono || vacio}
        </Dato>
        {cliente.telefono_secundario && (
          <Dato icono={<FaPhoneAlt />} etiqueta="Teléfono secundario">
            {cliente.telefono_secundario}
          </Dato>
        )}
        <Dato icono={<FaEnvelope />} etiqueta="Correo">
          {cliente.email || vacio}
        </Dato>
        <Dato icono={<FaMapMarkerAlt />} etiqueta="Dirección">
          {cliente.direccion || vacio}
        </Dato>

        {verCuenta && cuenta !== undefined && (
          <div className="py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-2">
              <FaMoneyBillWave /> Cuenta
            </p>
            {conCuenta ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-amber-900 dark:text-amber-200">
                    Debe en {conCuenta.ordenes.length} {conCuenta.ordenes.length === 1 ? et.ordenMin : et.ordenesMin}
                    {conCuenta.masAntigua > 0 && <span className="text-xs opacity-80"> · la más antigua, {conCuenta.masAntigua} días</span>}
                  </span>
                  <strong className="text-lg tabular-nums text-amber-900 dark:text-amber-100">{formatearMoneda(conCuenta.monto, negocioMonedas.principal)}</strong>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="whatsapp" size="sm" leftIcon={<FaWhatsapp />} disabled={!enlaceCuenta} title={enlaceCuenta ? undefined : "Falta un teléfono válido"} onClick={() => enlaceCuenta && window.open(enlaceCuenta, "_blank", "noopener")}>
                    Enviar estado de cuenta
                  </Button>
                  <Button variant="secondary" size="sm" leftIcon={<FaCopy />} onClick={copiarCuenta}>
                    Copiar texto
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Está al día: no debe nada.</p>
            )}
          </div>
        )}

        {verPresupuestos && (
          <div className="py-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <FaFileSignature /> Presupuestos{presupuestos && presupuestos.length > 0 ? ` (${presupuestos.length})` : ""}
              </p>
              <button type="button" onClick={() => ir(`/presupuestos/nuevo?cliente=${cliente.id}`)} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer">
                <FaPlus size={9} /> Nuevo
              </button>
            </div>
            {presupuestos === null ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : presupuestos.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no tiene presupuestos.</p>
            ) : (
              <>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
                  {presupuestos.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => ir(`/presupuestos/${p.id}`)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">N.º {p.id}</span>
                          <span className="block text-xs text-gray-500">{dayjs(p.fecha).format("DD/MM/YYYY")}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <EtiquetaEstado p={p} />
                          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatearMoneda(p.total, moneda)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {presupuestos.length > 4 && (
                  <button type="button" onClick={() => ir(`/presupuestos?cliente=${cliente.id}`)} className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Ver los {presupuestos.length} presupuestos
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <ModalPie>
        <Button onClick={onClose} variant="secondary">
          Cerrar
        </Button>
      </ModalPie>
    </Modal>
  );
}
