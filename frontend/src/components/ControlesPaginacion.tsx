import React from "react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  return (
    <div
      className={`flex justify-between items-center mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 transition-all ${className || ""
        }`}
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-sm cursor-pointer"
      >
        Anterior
      </button>
      <span className="text-gray-700 dark:text-gray-300 font-bold transition-colors">
        Página {currentPage} de {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-sm cursor-pointer"
      >
        Siguiente
      </button>
    </div>
  );
};

export default PaginationControls;
