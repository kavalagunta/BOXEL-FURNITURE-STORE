import { lazy, Suspense, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import Seo from '../components/ui/Seo.jsx';
import Logo from '../components/ui/Logo.jsx';
import { Field, FormError } from '../components/ui/Field.jsx';
import { PageLoader } from '../components/ui/States.jsx';
import { AdminAuthProvider, useAdmin, can } from './AdminAuth.jsx';
import AdminLayout from './AdminLayout.jsx';

const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const ProductsList = page(() => import('./pages/Products.jsx'), 'ProductsList');
const ProductForm = page(() => import('./pages/Products.jsx'), 'ProductForm');
const Categories = lazy(() => import('./pages/Categories.jsx'));
const Vendors = lazy(() => import('./pages/Vendors.jsx'));
const OrdersList = page(() => import('./pages/Orders.jsx'), 'OrdersList');
const OrderDetail = page(() => import('./pages/Orders.jsx'), 'OrderDetail');
const CustomersList = page(() => import('./pages/Customers.jsx'), 'CustomersList');
const CustomerDetail = page(() => import('./pages/Customers.jsx'), 'CustomerDetail');
const Reviews = lazy(() => import('./pages/Reviews.jsx'));
const Enquiries = lazy(() => import('./pages/Enquiries.jsx'));
const Faqs = page(() => import('./pages/Content.jsx'), 'Faqs');
const Banners = page(() => import('./pages/Content.jsx'), 'Banners');
const SocialLinks = page(() => import('./pages/Content.jsx'), 'SocialLinks');
const StoreSettings = page(() => import('./pages/Settings.jsx'), 'StoreSettings');
const ContactSettings = page(() => import('./pages/Settings.jsx'), 'ContactSettings');
const ShippingSettings = page(() => import('./pages/Settings.jsx'), 'ShippingSettings');
const EmailSettings = page(() => import('./pages/System.jsx'), 'EmailSettings');
const Users = page(() => import('./pages/System.jsx'), 'Users');
const ActivityLogs = page(() => import('./pages/System.jsx'), 'ActivityLogs');

function AdminLogin() {
  const { admin, login } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (admin) return <Navigate to={location.state?.from || '/admin/dashboard'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from || '/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-stone px-4">
      <Seo title="Admin sign in" noindex />
      <div className="w-full max-w-sm rounded-md border border-hairline bg-white p-8">
        <Logo className="h-7 w-auto" to="/" />
        <h1 className="mt-8 text-2xl font-light tracking-tight">Admin sign in</h1>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="Email" type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Field label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <FormError message={error} />
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !form.email || !form.password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-[0.8125rem] text-graphite">Admin accounts are created by a super admin. There is no public sign-up.</p>
      </div>
    </main>
  );
}

function Guard({ area, children }) {
  const { admin } = useAdmin();
  if (!can(admin, area)) {
    return (
      <div className="rounded-md border border-hairline bg-white p-8">
        <h1 className="text-xl font-medium">You do not have access to this page</h1>
        <p className="mt-2 text-graphite">Ask a super admin to change your role if you need it.</p>
      </div>
    );
  }
  return children;
}

function Protected() {
  const { admin, ready } = useAdmin();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  const g = (area, el) => <Guard area={area}>{el}</Guard>;
  return (
    <AdminLayout>
      <Seo title="Admin" noindex />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={g('dashboard', <Dashboard />)} />
          <Route path="products" element={g('products', <ProductsList />)} />
          <Route path="products/new" element={g('products', <ProductForm />)} />
          <Route path="products/:id/edit" element={g('products', <ProductForm />)} />
          <Route path="categories" element={g('categories', <Categories />)} />
          <Route path="vendors" element={g('products', <Vendors />)} />
          <Route path="orders" element={g('orders', <OrdersList />)} />
          <Route path="orders/:id" element={g('orders', <OrderDetail />)} />
          <Route path="customers" element={g('customers', <CustomersList />)} />
          <Route path="customers/:id" element={g('customers', <CustomerDetail />)} />
          <Route path="reviews" element={g('reviews', <Reviews />)} />
          <Route path="enquiries" element={g('enquiries', <Enquiries />)} />
          <Route path="contacts" element={g('settings', <ContactSettings />)} />
          <Route path="faqs" element={g('content', <Faqs />)} />
          <Route path="banners" element={g('content', <Banners />)} />
          <Route path="store-settings" element={g('settings', <StoreSettings />)} />
          <Route path="social-links" element={g('content', <SocialLinks />)} />
          <Route path="shipping-settings" element={g('settings', <ShippingSettings />)} />
          <Route path="email-settings" element={g('email', <EmailSettings />)} />
          <Route path="users" element={g('users', <Users />)} />
          <Route path="activity-logs" element={g('activity', <ActivityLogs />)} />
          <Route path="*" element={<p className="text-graphite">This admin page does not exist.</p>} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route path="*" element={<Protected />} />
      </Routes>
    </AdminAuthProvider>
  );
}
