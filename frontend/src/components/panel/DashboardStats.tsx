import type { IconType } from "react-icons";
import { useConfiguracion, useEtiquetas } from "../../context/configuracionCore";
import {
    FaClipboardList,
    FaClock,
    FaCheckCircle,
    FaMoneyBillWave,
    FaHandHoldingUsd,
    FaFileInvoiceDollar,
} from "react-icons/fa";
import type { DashboardData } from "@lavanderia/shared/types/types";
import { formatearMoneda } from "../../utils/monedaHelpers";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: IconType;
    colorName: "blue" | "yellow" | "green" | "indigo" | "emerald" | "rose";
    description: string;
}

const colorMap = {
    blue: {
        bg: "bg-blue-500/10",
        text: "text-blue-600 dark:text-blue-400",
    },
    yellow: {
        bg: "bg-yellow-500/10",
        text: "text-yellow-600 dark:text-yellow-400",
    },
    green: {
        bg: "bg-green-500/10",
        text: "text-green-600 dark:text-green-400",
    },
    indigo: {
        bg: "bg-indigo-500/10",
        text: "text-indigo-600 dark:text-indigo-400",
    },
    emerald: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-600 dark:text-emerald-400",
    },
    rose: {
        bg: "bg-rose-500/10",
        text: "text-rose-600 dark:text-rose-400",
    },
};

function StatCard({ title, value, icon: Icon, colorName, description }: StatCardProps) {
    const colors = colorMap[colorName];

    return (
        <div className="bg-white dark:bg-gray-900 p-3.5 sm:p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-3 sm:gap-4">
            <div className={`p-2.5 sm:p-3.5 rounded-lg ${colors.bg} max-[400px]:hidden`}>
                <Icon className={`text-xl sm:text-2xl ${colors.text}`} />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate uppercase tracking-wider">{title}</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{value}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{description}</p>
            </div>
        </div>
    );
}

interface DashboardStatsProps {
    data: DashboardData | null;
}

export default function DashboardStats({ data }: DashboardStatsProps) {
    const { config } = useConfiguracion();
    const et = useEtiquetas();
    const conEntrega = config?.moduloFechaEntrega !== false;
    const moneda = data?.moneda ?? "USD";
    const fmt = (n: number | undefined) => formatearMoneda(n ?? 0, moneda);
    // Las cifras de dinero (ventas, cobrado, por cobrar) solo llegan del servidor si eres ADMIN.
    const veDinero = data?.ventasHoy !== undefined;
    const tarjetas = 1 + (conEntrega ? 2 : 0) + (veDinero ? 2 : 0) + (data?.porCobrar ? 1 : 0);

    return (
        <div
            className={`grid grid-cols-2 gap-2.5 sm:gap-4 mb-6 sm:mb-8 ${tarjetas === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
        >
            <StatCard
                title={`Total ${et.ordenes}`}
                value={data?.totalOrdenes ?? 0}
                icon={FaClipboardList}
                colorName="blue"
                description="Historial total"
            />
            {conEntrega && (
                <>
                    <StatCard
                        title="Pendientes"
                        value={data?.pendientes ?? 0}
                        icon={FaClock}
                        colorName="yellow"
                        description="Por entregar"
                    />
                    <StatCard
                        title="Entregadas"
                        value={data?.entregadas ?? 0}
                        icon={FaCheckCircle}
                        colorName="green"
                        description={`Listas para ${et.clienteMin}`}
                    />
                </>
            )}
            {veDinero && (
                <>
                    <StatCard
                        title="Ventas Hoy"
                        value={fmt(data?.ventasHoy)}
                        icon={FaMoneyBillWave}
                        colorName="indigo"
                        description="Total facturado hoy"
                    />
                    <StatCard
                        title="Cobrado Hoy"
                        value={fmt(data?.cobradoHoy)}
                        icon={FaHandHoldingUsd}
                        colorName="emerald"
                        description="Efectivo/Pago real"
                    />
                </>
            )}
            {data?.porCobrar && (
                <StatCard
                    title="Por cobrar"
                    value={fmt(data.porCobrar.monto)}
                    icon={FaFileInvoiceDollar}
                    colorName="rose"
                    description={`${data.porCobrar.cantidad} ${data.porCobrar.cantidad === 1 ? et.ordenMin : et.ordenesMin} con saldo`}
                />
            )}
        </div>
    );
}
