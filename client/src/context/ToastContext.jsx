import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message, { type = 'success', action, duration = 4200 } = {}) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, type, action }]);
      if (duration) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show, success: (m, o) => show(m, { ...o, type: 'success' }), error: (m, o) => show(m, { ...o, type: 'error', duration: 6500 }) }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" role="region" aria-label="Notifications">
        <div aria-live="polite" aria-atomic="false" className="flex w-full flex-col items-center gap-2 sm:items-end">
          <AnimatePresence initial={false}>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md bg-ink px-4 py-3.5 text-sm text-white shadow-[var(--shadow-float)]"
                role={t.type === 'error' ? 'alert' : 'status'}
              >
                {t.type === 'error' ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#ff8a7a]" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />}
                <div className="flex-1">
                  <p>{t.message}</p>
                  {t.action && (
                    <button type="button" onClick={() => { t.action.onClick(); dismiss(t.id); }} className="link mt-1 font-semibold">
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded p-1 text-white/60 hover:text-white" aria-label="Dismiss notification">
                  <X className="size-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
