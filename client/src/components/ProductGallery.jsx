import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { Modal } from './ui/Overlay.jsx';

/** Main image with hover magnifier (fine pointers), thumbnails and a full-screen viewer. */
export default function ProductGallery({ images, name }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(null);
  const [viewer, setViewer] = useState(false);
  const current = images[index];
  const go = useCallback((d) => setIndex((i) => (i + d + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (!viewer) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, go]);

  if (!images.length) {
    return <div className="aspect-square rounded-sm bg-stone" aria-label={`No image for ${name}`} />;
  }

  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row lg:gap-4">
      {images.length > 1 && (
        <ul className="flex gap-3 lg:flex-col" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={`block size-16 overflow-hidden rounded-sm border-2 bg-stone transition-colors sm:size-20 ${i === index ? 'border-ink' : 'border-transparent hover:border-hairline'}`}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index}
              >
                <img src={img.url} alt="" className="size-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex-1">
        <button
          type="button"
          className="group relative block aspect-[1309/1202] w-full cursor-zoom-in overflow-hidden rounded-sm bg-[linear-gradient(180deg,var(--color-studio-top),var(--color-studio-floor))]"
          onPointerMove={onMove}
          onPointerLeave={() => setZoom(null)}
          onClick={() => setViewer(true)}
          aria-label={`Open full-size image: ${current.alt}`}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.img
              key={current.url}
              src={current.url}
              srcSet={current.srcset}
              sizes="(min-width: 1024px) 55vw, 100vw"
              alt={current.alt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out"
              style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              width="1309"
              height="1202"
              fetchPriority="high"
              onError={(e) => { e.currentTarget.src = '/images/placeholder.svg'; e.currentTarget.removeAttribute('srcset'); }}
            />
          </AnimatePresence>
          <span className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-white/90 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
            <Expand className="size-4" />
          </span>
        </button>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between lg:hidden">
            <button type="button" onClick={() => go(-1)} className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/90" aria-label="Previous image">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/90" aria-label="Next image">
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>

      <Modal open={viewer} onClose={() => setViewer(false)} title={`${name} — image ${index + 1} of ${images.length}`} size="max-w-5xl">
        <div className="relative">
          <img src={current.url} alt={current.alt} className="mx-auto max-h-[75vh] w-auto rounded-sm" />
          {images.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" onClick={() => go(-1)} className="btn btn-secondary btn-sm" aria-label="Previous image">
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm text-graphite">
                {index + 1} / {images.length}
              </span>
              <button type="button" onClick={() => go(1)} className="btn btn-secondary btn-sm" aria-label="Next image">
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
