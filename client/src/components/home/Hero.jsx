import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    return <a href={to} className={className} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return <Link to={to} className={className}>{children}</Link>;
}

/** Splits the headline at sentence breaks so each line can rise in sequence. */
const lines = (text) => text.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) || [text];

export default function Hero({ banner }) {
  const b = { ...DEFAULT, ...Object.fromEntries(Object.entries(banner || {}).filter(([, v]) => v)) };
  const reduce = useReducedMotion();
  const section = useRef(null);
  const [activeVideo, setActiveVideo] = useState(0);
  const videos = [
    { src: b.video_url || '/videos/big-parcel-box-no-text.mp4', alt: b.image_alt || 'boxel Parcel Drop Box showcase' },
    { src: '/videos/small-parcel-box-no-text.mp4', alt: 'boxel Small Parcel Box showcase' },
  ];

  // Scroll-linked depth: the product drifts up slower than the page, the studio panel slower still.
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end start'] });
  const productY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -70]);
  const productScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.94]);
  const panelY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40]);

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
                <motion.span className="block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.55 + i * 0.12, ease: EASE }}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="mt-6 max-w-[34ch] text-lead text-graphite" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.85, ease: EASE }}>
            {b.subheadline}
          </motion.p>
          <motion.div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1, ease: EASE }}>
            {b.cta_text && b.cta_url && <SmartLink to={b.cta_url} className="btn btn-primary group">{b.cta_text}</SmartLink>}
            {b.secondary_cta_text && b.secondary_cta_url && <SmartLink to={b.secondary_cta_url} className="link py-2 text-[0.9375rem] font-medium">{b.secondary_cta_text}</SmartLink>}
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
                key={videos[activeVideo].src}
                videoSrc={videos[activeVideo].src}
                webmSrc=""
                poster={b.desktop_image_url}
                alt={videos[activeVideo].alt}
                className="w-full h-full max-h-[560px] object-cover"
                loop={false}
                onEnded={() => setActiveVideo((current) => (current + 1) % videos.length)}
              />
              <div className="pointer-events-none absolute inset-y-0 left-2 right-2 z-20 flex items-center justify-between sm:left-4 sm:right-4">
                <button
                  type="button"
                  onClick={() => setActiveVideo((current) => (current + videos.length - 1) % videos.length)}
                  aria-label="Show previous product video"
                  className="pointer-events-auto grid size-10 place-items-center rounded-full border border-white/50 bg-black/35 text-white shadow-lg backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:size-12"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveVideo((current) => (current + 1) % videos.length)}
                  aria-label="Show next product video"
                  className="pointer-events-auto grid size-10 place-items-center rounded-full border border-white/50 bg-black/35 text-white shadow-lg backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:size-12"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
}
