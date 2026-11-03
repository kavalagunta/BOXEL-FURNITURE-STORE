import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import Logo from '../components/ui/Logo.jsx';
import { Drawer } from '../components/ui/Overlay.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSite } from '../context/SiteContext.jsx';
import { EASE } from '../components/ui/Reveal.jsx';
import { formatPhone, telHref } from '../utils/format.js';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

function SearchBox({ onDone }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);
  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/products?search=${encodeURIComponent(q.trim())}` : '/products');
    onDone();
  };
  return (
    <form role="search" onSubmit={submit} className="flex w-full items-center gap-3" onKeyDown={(e) => e.key === 'Escape' && onDone()}>
      <Search className="size-5 shrink-0 text-graphite" aria-hidden />
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <input
        id="site-search"
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search products"
        className="h-11 w-full bg-transparent text-lg outline-none placeholder:text-graphite"
        maxLength={80}
      />
      <button type="button" onClick={onDone} className="rounded-full p-2 hover:bg-stone" aria-label="Close search">
        <X className="size-5" />
      </button>
    </form>
  );
}

export default function Navbar() {
  const { count, openDrawer } = useCart();
  const { customer } = useAuth();
  const { s } = useSite();
  const { pathname } = useLocation();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 12));
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const solid = scrolled || searchOpen || pathname !== '/';

  return (
    <header className="sticky top-0 z-50">
      <div
        className={`border-b transition-[background-color,border-color,backdrop-filter] duration-500 ease-[var(--ease-out-quint)] ${
          solid ? 'border-hairline bg-white/88 backdrop-blur-xl backdrop-saturate-150' : 'border-transparent bg-transparent'
        }`}
      >
        <nav className="shell relative flex h-16 items-center gap-6 lg:h-[4.5rem]" aria-label="Main">
          <button type="button" className="-ml-2 rounded-full p-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
            <Menu className="size-5" />
          </button>

          <Logo className="h-6 w-auto sm:h-7" />

          <ul className="ml-6 hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `relative rounded px-3 py-2 text-[0.9375rem] transition-colors ${isActive ? 'text-ink' : 'text-graphite hover:text-ink'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {l.label}
                      {isActive && <motion.span layoutId="nav-active" className="absolute inset-x-3 -bottom-px h-px bg-ink" transition={{ duration: 0.4, ease: EASE }} />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setSearchOpen(true)} className="rounded-full p-2.5 hover:bg-stone" aria-label="Search products" aria-expanded={searchOpen}>
              <Search className="size-5" />
            </button>
            <Link to={customer ? '/account' : '/login'} className="hidden rounded-full p-2.5 hover:bg-stone sm:inline-flex" aria-label={customer ? 'Your account' : 'Sign in'}>
              <User className="size-5" />
            </Link>
            <button type="button" onClick={openDrawer} className="relative rounded-full p-2.5 hover:bg-stone" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
              <ShoppingBag className="size-5" />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                    className="absolute right-0.5 top-0.5 grid min-w-[1.125rem] place-items-center rounded-full bg-signal px-1 text-[0.6875rem] font-semibold leading-[1.125rem] text-ink"
                    aria-hidden
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          <AnimatePresence>
            {searchOpen && (
              <motion.div
                className="absolute inset-x-0 top-0 z-10 flex h-full items-center bg-white px-4 sm:px-6 lg:px-10"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <SearchBox onDone={() => setSearchOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" side="left" width="max-w-xs">
        <nav aria-label="Mobile" className="flex h-full flex-col p-5">
          <ul className="space-y-1">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={({ isActive }) => `block rounded px-2 py-3 text-2xl font-light tracking-tight ${isActive ? 'text-ink' : 'text-graphite'}`}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-8 border-t border-hairline pt-6">
            <Link to={customer ? '/account' : '/login'} className="flex items-center gap-3 py-2 text-[0.9375rem]">
              <User className="size-5" aria-hidden /> {customer ? `Account — ${customer.name.split(' ')[0]}` : 'Sign in or create an account'}
            </Link>
          </div>
          <a href={telHref(s.business_phone)} className="mt-auto pt-6 text-sm text-graphite">
            Call or WhatsApp {formatPhone(s.business_phone)}
          </a>
        </nav>
      </Drawer>
    </header>
  );
}
