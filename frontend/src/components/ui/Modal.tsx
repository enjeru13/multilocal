import { Fragment } from "react";
import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

// Envoltorio único para todos los modales: da focus-trap, cierre con ESC,
// clic-afuera-cierra y transición, sin repetir el boilerplate de Headless UI
// en cada modal. En teléfono se presenta como hoja que sube desde abajo (al alcance
// del pulgar y respetando el área segura); en pantallas mayores, como ventana centrada.
export default function Modal({
  open,
  onClose,
  children,
  maxWidth = "max-w-md",
  className = "",
}: ModalProps) {
  return (
    <Transition show={open} appear as={Fragment}>
      <Dialog onClose={onClose} className="relative z-100">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-950/50 dark:bg-black/60 backdrop-blur-[2px]" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-250"
            enterFrom="opacity-0 translate-y-10 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-10 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel
              className={`w-full ${maxWidth} max-sm:max-h-[94dvh] bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200/80 dark:border-gray-800 max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)] ${className}`}
            >
              <div className="sm:hidden shrink-0 mx-auto mt-2 mb-0.5 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" aria-hidden="true" />
              {children}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
