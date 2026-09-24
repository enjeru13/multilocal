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

const base =
  "inline-flex items-center justify-center font-medium rounded-lg whitespace-nowrap transition-colors duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-gray-900 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-[15px] gap-2.5",
  icon: "h-8 w-8 text-xs",
};

// Sólidos: acción principal. Suaves ("icon*"): acciones por fila, sin borde, con tinte.
const variants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-xs focus-visible:ring-blue-500",
  secondary:
    "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 shadow-xs focus-visible:ring-gray-400",
  danger: "bg-red-600 hover:bg-red-700 text-white shadow-xs focus-visible:ring-red-500",
  outline:
    "bg-transparent border border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-500/60 hover:bg-blue-50 dark:hover:bg-blue-500/10 focus-visible:ring-blue-500",
  ghost:
    "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 focus-visible:ring-gray-400",
  whatsapp: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus-visible:ring-emerald-500",
  edit: "bg-amber-500 hover:bg-amber-600 text-white shadow-xs focus-visible:ring-amber-500",

  iconNeutral:
    "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:ring-gray-400",
  iconInfo:
    "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 focus-visible:ring-blue-500",
  iconWarning:
    "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 focus-visible:ring-amber-500",
  iconSuccess:
    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 focus-visible:ring-emerald-500",
  iconDanger:
    "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 focus-visible:ring-red-500",
};

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
}) => (
  <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || isLoading} {...props}>
    {isLoading && <CgSpinner className="animate-spin text-lg" />}
    {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
    {children}
    {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
  </button>
);

export default Button;
