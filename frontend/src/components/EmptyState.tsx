import { IconType } from "react-icons";
import { FaInbox } from "react-icons/fa";

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: IconType;
    actionLabel?: string;
    onAction?: () => void;
}

export default function EmptyState({
    title,
    description,
    icon: Icon = FaInbox,
    actionLabel,
    onAction,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 animate-fade-in">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4 transition-colors">
                <Icon size={48} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                {title}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-6 py-2.5 bg-blue-600 dark:bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg transform active:scale-95 cursor-pointer"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
