import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { MapPin, Navigation, Phone, ShoppingBag, Truck, Video } from 'lucide-react';
import Reveal from '../ui/Reveal.jsx';
import SocialIcon, { SOCIAL_LABELS } from '../ui/SocialIcon.jsx';
import { useSite } from '../../context/SiteContext.jsx';
import { formatPhone, telHref } from '../../utils/format.js';

export function SectionHeading({ id, title, intro, className = '', align = 'left' }) {
  return (
    <Reveal className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-3xl ${className}`}>
      <h2 id={id} className="text-headline font-light">
        {title}
      </h2>
      {intro && <p className="mt-4 max-w-[58ch] text-lead text-graphite">{intro}</p>}
    </Reveal>
  );
}

/* E — product introduction ---------------------------------------------- */
const ATTRIBUTES = ['All-metal construction', 'Keyless number lock', 'Powder-coated finish', 'Delivered fully assembled', 'Made to order'];
const USES = ['Parcels', 'Groceries', 'Laundry', 'Returns'];

// Points on the open-door photograph (percent of the 1234 × 1274 image). Only verified attributes.
const ANATOMY = [
  { x: 52, y: 37, title: 'Drop opening', body: 'Deliveries go in from the top — no key needed to drop a parcel in.' },
  { x: 85, y: 54, title: 'Keyless number lock', body: 'The front door opens with a number combination. Nothing to carry or lose.' },
  { x: 50, y: 77, title: 'Storage compartment', body: 'Parcels, groceries, laundry and returns wait here until you collect them.' },
  { x: 24, y: 46, title: 'All-metal, powder-coated', body: 'Built in metal with a durable powder-coat finish, delivered fully assembled.' },
];

export function ProductIntro({ product }) {
  const { s } = useSite();
  const ref = useRef(null);
  const [active, setActive] = useState(null);
  const slug = product?.slug || 'parcel-drop-box';

  return (
    <section ref={ref} className="relative overflow-hidden bg-charcoal py-20 text-white sm:py-28 lg:py-36" aria-labelledby="intro-title">
      {/* A faint orange glow behind the product: the only gradient on the page, kept low. */}
      <div aria-hidden className="pointer-events-none absolute -left-40 top-1/3 size-[42rem] rounded-full bg-[radial-gradient(circle,rgb(241_126_0/0.16),transparent_62%)]" />
      <div className="shell relative grid items-center gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="relative lg:col-span-7">
          <div className="relative aspect-[1234/1274] overflow-hidden rounded-md bg-[linear-gradient(180deg,#d3d3d5,#f1f1f3)] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)]">
            {/* No transforms here: the numbered markers stay pixel-sharp. */}
            <div className="absolute inset-0">
              <img
                src="/images/parcel-drop-box-open.jpeg"
                alt="The Parcel Drop Box with its front door open, showing the drop chute above and the storage space below"
                width="1234"
                height="1274"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
              {ANATOMY.map((p, i) => (
                <button
                  key={p.title}
                  type="button"
                  className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-offset-4"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${i + 1}. ${p.title}: ${p.body}`}
                  aria-describedby={`anatomy-${i}`}
                >
                  <span className="hotspot-ring absolute inset-0 rounded-full bg-signal" style={{ animationDelay: `${0.4 + i * 0.25}s` }} aria-hidden />
                  <span
                    className={`relative grid size-8 place-items-center rounded-full text-[0.8125rem] font-semibold shadow-lg transition-colors duration-300 ${
                      active === i ? 'bg-signal text-ink' : 'bg-white text-ink'
                    }`}
                  >
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Reveal delay={0.2} className="relative mt-4 max-w-[15rem] rounded-md bg-white p-5 text-ink shadow-[var(--shadow-float)] sm:absolute sm:-bottom-7 sm:right-8 sm:mt-0 lg:-right-10">
            <p className="text-3xl font-light tracking-tight">3–4 homes</p>
            <p className="mt-1 text-sm text-graphite">can share one Parcel Drop Box.</p>
          </Reveal>
        </div>

        <div className="lg:col-span-5">
          <Reveal>
            <h2 id="intro-title" className="text-headline font-light">
              {s.home_intro_heading || 'Meet the boxel Parcel Drop Box'}
            </h2>
            <p className="mt-6 text-lead text-white/65">
              {s.home_intro_body ||
                'Parcels, groceries, laundry and returns arrive when you are out. The Parcel Drop Box receives them safely and holds them until you are back.'}
            </p>
            <ul className="mt-7 flex flex-wrap gap-2" aria-label="What it receives">
              {USES.map((u) => (
                <li key={u} className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-white/85">
                  {u}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.12}>
            <ol className="mt-10 border-t border-white/12">
              {ANATOMY.map((p, i) => (
                <li
                  key={p.title}
                  id={`anatomy-${i}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  className={`flex gap-4 border-b border-white/12 py-4 transition-colors duration-300 ${active === i ? 'text-white' : 'text-white/80'}`}
                >
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.75rem] font-semibold transition-colors duration-300 ${
                      active === i ? 'bg-signal text-ink' : 'bg-white/10 text-white'
                    }`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-medium">{p.title}</span>
                    <span className="mt-0.5 block text-[0.9375rem] text-white/55">{p.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link to={`/products/${slug}`} className="btn btn-signal">
                View the Parcel Drop Box
              </Link>
              <span className="text-sm text-white/55">{ATTRIBUTES.slice(3).join(' and ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}.</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* H — how it works (a real sequence, so the steps are numbered) ------------ */
const STEPS = [
  { icon: ShoppingBag, title: 'Order your boxel product online.', body: 'Choose your product and colour, and place your order in a few steps.' },
  { icon: Video, title: 'We make and quality-check it.', body: 'Your unit is made to order. Before it ships, we share a video of its quality and functions.' },
  { icon: Truck, title: 'It is dispatched to your address.', body: 'Your product arrives fully assembled, with free shipping across India.' },
];

export function HowItWorks() {
  const { s } = useSite();
  const ref = useRef(null);
  const reduce = useReducedMotion();
  // The orange line fills as the steps scroll through the viewport.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.55'] });
  const fill = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0, 1]);

  return (
    <section className="bg-sand py-20 sm:py-28 lg:py-32" aria-labelledby="how-title">
      <div className="shell">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="how-title" className="text-headline font-light lg:col-span-6">
            From order to your door
          </h2>
          {s.home_quality_note && <p className="max-w-[52ch] text-lead text-graphite lg:col-span-5 lg:col-start-8">{s.home_quality_note}</p>}
        </Reveal>

        <div ref={ref} className="relative mt-16">
          {/* Track + scroll-linked progress (horizontal on desktop, vertical on mobile). */}
          <div aria-hidden className="absolute left-[1.375rem] top-0 h-full w-px bg-sand-2 md:left-0 md:top-[1.375rem] md:h-px md:w-full">
            <motion.div style={{ scaleY: fill }} className="h-full w-full origin-top bg-signal md:hidden" />
            <motion.div style={{ scaleX: fill }} className="hidden h-full w-full origin-left bg-signal md:block" />
          </div>
          <ol className="relative grid gap-12 md:grid-cols-3 md:gap-10">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <Reveal as="li" key={title} delay={i * 0.12} className="relative pl-16 md:pl-0">
                <span className="absolute left-0 top-0 grid size-11 place-items-center rounded-full bg-ink text-white ring-8 ring-sand md:relative">
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                </span>
                <p className="mt-0 text-[0.8125rem] font-medium text-signal-ink md:mt-8">Step {i + 1}</p>
                <h3 className="mt-2 text-title font-normal">{title}</h3>
                <p className="mt-3 max-w-[36ch] text-graphite">{body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* J — store location / service area -------------------------------------- */
export function Location() {
  const { s } = useSite();
  const isStore = s.location_mode === 'store' && (s.business_address || s.store_name);
  const cityState = [s.business_city, s.business_state].filter(Boolean).join(', ');
  const fullAddress = [s.business_address, cityState].filter(Boolean).join(', ');
  const directions = s.map_url || (isStore && s.business_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null);

  return (
    <section className="bg-white py-20 sm:py-28" aria-labelledby="location-title">
      <div className="shell grid gap-12 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <SectionHeading id="location-title" title={isStore ? s.store_name || 'Visit us' : 'Delivering across India'} />
          <Reveal delay={0.1} className="mt-8 space-y-5 text-[0.9375rem]">
            {isStore ? (
              <p className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0" strokeWidth={1.5} aria-hidden />
                <span>{fullAddress}</span>
              </p>
            ) : (
              <p className="max-w-[46ch] text-lead text-graphite">
                {s.service_area_text || 'We deliver across India, with free shipping.'}
                {cityState && ` We are based in ${cityState}.`}
              </p>
            )}
            {s.business_hours && <p className="text-graphite">{s.business_hours}</p>}
            <p className="flex gap-3">
              <Phone className="mt-0.5 size-5 shrink-0" strokeWidth={1.5} aria-hidden />
              <a href={telHref(s.business_phone)} className="link">
                {formatPhone(s.business_phone)}
              </a>
            </p>
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                <Navigation className="size-4" aria-hidden /> Get directions
              </a>
            )}
          </Reveal>
        </div>
        <Reveal delay={0.15} className="lg:col-span-7">
          {isStore && s.map_embed_url ? (
            <iframe
              src={s.map_embed_url}
              title={`Map showing ${s.store_name || 'our location'}`}
              className="aspect-[4/3] w-full rounded-sm border-0 grayscale-[0.4]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="grain relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#f5f2ec,#e9e2d6)] p-6 shadow-[var(--shadow-card)] sm:p-10">
              <div className="flex items-end gap-1.5 text-[2.5rem] sm:text-[3.25rem]" aria-hidden>
                <span className="tile bg-[#d3cbbd]" />
                <span className="tile mb-[0.4em] bg-[#d3cbbd]" />
                <span className="tile bg-signal" />
              </div>
              {/* Decorative oversized mark bleeding off the panel edge. */}
              <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 flex items-end gap-4 text-[12rem] opacity-[0.07] sm:text-[16rem]">
                <span className="tile bg-ink" />
                <span className="tile mb-[0.4em] bg-ink" />
              </div>
              <div className="relative">
                <p className="text-display font-light leading-none">Free shipping</p>
                <p className="mt-2 text-lead text-graphite">on every order, across India.</p>
              </div>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/* K — follow us (hidden until real profiles are configured) -------------- */
export function FollowUs() {
  const { social } = useSite();
  if (!social.length) return null;
  return (
    <section className="py-16 sm:py-20" aria-labelledby="follow-title">
      <div className="shell flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <SectionHeading id="follow-title" title="Follow boxel" intro="New products, behind-the-scenes builds and quality-check videos." />
        <Reveal as="ul" className="flex flex-wrap gap-3">
          {social.map((l) => (
            <li key={l.platform}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-full border border-hairline py-2.5 pl-3 pr-5 transition-colors hover:border-ink">
                <SocialIcon platform={l.platform} />
                <span>{SOCIAL_LABELS[l.platform]}</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
