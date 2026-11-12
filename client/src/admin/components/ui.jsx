import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Modal } from '../../components/ui/Overlay.jsx';
import { Spinner } from '../../components/ui/States.jsx';
import { useDebounced } from '../../hooks/useApi.js';

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden /> {back.label}
          </Link>
        )}
        <h1 className="text-[1.75rem] font-light leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-[70ch] text-[0.9375rem] text-graphite">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '', padded = true }) {
  return (
    <section className={`rounded-md border border-hairline bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <h2 className="text-[0.9375rem] font-medium">{title}</h2>
          {actions}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: 'bg-stone-2 text-ink',
  green: 'bg-[#e7f3ec] text-[#1f6b40]',
  amber: 'bg-[#fdf1e2] text-[#8a4b00]',
  blue: 'bg-[#e8eefb] text-[#2c4f9e]',
  red: 'bg-[#fbe9e7] text-[#a3261b]',
  dark: 'bg-ink text-white',
};

export const STATUS_TONE = {
  placed: 'amber', pending: 'amber', accepted: 'green', confirmed: 'green', processing: 'blue', shipped: 'blue', delivered: 'green', rejected: 'red', cancelled: 'red',
  paid: 'green', failed: 'red', refunded: 'neutral',
  new: 'amber', read: 'neutral', in_progress: 'blue', resolved: 'green',
  approved: 'green',
  active: 'green', draft: 'neutral', coming_soon: 'dark', archived: 'neutral', inactive: 'neutral',
  sent: 'green', skipped: 'neutral',
};

export function Badge({ tone = 'neutral', children }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-[0.75rem] font-medium ${TONES[tone]}`}>{children}</span>;
}

export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function StatusBadge({ status, label }) {
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{label || titleCase(status)}</Badge>;
}

/** Responsive table: scrolls horizontally inside its card on small screens. */
export function Table({ columns, rows, empty = 'Nothing here yet.', loading, rowKey = 'id', onRowClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-[0.75rem] text-graphite">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-4 py-3 font-medium ${c.className || ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows?.length && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center">
                <Spinner className="size-5 text-graphite" />
              </td>
            </tr>
          )}
          {!loading && rows?.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-graphite">
                {empty}
              </td>
            </tr>
          )}
          {rows?.map((r) => (
            <tr key={r[rowKey]} className={`border-b border-hairline last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-stone' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-middle ${c.className || ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3 text-sm">
      <span className="text-graphite">
        {meta.total} total · page {meta.page} of {meta.pages}
      </span>
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary btn-sm px-2.5" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" className="btn btn-secondary btn-sm px-2.5" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className = '' }) {
  const [v, setV] = useState(value || '');
  const debounced = useDebounced(v, 350);
  useEffect(() => {
    if (debounced !== (value || '')) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-graphite" aria-hidden />
      <input type="search" aria-label={placeholder} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="field min-h-10 py-2 pl-9 text-sm" />
    </div>
  );
}

export function Select({ value, onChange, options, label, className = '' }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`field min-h-10 py-2 text-sm ${className}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={`flex items-start justify-between gap-6 py-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8125rem] text-graphite">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-10 rounded-full bg-stone-2 transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger = false, busy = false, disabled = false, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {body && <p className="text-graphite">{body}</p>}
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={`btn btn-sm ${danger ? 'bg-danger text-white hover:bg-danger/90' : 'btn-primary'}`} onClick={onConfirm} disabled={busy || disabled}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Toolbar({ children }) {
  return <div className="flex flex-col gap-3 border-b border-hairline p-4 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}
