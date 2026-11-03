import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Bell, Box, ExternalLink, FolderTree, HelpCircle, Image, LayoutDashboard, LogOut, Mail, MapPin, Menu, MessageSquare,
  Search, Settings, Share2, ShoppingCart, Star, Truck, Users as UsersIcon, UserCog,
} from 'lucide-react';
import Logo from '../components/ui/Logo.jsx';
import { Drawer } from '../components/ui/Overlay.jsx';
import { useAdmin, can } from './AdminAuth.jsx';
import { get } from '../services/api.js';
import { useDebounced } from '../hooks/useApi.js';
import { formatINR } from '../utils/format.js';
import { titleCase } from './components/ui.jsx';

const NAV = [
  { group: 'Overview', items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, area: 'dashboard' }] },
  {
    group: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, area: 'orders', badge: 'orders' },
      { to: '/admin/customers', label: 'Customers', icon: UsersIcon, area: 'customers' },
      { to: '/admin/enquiries', label: 'Enquiries', icon: MessageSquare, area: 'enquiries', badge: 'enquiries' },
      { to: '/admin/reviews', label: 'Reviews', icon: Star, area: 'reviews', badge: 'reviews' },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { to: '/admin/products', label: 'Products', icon: Box, area: 'products' },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree, area: 'categories' },
      { to: '/admin/vendors', label: 'Vendors', icon: Truck, area: 'products' },
    ],
  },
  {
    group: 'Content',
    items: [
      { to: '/admin/banners', label: 'Homepage & banners', icon: Image, area: 'content' },
      { to: '/admin/faqs', label: 'FAQs', icon: HelpCircle, area: 'content' },
      { to: '/admin/social-links', label: 'Social links', icon: Share2, area: 'content' },
    ],
  },
  {
    group: 'Settings',
    items: [
      { to: '/admin/store-settings', label: 'Store settings', icon: Settings, area: 'settings' },
      { to: '/admin/contacts', label: 'Business contact', icon: MapPin, area: 'settings' },
      { to: '/admin/shipping-settings', label: 'Shipping & policies', icon: Truck, area: 'settings' },
      { to: '/admin/email-settings', label: 'Email', icon: Mail, area: 'email', badge: 'emails' },
      { to: '/admin/users', label: 'Admin users', icon: UserCog, area: 'users' },
      { to: '/admin/activity-logs', label: 'Activity log', icon: Activity, area: 'activity' },
    ],
  },
];

function Sidebar({ counts }) {
  const { admin } = useAdmin();
  return (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-hairline px-5">
        <Logo to="/admin/dashboard" className="h-6 w-auto" />
        <span className="ml-2 rounded-sm bg-stone-2 px-1.5 py-0.5 text-[0.6875rem] text-graphite">Admin</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((g) => {
          const items = g.items.filter((i) => can(admin, i.area));
          if (!items.length) return null;
          return (
            <div key={g.group} className="mb-5">
              <p className="px-2 pb-1.5 text-[0.75rem] text-graphite">{g.group}</p>
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, badge }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded px-2 py-2 text-sm transition-colors ${isActive ? 'bg-ink text-white' : 'text-ink/80 hover:bg-stone hover:text-ink'}`
                      }
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="flex-1">{label}</span>
                      {badge && counts[badge] > 0 && (
                        <span className="rounded-full bg-signal px-1.5 text-[0.6875rem] font-semibold leading-[1.125rem] text-ink">
                          {counts[badge]}
                          <span className="sr-only"> pending</span>
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState(null);
  const debounced = useDebounced(q.trim(), 250);
  const navigate = useNavigate();
  const box = useRef(null);

  useEffect(() => {
    if (debounced.length < 2) return setRes(null);
    const ac = new AbortController();
    get(`/admin/search?q=${encodeURIComponent(debounced)}`, { signal: ac.signal }).then(setRes).catch(() => {});
    return () => ac.abort();
  }, [debounced]);

  useEffect(() => {
    const onDoc = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const go = (to) => {
    setOpen(false);
    setQ('');
    navigate(to);
  };
  const total = res ? res.orders.length + res.customers.length + res.products.length : 0;

  return (
    <div ref={box} className="relative w-full max-w-md" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-graphite" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search orders, customers, products"
        aria-label="Search the admin"
        className="field min-h-10 bg-stone py-2 pl-9 text-sm"
      />
      {open && res && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-md border border-hairline bg-white p-2 shadow-[var(--shadow-float)]">
          {total === 0 && <p className="p-3 text-sm text-graphite">No matches.</p>}
          {[
            ['Orders', res.orders, (o) => [`/admin/orders/${o.id}`, `${o.order_number} — ${o.customer_name}`, formatINR(o.total)]],
            ['Customers', res.customers, (c) => [`/admin/customers/${c.id}`, c.name, c.email]],
            ['Products', res.products, (p) => [`/admin/products/${p.id}/edit`, p.name, p.sku]],
          ].map(([label, list, fmt]) =>
            list.length ? (
              <div key={label} className="py-1">
                <p className="px-2 py-1 text-[0.75rem] text-graphite">{label}</p>
                {list.map((item) => {
                  const [to, title, meta] = fmt(item);
                  return (
                    <button key={to} type="button" onClick={() => go(to)} className="flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-sm hover:bg-stone">
                      <span className="truncate">{title}</span>
                      <span className="shrink-0 text-graphite">{meta}</span>
                    </button>
                  );
                })}
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function Dropdown({ button, children, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button type="button" aria-expanded={open} aria-haspopup="true" aria-label={label} onClick={() => setOpen((o) => !o)} className="relative flex items-center gap-2 rounded-full p-2 hover:bg-stone">
        {button}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full z-30 mt-2 w-72 rounded-md border border-hairline bg-white p-2 shadow-[var(--shadow-float)]"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminLayout({ children }) {
  const { admin, logout } = useAdmin();
  const [mobileNav, setMobileNav] = useState(false);
  const [notes, setNotes] = useState({ items: [], total: 0 });
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileNav(false);
    get('/admin/notifications').then(setNotes).catch(() => {});
  }, [pathname]);

  const counts = Object.fromEntries(notes.items.map((i) => [i.key, i.count]));
  const signOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-stone">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 print:!hidden border-r border-hairline bg-white lg:block">
        <Sidebar counts={counts} />
      </aside>
      <Drawer open={mobileNav} onClose={() => setMobileNav(false)} title="Admin menu" side="left" width="max-w-[17rem]">
        <Sidebar counts={counts} />
      </Drawer>

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-30 flex h-16 print:hidden items-center gap-3 border-b border-hairline bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" className="-ml-1 rounded-full p-2 hover:bg-stone lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open admin menu">
            <Menu className="size-5" />
          </button>
          <div className="hidden flex-1 sm:block">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <a href="/" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 rounded px-2.5 py-2 text-sm text-graphite hover:bg-stone hover:text-ink md:inline-flex">
              <ExternalLink className="size-4" aria-hidden /> View site
            </a>
            <Dropdown
              label={`Notifications${notes.total ? `, ${notes.total} need attention` : ''}`}
              button={
                <>
                  <Bell className="size-5" />
                  {notes.total > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-signal" aria-hidden />}
                </>
              }
            >
              {notes.items.length === 0 ? (
                <p className="p-3 text-sm text-graphite">You are all caught up.</p>
              ) : (
                <ul>
                  {notes.items.map((n) => (
                    <li key={n.key}>
                      <Link to={n.link} className="flex items-center justify-between gap-3 rounded px-3 py-2.5 text-sm hover:bg-stone">
                        <span>
                          <strong className="font-semibold">{n.count}</strong> {n.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Dropdown>
            <Dropdown
              label="Account menu"
              button={
                <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-medium text-white" aria-hidden>
                  {admin.name.slice(0, 1).toUpperCase()}
                </span>
              }
            >
              <div className="border-b border-hairline px-3 pb-3 pt-1">
                <p className="text-sm font-medium">{admin.name}</p>
                <p className="truncate text-[0.8125rem] text-graphite">{admin.email}</p>
                <p className="mt-1 text-[0.75rem] text-graphite">{titleCase(admin.role)}</p>
              </div>
              <button type="button" onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-sm hover:bg-stone">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </Dropdown>
          </div>
        </header>
        <div className="border-b border-hairline bg-white px-4 py-2 sm:hidden print:hidden">
          <GlobalSearch />
        </div>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
