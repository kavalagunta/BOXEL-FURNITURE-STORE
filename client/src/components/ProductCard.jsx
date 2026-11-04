import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { Price, AvailabilityBadge } from './ProductBits.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import QuickView from './QuickView.jsx';
import { staggerItem } from './ui/Reveal.jsx';

export default function ProductCard({ product, layout = 'grid', priority = false, compact = false }) {
  const { addItem, openDrawer } = useCart();
  const toast = useToast();
  const [quick, setQuick] = useState(false);
  const firstVariant = product.variants.find((v) => v.available) || product.variants[0];
  const canBuy = product.availability === 'available' && firstVariant?.available;
  const multipleVariants = product.variants.length > 1;
  const img = product.images[0];
  const alt = product.images[1];
  const wide = layout === 'feature';

  const add = () => {
    addItem(product, firstVariant, 1);
    toast.success(`${product.name} added to your cart.`, { action: { label: 'View cart', onClick: openDrawer } });
  };

  return (
    <motion.article variants={staggerItem} className={`group relative flex flex-col ${compact ? 'product-card--compact h-[33rem] min-w-0 overflow-hidden rounded-[14px] border border-hairline bg-white p-2.5 shadow-[0_2px_8px_rgba(23,23,23,0.06)] transition-[transform,box-shadow,border-color] duration-200 ease-out max-sm:h-[21.5rem] max-sm:p-2' : ''} ${wide ? 'lg:grid lg:grid-cols-12 lg:items-center lg:gap-12' : ''}`}>
      <Link
        to={`/products/${product.slug}`}
          className={`product-card__media relative block overflow-hidden bg-[linear-gradient(180deg,var(--color-studio-top),var(--color-studio-floor))] ${compact ? 'aspect-[4/5] rounded-[10px]' : wide ? 'aspect-[1309/1202] rounded-sm lg:col-span-7' : 'aspect-[4/5] rounded-sm'}`}
        aria-label={product.name}
      >
        {img && (
          <img
            src={img.url}
            srcSet={img.srcset}
            sizes={wide ? '(min-width: 1024px) 58vw, 100vw' : '(min-width: 1024px) 33vw, 100vw'}
            alt={img.alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            width="1309"
            height="1202"
            onError={(e) => { e.currentTarget.src = '/images/placeholder.svg'; e.currentTarget.removeAttribute('srcset'); }}
            className={`absolute inset-0 size-full object-cover transition-[transform,opacity] duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-[1.04] motion-reduce:group-hover:scale-100 ${alt ? 'group-hover:opacity-0' : ''}`}
          />
        )}
        {alt && (
          <img
            src={alt.url}
            srcSet={alt.srcset}
            sizes="(min-width: 1024px) 33vw, 100vw"
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.src = '/images/placeholder.svg'; e.currentTarget.removeAttribute('srcset'); }}
            className="absolute inset-0 size-full scale-[1.04] object-cover opacity-0 transition-[transform,opacity] duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-100 group-hover:opacity-100"
          />
        )}
        <AvailabilityBadge availability={product.availability} className="absolute left-3 top-3" />
      </Link>

      <div className={`product-card__details flex flex-1 flex-col ${compact ? 'min-w-0 px-0.5 pb-0.5 pt-3' : wide ? 'pt-6 lg:col-span-5 lg:pt-0' : 'pt-4'}`}>
        {product.category && <p className="product-card__category text-[0.8125rem] text-graphite">{product.category.name}</p>}
        <h3 className={`product-card__name ${wide ? 'mt-2 text-headline font-light' : 'mt-1 text-lg font-medium leading-snug'}`}>
          <Link to={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none lg:after:content-none">
            {product.name}
          </Link>
        </h3>
        {product.shortDescription && <p className={`product-card__description mt-2 text-graphite ${wide ? 'max-w-[46ch] text-lead' : 'line-clamp-2 text-[0.9375rem]'}`}>{product.shortDescription}</p>}

        {product.variants.length > 0 && (
          <div className="product-card__variants mt-3 flex items-center gap-1.5" aria-label={`Available in ${product.variants.map((v) => v.name).join(', ')}`}>
            {product.variants.map((v) => (
              <span key={v.id} className="size-4 rounded-full border border-black/15" style={{ background: v.colorHex || '#ddd' }} title={v.name} />
            ))}
          </div>
        )}

        <div className={`product-card__price flex items-center justify-between gap-3 ${wide ? 'mt-6' : 'mt-4'}`}>
          <Price product={product} size={wide ? 'lg' : 'base'} />
        </div>

        <div className={`product-card__actions relative z-[1] flex flex-wrap gap-2 ${wide ? 'mt-8' : 'mt-4'}`}>
          {compact && ['out_of_stock', 'unavailable'].includes(product.availability) ? (
            <button type="button" className="btn btn-primary btn-sm" disabled>Out of stock</button>
          ) : canBuy && !multipleVariants ? (
            <button type="button" onClick={add} className={`btn btn-primary ${wide ? '' : 'btn-sm'}`}>
              Add to cart
            </button>
          ) : (
            <Link to={`/products/${product.slug}`} className={`btn btn-primary ${wide ? '' : 'btn-sm'}`}>
              {canBuy ? 'Choose colour' : 'View details'}
            </Link>
          )}
          {canBuy && !multipleVariants && (
            <Link to={`/products/${product.slug}`} className={`product-card__secondary-action btn btn-secondary ${wide ? '' : 'btn-sm'}`}>
              View details
            </Link>
          )}
          <button type="button" onClick={() => setQuick(true)} className={`product-card__quick-view btn btn-secondary ${wide ? '' : 'btn-sm'} px-3`} aria-label={`Quick view ${product.name}`}>
            <Eye className="size-4" aria-hidden />
            <span className={wide ? '' : 'sr-only'}>Quick view</span>
          </button>
        </div>
      </div>
      <QuickView product={product} open={quick} onClose={() => setQuick(false)} />
    </motion.article>
  );
}

export function ProductCardSkeleton({ compact = false }) {
  return (
    <div aria-hidden className={compact ? 'product-card-skeleton--compact h-[33rem] min-w-0 overflow-hidden rounded-[14px] border border-hairline bg-white p-2.5 shadow-[0_2px_8px_rgba(23,23,23,0.06)] max-sm:h-[21.5rem] max-sm:p-2' : ''}>
      <div className="skeleton aspect-[4/5] w-full" />
      <div className={`skeleton h-3 w-24 ${compact ? 'mt-3' : 'mt-4'}`} />
      <div className="skeleton mt-2 h-5 w-3/4" />
      <div className="skeleton mt-3 h-4 w-1/3" />
      {compact && <div className="skeleton mt-3 h-9 w-full rounded-lg" />}
    </div>
  );
}
