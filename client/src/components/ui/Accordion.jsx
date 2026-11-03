import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { EASE } from './Reveal.jsx';
import { paragraphs } from '../../utils/format.js';

/** WAI-ARIA accordion: buttons with aria-expanded / aria-controls, regions labelled by their headings. */
export function AccordionItem({ question, answer, defaultOpen = false, headingLevel = 3, variant = 'line' }) {
  const card = variant === 'card';
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const H = `h${headingLevel}`;
  return (
    <div
      className={
        card
          ? `rounded-2xl px-5 transition-[background-color,box-shadow] duration-500 sm:px-7 ${open ? 'bg-white shadow-[var(--shadow-card-hover)] ring-1 ring-black/[0.04]' : 'bg-stone hover:bg-stone-2'}`
          : 'border-b border-hairline'
      }
    >
      <H className="m-0">
        <button
          type="button"
          id={`${id}-btn`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full items-start justify-between gap-6 py-5 text-left text-[1.0625rem] font-medium leading-snug sm:py-6 sm:text-lg"
        >
          <span>{question}</span>
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.3, ease: EASE }} className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-300 ${card ? (open ? 'bg-signal text-ink' : 'bg-white text-ink shadow-sm') : 'border border-hairline group-hover:border-ink'}`}>
            <Plus className="size-4" aria-hidden />
          </motion.span>
        </button>
      </H>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-btn`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="max-w-[68ch] pb-6 pr-12 text-graphite">
              {paragraphs(answer).map((p, i) => (
                <p key={i} className={i ? 'mt-3' : ''}>
                  {p}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Accordion({ items, headingLevel }) {
  return (
    <div className="border-t border-hairline">
      {items.map((f) => (
        <AccordionItem key={f.id ?? f.question} question={f.question} answer={f.answer} headingLevel={headingLevel} />
      ))}
    </div>
  );
}
