import React from "react";
import { CgSpinner } from "react-icons/cg";

type ButtonVariant =
    | "primary"
    | "secondary"
    | "danger"
    | "outline"
    | "ghost"
    | "whatsapp"
    | "edit"
    | "iconNeutral"
    | "iconInfo"
    | "iconWarning"
    | "iconSuccess"
    | "iconDanger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
    className = "",
    variant = "primary",
    size = "md",
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-semibold rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100";

    const sizeStyles = {
        sm: "px-3 py-1.5 text-xs gap-1.5",
        md: "px-5 py-2.5 text-sm gap-2",
        lg: "px-6 py-3 text-base gap-2.5",
        icon: "p-2 text-xs",
    };

    // Botones de acción "principal": color sólido plano, sin gradiente.
    // Botones "icon*": versión compacta con tinte suave, para acciones por fila en tablas.
    const variantStyles = {
        primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-transparent focus:ring-blue-500",
        secondary: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-400",
        danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm border border-transparent focus:ring-red-500",
        outline: "bg-transparent border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:ring-blue-500",
        ghost: "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 focus:ring-gray-400",
        whatsapp: "bg-green-600 hover:bg-green-700 text-white shadow-sm border border-transparent focus:ring-green-500",
        edit: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm border border-transparent focus:ring-amber-500",

        iconNeutral: "bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:ring-gray-400",
        iconInfo: "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:ring-blue-500",
        iconWarning: "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 focus:ring-amber-500",
        iconSuccess: "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 focus:ring-green-500",
        iconDanger: "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 focus:ring-red-500",
    };

    return (
        <button
            className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <CgSpinner className="animate-spin text-xl" />}
            {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </button>
    );
};

export default Button;
