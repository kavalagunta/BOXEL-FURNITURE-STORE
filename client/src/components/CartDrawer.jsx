import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Drawer } from './ui/Overlay.jsx';
import { QuantityStepper } from './ProductBits.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatINR } from '../utils/format.js';

export function CartLine({ line, compact = false }) {
  const { setQuantity, removeItem } = useCart();
  const max = line.maxQuantity ?? 10;
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex gap-4 py-5">
      <Link to={`/products/${line.slug}`} className={`shrink-0 overflow-hidden rounded-sm bg-[linear-gradient(180deg,var(--color-studio-top),var(--color-studio-floor))] ${compact ? 'size-20' : 'size-24 sm:size-28'}`}>
        {line.imageUrl && <img src={line.imageUrl} alt="" className="size-full object-cover" loading="lazy" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/products/${line.slug}`} className="font-medium leading-snug hover:underline">
              {line.name || 'Product'}
            </Link>
            {line.variantName && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-graphite">
                {line.colorHex && <span className="size-3 rounded-full border border-black/15" style={{ background: line.colorHex }} aria-hidden />}
                {line.variantName}
              </p>
            )}
          </div>
          <p className="shrink-0 font-medium tabular-nums">{line.issue ? '—' : line.lineTotal !== undefined ? formatINR(line.lineTotal) : ''}</p>
        </div>
        {line.issue && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {line.issue === 'insufficient_stock' ? `Only ${max} available.` : line.issue === 'coming_soon' ? 'Coming soon — cannot be ordered yet.' : 'Not available to order right now.'}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <QuantityStepper value={line.quantity} onChange={(q) => setQuantity(line.variantId, q)} max={Math.max(max, 1)} size="sm" label={`Quantity of ${line.name}`} />
          <button type="button" onClick={() => removeItem(line.variantId)} className="inline-flex items-center gap-1.5 rounded p-1.5 text-sm text-graphite hover:text-ink">
            <Trash2 className="size-4" aria-hidden />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </motion.li>
  );
}

export function Totals({ quote }) {
  if (!quote) return null;
  return (
    <dl className="space-y-2 text-[0.9375rem]">
      <div className="flex justify-between">
        <dt className="text-graphite">Subtotal</dt>
        <dd className="tabular-nums">{formatINR(quote.subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-graphite">Shipping</dt>
        <dd className="tabular-nums">{quote.shipping > 0 ? formatINR(quote.shipping) : 'Free'}</dd>
      </div>
      {quote.tax?.amount > 0 && (
        <div className="flex justify-between">
          <dt className="text-graphite">{quote.tax.label}</dt>
          <dd className="tabular-nums">{formatINR(quote.tax.amount)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-hairline pt-3 text-lg font-medium">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatINR(quote.total)}</dd>
      </div>
    </dl>
  );
}

export default function CartDrawer() {
  const { drawerOpen, closeDrawer, lines, quote, count } = useCart();
  const navigate = useNavigate();
  const go = (to) => {
    closeDrawer();
    navigate(to);
  };
  const blocked = quote && !quote.purchasable;

  return (
    <Drawer
      open={drawerOpen}
      onClose={closeDrawer}
      title={`Your cart${count ? ` (${count})` : ''}`}
      footer={
        lines.length > 0 && (
          <div className="space-y-4">
            <Totals quote={quote} />
            {blocked && <p className="text-sm text-danger">Some items cannot be ordered. Update your cart to continue.</p>}
            <div className="grid gap-2">
              <button type="button" className="btn btn-primary w-full" disabled={!quote || blocked} onClick={() => go('/checkout')}>
                Checkout
              </button>
              <button type="button" className="btn btn-secondary w-full" onClick={() => go('/cart')}>
                View cart
              </button>
            </div>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <div className="flex flex-col items-start gap-4 p-6">
          <p className="text-graphite">Your cart is empty.</p>
          <button type="button" className="btn btn-primary" onClick={() => go('/products')}>
            Browse products
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-hairline px-5">
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <CartLine key={l.variantId} line={l} compact />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Drawer>
  );
}
