import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw, X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import type { UndoToastItem } from '../../lib/types';

interface UndoToastProps {
  toasts: UndoToastItem[];
  onUndo: (toast: UndoToastItem) => void;
  onDismiss: (id: string) => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ toasts, onUndo, onDismiss }) => {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon =
            toast.tone === 'success'
              ? CheckCircle2
              : toast.tone === 'warning'
                ? AlertTriangle
                : Info;
          const iconColor =
            toast.tone === 'success'
              ? 'text-emerald-600'
              : toast.tone === 'warning'
                ? 'text-amber-600'
                : 'text-blue-600';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-white border border-gray-200 w-[calc(100vw-24px)] sm:w-auto sm:min-w-[280px] max-w-[520px]"
              style={{ boxShadow: '0 10px 30px -8px rgba(15, 23, 42, 0.16)' }}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900 truncate">{toast.message}</div>
                {toast.detail && (
                  <div className="text-[11.5px] text-gray-500 truncate">{toast.detail}</div>
                )}
              </div>
              {(toast.undoId || toast.proposalId || toast.onUndo) && (
                <button
                  type="button"
                  onClick={() => onUndo(toast)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex-shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
