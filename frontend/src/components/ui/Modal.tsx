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
// en cada modal. El contenido interno (header/body/footer) no cambia.
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

        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              className={`w-full ${maxWidth} bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/80 dark:border-gray-800 ${className}`}
            >
              {children}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
