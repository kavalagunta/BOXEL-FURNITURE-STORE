import { Suspense, useEffect } from 'react';
import { Link, useLocation, useOutlet } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import CartDrawer from '../components/CartDrawer.jsx';
import { PageLoader } from '../components/ui/States.jsx';
import { useSite } from '../context/SiteContext.jsx';
import { EASE } from '../components/ui/Reveal.jsx';

function AnnouncementBar() {
  const { s } = useSite();
  if (!s.announcement_enabled || !s.announcement_text) return null;
  const external = /^https?:\/\//.test(s.announcement_link || '');
  const inner = <span>{s.announcement_text}</span>;
  return (
    <div className="bg-ink text-white">
      <div className="shell flex min-h-9 items-center justify-center gap-2 py-2 text-center text-[0.8125rem] tracking-[0.005em]">
        <span className="tile text-[0.6rem]" aria-hidden />
        {s.announcement_link ? (
          external ? (
            <a href={s.announcement_link} className="underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          ) : (
            <Link to={s.announcement_link} className="underline-offset-4 hover:underline">
              {inner}
            </Link>
          )
        ) : (
          inner
        )}
      </div>
    </div>
  );
}

export default function SiteLayout() {
  const location = useLocation();
  const outlet = useOutlet();

  // New page → start at the top (unless navigating to an in-page anchor).
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.hash]);

  return (
    <>
      <a href="#main" className="sr-only z-[100] rounded bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <AnnouncementBar />
      <Navbar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          id="main"
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="min-h-[60vh]"
        >
          <Suspense fallback={<PageLoader />}>
            {outlet}
          </Suspense>
        </motion.main>
      </AnimatePresence>
      <Footer />
      <CartDrawer />
    </>
  );
}
