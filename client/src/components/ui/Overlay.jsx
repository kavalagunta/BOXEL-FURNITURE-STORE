import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { EASE } from './Reveal.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Traps focus inside the panel, closes on Escape, locks page scroll and restores focus on close. */
function useDialogBehaviour(open, onClose, panelRef) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector('[data-autofocus]') || panelRef.current?.querySelector(FOCUSABLE);
      (first || panelRef.current)?.focus();
    }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous && previous.focus) previous.focus();
    };
  }, [open, onClose, panelRef]);
}

export function Modal({ open, onClose, title, children, size = 'max-w-lg', hideTitle = false }) {
  const panel = useRef(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, panel);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`relative max-h-[92vh] w-full ${size} overflow-y-auto rounded-t-lg bg-white shadow-[var(--shadow-float)] sm:rounded-lg`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <div className={`flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 ${hideTitle ? 'absolute right-0 top-0 z-10' : ''}`}>
              <h2 id={titleId} className={hideTitle ? 'sr-only' : 'text-title font-medium'}>
                {title}
              </h2>
              <button type="button" onClick={onClose} className="-mr-1.5 -mt-1 rounded-full bg-white/90 p-2 text-ink hover:bg-stone" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="px-5 pb-6 pt-3 sm:px-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer, side = 'right', width = 'max-w-md' }) {
  const panel = useRef(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, panel);
  const from = side === 'right' ? '100%' : '-100%';
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div className="absolute inset-0 bg-ink/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`absolute inset-y-0 ${side === 'right' ? 'right-0' : 'left-0'} flex w-full ${width} flex-col bg-white shadow-[var(--shadow-float)]`}
            initial={{ x: from }}
            animate={{ x: 0 }}
            exit={{ x: from, transition: { duration: 0.25, ease: [0.65, 0, 0.35, 1] } }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <h2 id={titleId} className="text-lg font-medium">
                {title}
              </h2>
              <button type="button" onClick={onClose} className="-mr-2 rounded-full p-2 hover:bg-stone" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="border-t border-hairline p-5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
