import { useState } from 'react';
import { Link } from 'react-router';
import { Modal } from './ui/Overlay.jsx';
import { Price, AvailabilityBadge, QuantityStepper, VariantPicker } from './ProductBits.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function QuickView({ product, open, onClose }) {
  const { addItem, openDrawer } = useCart();
  const toast = useToast();
  const initial = product.variants.find((v) => v.available) || product.variants[0];
  const [variantId, setVariantId] = useState(initial?.id);
  const [qty, setQty] = useState(1);
  const variant = product.variants.find((v) => v.id === variantId);
  const canBuy = product.availability === 'available' && variant?.available;
  const max = variant?.stock !== undefined ? Math.min(10, variant.stock) : 10;

  const add = () => {
    addItem(product, variant, qty);
    onClose();
    toast.success(`${product.name} added to your cart.`, { action: { label: 'View cart', onClick: openDrawer } });
  };

  return (
    <Modal open={open} onClose={onClose} title={product.name} size="max-w-3xl" hideTitle>
      <div className="grid gap-6 pt-2 sm:grid-cols-2 sm:gap-8">
        <div className="aspect-[4/5] overflow-hidden rounded-sm bg-[linear-gradient(180deg,var(--color-studio-top),var(--color-studio-floor))]">
          {product.images[0] && <img src={product.images[0].url} alt={product.images[0].alt} className="size-full object-cover" />}
        </div>
        <div className="flex flex-col">
          <AvailabilityBadge availability={product.availability} className="self-start" />
          <p className="mt-4 text-2xl font-light tracking-tight" aria-hidden>
            {product.name}
          </p>
          <Price product={product} variant={variant} className="mt-2" size="lg" />
          {product.shortDescription && <p className="mt-4 text-graphite">{product.shortDescription}</p>}
          <div className="mt-6">
            <VariantPicker variants={product.variants} value={variantId} onChange={setVariantId} />
          </div>
          {canBuy && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <QuantityStepper value={qty} onChange={setQty} max={max} />
              <button type="button" onClick={add} className="btn btn-primary flex-1">
                Add to cart
              </button>
            </div>
          )}
          {!canBuy && (
            <p className="mt-6 rounded-sm bg-stone p-4 text-sm text-graphite">
              {product.availability === 'coming_soon' ? 'This product is coming soon and cannot be ordered yet.' : 'This product cannot be ordered online right now. Contact us to know more.'}
            </p>
          )}
          <Link to={`/products/${product.slug}`} onClick={onClose} className="link mt-auto self-start pt-6 text-sm font-medium">
            See full details
          </Link>
        </div>
      </div>
    </Modal>
  );
}
