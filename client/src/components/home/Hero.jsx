import { useRef } from 'react';
import { Link } from 'react-router';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { Lock, Truck } from 'lucide-react';
import HeroVideo from './HeroVideo.jsx';
import { EASE } from '../ui/Reveal.jsx';

const DEFAULT = {
  headline: 'Your space. Your peace of mind.',
  subheadline: 'Thoughtfully designed security and storage for modern Indian living.',
  cta_text: 'Explore the Parcel Drop Box',
  cta_url: '/products/parcel-drop-box',
  secondary_cta_text: 'Discover boxel',
  secondary_cta_url: '/about',
  desktop_image_url: '/images/parcel-drop-box-front.jpeg',
  mobile_image_url: '/images/parcel-drop-box-front.jpeg',
  image_alt: 'The boxel Parcel Drop Box, a white all-metal cabinet with a drop opening and a locking front door',
};

function SmartLink({ to, className, children }) {
  if (/^https?:\/\//.test(to)) {
    return (
      <a href={to} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

/** Splits the headline at sentence breaks so each line can rise in sequence. */
const lines = (text) => text.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) || [text];

// The logo mark, rebuilt as three skewed tiles. Positions are in % of the mark box.
const TILES = [
  { left: '0%', top: '0%', w: '44%', h: '46%', delay: 0.15 },
  { left: '0%', top: '56%', w: '44%', h: '46%', delay: 0.25 },
  { left: '52%', top: '34%', w: '44%', h: '46%', delay: 0.35 },
];

export default function Hero({ banner }) {
  const b = { ...DEFAULT, ...Object.fromEntries(Object.entries(banner || {}).filter(([, v]) => v)) };
  const reduce = useReducedMotion();
  const section = useRef(null);

  // Scroll-linked depth: the product drifts up slower than the page, the studio panel slower still.
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end start'] });
  const productY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -70]);
  const productScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.94]);
  const panelY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40]);
  const tilesY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -140]);

  // Pointer tilt (desktop pointers only), bounded to a few degrees.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotY = useSpring(useTransform(px, [-0.5, 0.5], [-5, 5]), { stiffness: 120, damping: 20 });
  const rotX = useSpring(useTransform(py, [-0.5, 0.5], [3, -3]), { stiffness: 120, damping: 20 });
  const onMove = (e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <section ref={section} className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      <div className="lg:grid lg:min-h-[min(calc(100svh-4.5rem),56rem)] lg:grid-cols-12">
        {/* Copy */}
        <div className="shell relative z-10 flex flex-col justify-center pb-12 pt-10 sm:pt-14 lg:col-span-6 lg:max-w-none lg:py-24 lg:pl-[max(2.5rem,calc((100vw-1320px)/2+2.5rem))] lg:pr-10">
          <h1 id="hero-title" className="text-display-xl font-light text-ink">
            {lines(b.headline).map((line, i) => (
              <span key={i} className="block overflow-hidden pb-[0.06em]">
                <motion.span
                  className="block"
                  initial={{ y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1, delay: 0.55 + i * 0.12, ease: EASE }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className="mt-6 max-w-[34ch] text-lead text-graphite"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.85, ease: EASE }}
          >
            {b.subheadline}
          </motion.p>
          <motion.div
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1, ease: EASE }}
          >
            {b.cta_text && b.cta_url && (
              <SmartLink to={b.cta_url} className="btn btn-primary group">
                {b.cta_text}
              </SmartLink>
            )}
            {b.secondary_cta_text && b.secondary_cta_url && (
              <SmartLink to={b.secondary_cta_url} className="link py-2 text-[0.9375rem] font-medium">
                {b.secondary_cta_text}
              </SmartLink>
            )}
          </motion.div>
        </div>

        {/* Studio stage */}
        <div className="relative lg:col-span-6" onPointerMove={onMove} onPointerLeave={onLeave}>
          <motion.div
            aria-hidden
            style={{ y: panelY }}
            className="absolute inset-0 -bottom-16 bg-[linear-gradient(180deg,var(--color-studio-top)_0%,#c9c8ca_55%,var(--color-studio-floor)_100%)]"
            initial={{ clipPath: 'inset(0 0 0 100%)' }}
            animate={{ clipPath: 'inset(0 0 0 0%)' }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <div className="relative flex aspect-[4/5] items-center justify-center sm:aspect-[4/3] lg:aspect-auto lg:h-full p-4 sm:p-6 lg:p-8" style={{ perspective: '1600px' }}>
            <motion.div
              style={{ y: productY, scale: productScale, rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.35, ease: EASE }}
              className="relative h-full w-full flex items-center justify-center"
            >
              <HeroVideo
                videoSrc={b.video_url || '/videos/hero.mp4'}
                webmSrc={b.video_url ? '' : '/videos/hero.webm'}
                poster={b.desktop_image_url}
                alt={b.image_alt || 'boxel Parcel Drop Box showcase'}
                className="w-full h-full max-h-[560px] object-cover"
              />
            </motion.div>

            {/* Floating spec card: frosted glass over the studio, verified facts only. */}
            <motion.div
              className="absolute bottom-6 right-4 z-10 rounded-md border border-white/60 bg-white/70 p-4 shadow-[var(--shadow-float)] backdrop-blur-md sm:right-8 lg:bottom-16 lg:right-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 1.25, ease: EASE }}
            >
              <ul className="space-y-2.5 text-[0.8125rem] text-ink">
                <li className="flex items-center gap-2.5">
                  <span className="grid size-7 place-items-center rounded-full bg-signal-soft text-signal-ink"><Lock className="size-3.5" aria-hidden /></span>
                  Keyless number lock
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-7 place-items-center rounded-full bg-signal-soft text-signal-ink"><Truck className="size-3.5" aria-hidden /></span>
                  Free shipping across India
                </li>
              </ul>
            </motion.div>

            {/* Logo-mark tiles: the one orchestrated moment on load. */}
            <motion.div aria-hidden style={{ y: tilesY }} className="pointer-events-none absolute bottom-8 left-5 h-20 w-16 sm:bottom-10 sm:left-8 sm:h-28 sm:w-24 lg:bottom-16 lg:left-12 lg:h-32 lg:w-28">
              {TILES.map((t, i) => (
                <motion.span
                  key={i}
                  className={`absolute ${i === 2 ? 'bg-signal' : 'bg-white'} shadow-[0_20px_40px_-20px_rgb(23_23_23/0.35)]`}
                  style={{ left: t.left, top: t.top, width: t.w, height: t.h, skewY: '-24deg' }}
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.6 + t.delay, ease: EASE }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        aria-hidden
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[0.6875rem] text-graphite lg:left-[max(2.5rem,calc((100vw-1320px)/2+2.5rem))] lg:flex lg:translate-x-0 lg:items-start"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
      >
        <span>Scroll</span>
        <span className="relative block h-10 w-px overflow-hidden bg-hairline">
          <motion.span
            className="absolute inset-x-0 top-0 h-3 bg-ink"
            animate={reduce ? {} : { y: [-12, 40] }}
            transition={{ duration: 1.8, repeat: 3, repeatDelay: 1.2, ease: 'easeInOut' }}
          />
        </span>
      </motion.div>
    </section>
  );
}
