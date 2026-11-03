import { Minus, Plus, Star } from 'lucide-react';
import { formatINR, AVAILABILITY } from '../utils/format.js';
import { MAX_QTY } from '../context/CartContext.jsx';

/** Shows the live price; a product without a price set never shows a made-up number. */
export function Price({ product, variant, className = '', size = 'base' }) {
  if (product.availability === 'price_not_set' || !(product.price > 0)) {
    return <span className={`text-graphite ${className}`}>Price coming soon</span>;
  }
  const amount = variant?.price ?? product.salePrice ?? product.price;
  const showStrike = product.salePrice && product.salePrice < product.price;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={size === 'lg' ? 'text-2xl font-medium tracking-tight sm:text-[1.75rem]' : 'font-medium'}>{formatINR(amount)}</span>
      {showStrike && (
        <span className="text-sm text-graphite line-through">
          <span className="sr-only">Regular price </span>
          {formatINR(product.price + (variant ? variant.price - (product.salePrice ?? product.price) : 0))}
        </span>
      )}
    </span>
  );
}

const BADGE = {
  available: 'bg-[#eaf4ee] text-success',
  coming_soon: 'bg-ink text-white',
  price_not_set: 'bg-stone-2 text-ink',
  out_of_stock: 'bg-stone-2 text-graphite',
  unavailable: 'bg-stone-2 text-graphite',
};

export function AvailabilityBadge({ availability, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[0.75rem] font-medium leading-none ${BADGE[availability] || BADGE.unavailable} ${className}`}>
      {availability === 'available' && <span className="size-1.5 rounded-full bg-success" aria-hidden />}
      {AVAILABILITY[availability] || availability}
    </span>
  );
}

export function QuantityStepper({ value, onChange, max = MAX_QTY, min = 1, label = 'Quantity', size = 'md', disabled }) {
  const h = size === 'sm' ? 'h-9' : 'h-12';
  const w = size === 'sm' ? 'w-9' : 'w-11';
  return (
    <div className={`inline-flex ${h} items-stretch rounded border border-hairline bg-white`} role="group" aria-label={label}>
      <button type="button" className={`${w} grid place-items-center text-ink hover:bg-stone disabled:opacity-35`} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="size-4" />
      </button>
      <output className="grid min-w-9 place-items-center px-1 text-[0.9375rem] font-medium tabular-nums" aria-live="polite" aria-label={`${label}: ${value}`}>
        {value}
      </output>
      <button type="button" className={`${w} grid place-items-center text-ink hover:bg-stone disabled:opacity-35`} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Colour swatches for admin-configured variants only. */
export function VariantPicker({ variants, value, onChange, name = 'Colour' }) {
  if (!variants?.length) return null;
  const selected = variants.find((v) => v.id === value);
  return (
    <fieldset>
      <legend className="mb-3 text-sm">
        <span className="font-medium">{name}:</span> <span className="text-graphite">{selected?.name}</span>
      </legend>
      <div className="flex flex-wrap gap-2.5">
        {variants.map((v) => {
          const active = v.id === value;
          return (
            <label key={v.id} className={`relative cursor-pointer ${!v.available ? 'opacity-45' : ''}`}>
              <input type="radio" name={`variant-${name}`} className="peer sr-only" checked={active} disabled={!v.available} onChange={() => onChange(v.id)} />
              <span
                className={`flex items-center gap-2.5 rounded border py-2 pl-2 pr-3.5 text-sm transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal ${active ? 'border-ink' : 'border-hairline hover:border-graphite'}`}
              >
                <span className="size-6 rounded-sm border border-black/10" style={{ background: v.colorHex || '#ddd' }} aria-hidden />
                {v.name}
                {!v.available && <span className="text-graphite">— unavailable</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Stars({ value, className = 'size-4' }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${className} ${n <= Math.round(value) ? 'fill-ink text-ink' : 'text-hairline'}`} aria-hidden />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, error }) {
  return (
    <fieldset>
      <legend className="field-label">Your rating</legend>
      <div className="flex gap-1" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name="rating" value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span className="block rounded p-1 peer-focus-visible:outline-2 peer-focus-visible:outline-signal">
              <Star className={`size-7 transition-colors ${n <= value ? 'fill-signal text-signal' : 'text-graphite/40 hover:text-graphite'}`} aria-hidden />
              <span className="sr-only">{n} star{n > 1 ? 's' : ''}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
}
