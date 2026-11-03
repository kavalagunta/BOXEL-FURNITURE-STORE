import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowUpRight, Eye, Briefcase, Building2, ClipboardCheck, Hammer, House, Lock, MessageCircle, Phone, PlugZap, Truck } from 'lucide-react';
import Reveal, { EASE, stagger } from '../ui/Reveal.jsx';
import { AccordionItem } from '../ui/Accordion.jsx';
import ProductCard, { ProductCardSkeleton } from '../ProductCard.jsx';
import QuickView from '../QuickView.jsx';
import { Price, AvailabilityBadge } from '../ProductBits.jsx';
import { ErrorState } from '../ui/States.jsx';
import { useSite } from '../../context/SiteContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatPhone, telHref, whatsappHref } from '../../utils/format.js';

const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } };

/* D — promises: a floating card that bridges the white hero and the dark showcase. */
const VALUES = [
  { icon: Lock, label: 'Secure by design', note: 'All-metal, with a keyless number lock' },
  { icon: Hammer, label: 'Made to order', note: 'Built for you after you order' },
  { icon: ClipboardCheck, label: 'Quality checked before dispatch', note: 'A video of quality and functions, shared before it ships' },
  { icon: Truck, label: 'Free shipping across India', note: 'On every order' },
];

export function ValueStrip() {
  return (
    <section aria-label="Our promises" className="relative bg-[linear-gradient(180deg,#ffffff_50%,var(--color-charcoal)_50%)] pt-6">
      <div className="shell relative z-[2]">
        <motion.ul
          className="grid grid-cols-1 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-deep)] ring-1 ring-black/[0.04] sm:grid-cols-2 lg:grid-cols-4"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
        >
          {VALUES.map(({ icon: Icon, label, note }, i) => (
            <motion.li
              key={label}
              variants={item}
              className={`group flex items-start gap-4 p-5 sm:p-7 ${i > 0 ? 'border-t border-hairline sm:border-t-0' : ''} ${i % 2 ? 'sm:border-l sm:border-hairline' : ''} ${i > 1 ? 'sm:border-t sm:border-hairline lg:border-t-0' : ''} ${i > 0 ? 'lg:border-l lg:border-hairline' : ''}`}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-signal-soft text-signal-ink transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:-translate-y-0.5 group-hover:rotate-[-6deg]">
                <Icon className="size-5" strokeWidth={1.6} aria-hidden />
              </span>
              <span>
                <span className="block text-[0.9375rem] font-medium leading-snug">{label}</span>
                <span className="mt-1 block text-[0.8125rem] leading-snug text-graphite">{note}</span>
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

/* A small 3D-shaded stack of logo tiles. Each coming-soon category gets its own arrangement. */
const STACKS = [
  // tall locker
  [
    { l: 18, t: 8, w: 34, h: 58, c: 'from-white to-[#e4ddd1]' },
    { l: 18, t: 70, w: 34, h: 26, c: 'from-white to-[#e4ddd1]' },
    { l: 56, t: 34, w: 30, h: 44, c: 'from-[#ffa340] to-signal', accent: true },
  ],
  // wide workstation
  [
    { l: 6, t: 30, w: 62, h: 30, c: 'from-white to-[#e4ddd1]' },
    { l: 6, t: 64, w: 26, h: 30, c: 'from-white to-[#e4ddd1]' },
    { l: 70, t: 18, w: 24, h: 40, c: 'from-[#ffa340] to-signal', accent: true },
  ],
  // stepped wall shelves
  [
    { l: 8, t: 54, w: 26, h: 26, c: 'from-white to-[#e4ddd1]' },
    { l: 38, t: 34, w: 26, h: 26, c: 'from-white to-[#e4ddd1]' },
    { l: 68, t: 14, w: 26, h: 26, c: 'from-[#ffa340] to-signal', accent: true },
  ],
];

function TileStack({ variant = 0, dark = false }) {
  const tiles = STACKS[variant % STACKS.length];
  return (
    <div className="relative h-full w-full" aria-hidden>
      <span className={`absolute bottom-[4%] left-1/2 h-[10%] w-[70%] -translate-x-1/2 rounded-[50%] blur-xl ${dark ? 'bg-black/60' : 'bg-[#8a7d66]/25'}`} />
      {tiles.map((t, i) => (
        <span
          key={i}
          className={`absolute transition-transform duration-700 ease-[var(--ease-out-quint)] ${
            t.accent ? 'group-hover:-translate-y-3' : i === 0 ? 'group-hover:-translate-y-1.5' : 'group-hover:translate-y-0.5'
          }`}
          style={{ left: `${t.l}%`, top: `${t.t}%`, width: `${t.w}%`, height: `${t.h}%` }}
        >
          <span className={`block size-full bg-gradient-to-br ${t.c} shadow-[0_18px_30px_-14px_rgb(60_45_20/0.45)]`} style={{ transform: 'skewY(-24deg)' }} />
        </span>
      ))}
    </div>
  );
}

/* F — categories as a bento grid: the available range leads, upcoming ideas follow. */
export function Categories({ data, loading, error, reload }) {
  const items = data?.items || [];
  return (
    <section className="py-20 sm:py-28 lg:py-32" aria-labelledby="cat-title">
      <div className="shell">
        <Reveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="cat-title" className="max-w-xl text-headline font-light">
            One idea, many rooms
          </h2>
          <p className="max-w-[44ch] text-lead text-graphite">The Parcel Drop Box is available now. More boxel products for storage and small spaces are on the way.</p>
        </Reveal>
        {error && (
          <div className="mt-10">
            <ErrorState error={error} onRetry={reload} />
          </div>
        )}
        <motion.ul
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:auto-rows-[17rem] lg:grid-cols-4"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
        >
          {loading && !data && [0, 1, 2, 3].map((i) => <li key={i} className={`skeleton min-h-72 ${i === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}`} aria-hidden />)}
          {items.map((c, i) => {
            const soon = c.status === 'coming_soon';
            const big = i === 0;
            const wide = i === 1;
            const dark = i === 1;
            const span = big ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2' : wide ? 'sm:col-span-2 lg:col-span-2' : '';
            return (
              <motion.li key={c.id} variants={item} className={span}>
                <Link
                  to={`/products?category=${c.slug}`}
                  className={`lift group relative flex h-full min-h-72 flex-col overflow-hidden rounded-[1.25rem] p-6 sm:p-7 ${
                    c.image_url ? 'bg-charcoal text-white' : dark ? 'grain grain-dark bg-charcoal text-white' : 'grain bg-sand'
                  } ${big ? 'min-h-[28rem]' : ''}`}
                >
                  {c.image_url ? (
                    <>
                      <img
                        src={c.image_url}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover transition-transform duration-[1.4s] ease-[var(--ease-out-quint)] group-hover:scale-[1.04]"
                      />
                      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(18_18_17/0.05)_35%,rgb(18_18_17/0.78))]" aria-hidden />
                    </>
                  ) : (
                    <span className={`pointer-events-none absolute ${wide ? 'right-4 top-4 h-[78%] w-[42%]' : 'right-3 top-3 h-[58%] w-[62%]'}`}>
                      <TileStack variant={i - 1} dark={dark} />
                    </span>
                  )}
                  {dark && <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(241_126_0/0.22),transparent_65%)]" />}

                  <span className="relative z-[2] flex items-start justify-between gap-3">
                    <span className={c.image_url ? 'glass-pill' : `inline-flex rounded-full px-3 py-1 text-[0.75rem] font-medium ${dark ? 'bg-white/10 text-white/85' : 'bg-white/70 text-ink'}`}>
                      {soon ? 'Coming soon' : `${c.product_count} available now`}
                    </span>
                  </span>

                  <span className="relative z-[2] mt-auto flex items-end justify-between gap-4 pt-10">
                    <span className={wide ? 'max-w-[55%]' : ''}>
                      <span className={`block font-light tracking-tight ${big ? 'text-headline' : 'text-title'}`}>{c.name}</span>
                      {c.description && (
                        <span className={`mt-2 block text-sm leading-relaxed ${c.image_url || dark ? 'text-white/70' : 'text-graphite'} ${big ? 'max-w-[36ch]' : 'line-clamp-3'}`}>{c.description}</span>
                      )}
                    </span>
                    <span
                      className={`grid size-11 shrink-0 place-items-center rounded-full transition-all duration-500 ease-[var(--ease-out-quint)] group-hover:rotate-45 ${
                        c.image_url || dark ? 'bg-white text-ink group-hover:bg-signal' : 'bg-ink text-white group-hover:bg-signal group-hover:text-ink'
                      }`}
                      aria-hidden
                    >
                      <ArrowUpRight className="size-5" />
                    </span>
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}

/* G — featured: a single available product gets a full spotlight card instead of a lonely grid. */
const SPEC_CHIPS = [
  { icon: Lock, label: 'Keyless number lock' },
  { icon: Hammer, label: 'All-metal build' },
  { icon: ClipboardCheck, label: 'Powder-coated finish' },
  { icon: Truck, label: 'Delivered assembled' },
];

function Spotlight({ product }) {
  const { addItem, openDrawer } = useCart();
  const toast = useToast();
  const { s } = useSite();
  const [quick, setQuick] = useState(false);
  const variant = product.variants.find((v) => v.available) || product.variants[0];
  const canBuy = product.availability === 'available' && variant?.available;
  const single = product.variants.length <= 1;

  const add = () => {
    addItem(product, variant, 1);
    toast.success(`${product.name} added to your cart.`, { action: { label: 'View cart', onClick: openDrawer } });
  };

  return (
    <motion.article variants={item} className="grain relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#f7f5f1_0%,#ece6dc_100%)] shadow-[var(--shadow-card)]">
      <span aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(241_126_0/0.12),transparent_65%)]" />
      <div className="relative z-[2] grid lg:grid-cols-12">
        <Link to={`/products/${product.slug}`} className="group relative block p-4 sm:p-6 lg:col-span-7" aria-label={product.name}>
          <div className="relative aspect-[1309/1202] overflow-hidden rounded-[1.25rem] bg-[linear-gradient(180deg,var(--color-studio-top),var(--color-studio-floor))] shadow-[var(--shadow-deep)]">
            {product.images[0] && (
              <img
                src={product.images[0].url}
                alt={product.images[0].alt}
                loading="lazy"
                width="1309"
                height="1202"
                className="absolute inset-0 size-full object-cover transition-transform duration-[1.4s] ease-[var(--ease-out-quint)] group-hover:scale-[1.03]"
              />
            )}
            <span className="absolute left-4 top-4 glass-pill">
              <span className="size-1.5 rounded-full bg-signal" aria-hidden />
              {product.category?.name || 'boxel'}
            </span>
            {product.images[1] && (
              <span className="absolute bottom-4 right-4 hidden w-[26%] overflow-hidden rounded-xl border-4 border-white/80 shadow-xl sm:block">
                <img src={product.images[1].url} alt="" loading="lazy" className="aspect-[1234/1274] w-full object-cover" />
              </span>
            )}
          </div>
        </Link>

        <div className="flex flex-col justify-center px-6 pb-8 pt-2 sm:px-10 sm:pb-10 lg:col-span-5 lg:py-12 lg:pl-4 lg:pr-12">
          <AvailabilityBadge availability={product.availability} className="self-start" />
          <h3 className="mt-5 text-headline font-light">
            <Link to={`/products/${product.slug}`} className="hover:underline hover:decoration-1 hover:underline-offset-8">
              {product.name}
            </Link>
          </h3>
          {product.shortDescription && <p className="mt-4 max-w-[44ch] text-lead text-graphite">{product.shortDescription}</p>}

          <ul className="mt-8 grid grid-cols-2 gap-2.5">
            {SPEC_CHIPS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 rounded-xl bg-white/70 px-3 py-2.5 text-[0.8125rem] ring-1 ring-black/[0.04]">
                <Icon className="size-4 shrink-0 text-signal-ink" strokeWidth={1.7} aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-end justify-between gap-4 border-t border-black/10 pt-6">
            <div>
              <p className="text-[0.8125rem] text-graphite">Price</p>
              <Price product={product} variant={variant} size="lg" className="mt-1" />
            </div>
            {product.variants.length > 0 && (
              <div className="flex items-center gap-1.5" aria-label={`Colours: ${product.variants.map((v) => v.name).join(', ')}`}>
                {product.variants.map((v) => (
                  <span key={v.id} className="size-5 rounded-full border border-black/15 shadow-inner" style={{ background: v.colorHex || '#ddd' }} title={v.name} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {canBuy && single ? (
              <button type="button" onClick={add} className="btn btn-primary flex-1 sm:flex-none">
                Add to cart
              </button>
            ) : canBuy ? (
              <Link to={`/products/${product.slug}`} className="btn btn-primary flex-1 sm:flex-none">
                Choose colour
              </Link>
            ) : (
              <a href={whatsappHref(s.business_whatsapp || s.business_phone, `Hi boxel, I'm interested in the ${product.name}.`)} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-1 sm:flex-none">
                <MessageCircle className="size-4" aria-hidden /> Ask on WhatsApp
              </a>
            )}
            <Link to={`/products/${product.slug}`} className="btn btn-secondary bg-white/60">
              View details
            </Link>
            <button type="button" onClick={() => setQuick(true)} className="btn btn-secondary bg-white/60 px-3.5" aria-label={`Quick view ${product.name}`}>
              <Eye className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <QuickView product={product} open={quick} onClose={() => setQuick(false)} />
    </motion.article>
  );
}

export function Featured({ data, loading, error, reload }) {
  const items = data?.items || [];
  return (
    <section className="home-featured pb-20 sm:pb-28 lg:pb-32" aria-labelledby="featured-title">
      <div className="shell">
        <Reveal className="home-featured__header flex flex-wrap items-end justify-between gap-6">
          <h2 id="featured-title" className="home-featured__title text-headline font-light">
            All products
          </h2>
          <Link to="/products" className="home-featured__all-link link text-[0.9375rem] font-medium">
            Shop the collection <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </Reveal>
        <div className="home-featured__content">
          {error && <ErrorState error={error} onRetry={reload} />}
          {loading && !data && (
            <div className="home-featured__grid">
              {[0, 1, 2].map((i) => (
                <ProductCardSkeleton key={i} compact />
              ))}
            </div>
          )}
          {data && items.length === 0 && <p className="home-featured__empty">New products are being prepared. Check back soon.</p>}
          {items.length > 0 && (
            <motion.div
              className="home-featured__grid"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
            >
              {items.map((p) => <ProductCard key={p.id} product={p} compact />)}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

/* I — designed for modern Indian living: elevated audience cards on a warm field. */
const AUDIENCES = [
  { icon: House, title: 'Individual homes', body: 'Receive deliveries while you are out — no more waiting at home for a parcel.', product: 'Parcel Drop Box', soon: false },
  { icon: Building2, title: 'Apartments and housing societies', body: 'One drop box can serve 3 to 4 homes at a shared entrance.', product: 'Parcel Drop Box', soon: false },
  { icon: Briefcase, title: 'Offices and workspaces', body: 'Space-saving wall-hung workstations and secure storage for high-value gadgets.', product: 'Wall-Hung Workstation, Personal Locker', soon: true },
  { icon: PlugZap, title: 'EV owners', body: 'A floor-standing holder for your charger, so you need not carry it up the stairs every day.', product: 'Personal Locker (floor-standing)', soon: true },
];

export function ModernLiving() {
  return (
    <section className="grain bg-stone py-20 sm:py-28 lg:py-32" aria-labelledby="living-title">
      <div className="shell relative z-[2] grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal className="lg:sticky lg:top-28">
            <h2 id="living-title" className="text-headline font-light">
              Designed for modern Indian living
            </h2>
            <p className="mt-4 max-w-[40ch] text-lead text-graphite">We design for real homes, real apartments, real offices and real budgets.</p>
            <div className="mt-8 flex items-end gap-1.5 text-3xl" aria-hidden>
              <span className="tile bg-sand-2" />
              <span className="tile mb-[0.4em] bg-sand-2" />
              <span className="tile" />
            </div>
          </Reveal>
        </div>
        <motion.ul className="grid gap-4 sm:grid-cols-2 lg:col-span-8" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
          {AUDIENCES.map(({ icon: Icon, title, body, product, soon }) => (
            <motion.li key={title} variants={item} className="lift group relative flex flex-col overflow-hidden rounded-[1.25rem] bg-white p-6 sm:p-8">
              <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-signal transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-x-100" />
              <span className="grid size-12 place-items-center rounded-2xl bg-sand text-ink transition-colors duration-500 group-hover:bg-signal-soft group-hover:text-signal-ink">
                <Icon className="size-5" strokeWidth={1.6} aria-hidden />
              </span>
              <h3 className="mt-8 text-title font-normal">{title}</h3>
              <p className="mt-3 text-graphite">{body}</p>
              <p className="mt-auto flex flex-wrap items-center gap-2 border-t border-hairline pt-5 text-sm">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${soon ? 'bg-stone-2 text-graphite' : 'bg-[#eaf4ee] text-success'}`}>
                  <span className={`size-1.5 rounded-full ${soon ? 'bg-graphite/60' : 'bg-success'}`} aria-hidden />
                  {soon ? 'Coming soon' : 'Available now'}
                </span>
                <span className="font-medium">{product}</span>
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

/* L — FAQ: soft cards with a dark help panel. */
export function Faq({ data, error, reload }) {
  const { s } = useSite();
  const wa = s.business_whatsapp || s.business_phone;
  return (
    <section className="py-20 sm:py-28 lg:py-32" aria-labelledby="faq-title">
      <div className="shell grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal className="lg:sticky lg:top-28">
            <h2 id="faq-title" className="text-headline font-light">
              Questions, answered
            </h2>
            <div className="grain grain-dark relative mt-8 overflow-hidden rounded-[1.25rem] bg-charcoal p-7 text-white shadow-[var(--shadow-deep)]">
              <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-[radial-gradient(circle,rgb(241_126_0/0.3),transparent_65%)]" />
              <div className="relative z-[2]">
                <p className="text-title font-light">Still have a question?</p>
                <p className="mt-2 text-sm text-white/65">Talk to the boxel team directly.</p>
                <div className="mt-6 flex flex-col gap-2.5">
                  <a href={whatsappHref(wa, 'Hi boxel, I have a question.')} target="_blank" rel="noopener noreferrer" className="btn btn-signal w-full">
                    <MessageCircle className="size-4" aria-hidden /> WhatsApp us
                  </a>
                  <a href={telHref(s.business_phone)} className="btn btn-ghost-light w-full">
                    <Phone className="size-4" aria-hidden /> {formatPhone(s.business_phone)}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
        <div className="lg:col-span-8">
          {error && <ErrorState error={error} onRetry={reload} />}
          {!data && !error && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 rounded-2xl" aria-hidden />
              ))}
            </div>
          )}
          {data && (
            <Reveal className="space-y-3">
              {data.items.map((f, i) => (
                <AccordionItem key={f.id} question={f.question} answer={f.answer} variant="card" defaultOpen={i === 0} />
              ))}
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
