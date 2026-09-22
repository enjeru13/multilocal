import { IconType } from "react-icons";
import { FaClipboardList, FaClock, FaCheckCircle, FaMoneyBillWave, FaHandHoldingUsd } from "react-icons/fa";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: IconType;
    colorName: "blue" | "yellow" | "green" | "indigo" | "emerald";
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
};

function StatCard({ title, value, icon: Icon, colorName, description }: StatCardProps) {
    const colors = colorMap[colorName];

    return (
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
            <div className={`p-3.5 rounded-lg ${colors.bg}`}>
                <Icon className={`text-2xl ${colors.text}`} />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate uppercase tracking-wider">{title}</p>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{value}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{description}</p>
            </div>
        </div>
    );
}

interface DashboardStatsProps {
    stats: {
        totalOrdenes: number;
        pendientes: number;
        entregadas: number;
        ventasHoy: string;
        cobradoHoy: string;
    };
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            <StatCard
                title="Total Órdenes"
                value={stats.totalOrdenes}
                icon={FaClipboardList}
                colorName="blue"
                description="Historial total"
            />
            <StatCard
                title="Pendientes"
                value={stats.pendientes}
                icon={FaClock}
                colorName="yellow"
                description="Por entregar"
            />
            <StatCard
                title="Entregadas"
                value={stats.entregadas}
                icon={FaCheckCircle}
                colorName="green"
                description="Listas para cliente"
            />
            <StatCard
                title="Ventas Hoy"
                value={stats.ventasHoy}
                icon={FaMoneyBillWave}
                colorName="indigo"
                description="Total facturado hoy"
            />
            <StatCard
                title="Cobrado Hoy"
                value={stats.cobradoHoy}
                icon={FaHandHoldingUsd}
                colorName="emerald"
                description="Efectivo/Pago real"
            />
        </div>
    );
}
