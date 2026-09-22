import React from "react";

interface SkeletonProps {
    className?: string;
    variant?: "rect" | "circle" | "text";
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = "",
    variant = "rect"
}) => {
    const baseClasses = "bg-gray-200 dark:bg-gray-700 animate-pulse-subtle relative overflow-hidden";
    const variantClasses = {
        rect: "rounded-md",
        circle: "rounded-full",
        text: "rounded-sm h-4 w-full",
    };

    return (
        <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
            <div className="shimmer absolute inset-0" />
        </div>
    );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
    rows = 5,
    cols = 4
}) => {
    return (
        <div className="w-full space-y-4 animate-slide-in">
            <div className="flex gap-4 mb-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32 ml-auto" />
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-gray-200 dark:border-gray-800 flex gap-4">
                    {Array.from({ length: cols }).map((_, i) => (
                        <Skeleton key={i} className="h-5 flex-1" />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="p-4 flex gap-4 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                        {Array.from({ length: cols }).map((_, j) => (
                            <Skeleton key={j} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const FormSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800/50">
            <div className="flex items-center gap-4 mb-8">
                <Skeleton variant="circle" className="h-12 w-12" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2 col-span-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
            <div className="flex justify-end gap-4 mt-8">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
    );
};
