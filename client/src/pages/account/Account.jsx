import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { Package, Trash2 } from 'lucide-react';
import Seo from '../../components/ui/Seo.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { PageLoader, ErrorState } from '../../components/ui/States.jsx';
import OrderView from '../../components/OrderView.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { del, post } from '../../services/api.js';
import { formatDate, formatINR, ORDER_STATUS } from '../../utils/format.js';
import { INDIAN_STATES, passwordProblem } from '../../utils/validation.js';

export function AccountLayout() {
  const { customer, ready, logout } = useAuth();
  const { clearLocal } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  if (!ready) return <PageLoader />;
  if (!customer) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const signOut = async () => {
    await logout();
    clearLocal();
    navigate('/', { replace: true });
  };

  const tab = ({ isActive }) => `rounded-full px-4 py-2 text-sm ${isActive ? 'bg-ink text-white' : 'border border-hairline hover:border-ink'}`;
  return (
    <section className="shell pb-24 pt-10 sm:pt-14">
      <Seo title="Your account" noindex />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-graphite">Hello,</p>
          <h1 className="text-display font-light">{customer.name.split(' ')[0]}</h1>
        </div>
        <button type="button" onClick={signOut} className="link text-sm">
          Sign out
        </button>
      </div>
      <nav className="mt-8 flex flex-wrap gap-2 border-b border-hairline pb-6" aria-label="Account">
        <NavLink to="/account" end className={tab}>
          Profile
        </NavLink>
        <NavLink to="/account/orders" className={tab}>
          Orders
        </NavLink>
      </nav>
      <div className="mt-10">
        <Outlet />
      </div>
    </section>
  );
}

function ProfileForm() {
  const { customer, updateProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: customer.name, phone: customer.phone || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile(form);
      setErrors({});
      toast.success('Profile saved.');
    } catch (err) {
      setErrors({ ...err.fields, _: err.message });
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <h2 className="text-title font-medium">Profile</h2>
      <Field label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
      <Field label="Email" value={customer.email} readOnly disabled hint="Contact us to change the email on your account." />
      <Field label="Mobile number" optional type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
      <FormError message={errors._} />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        Save profile
      </button>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const p = passwordProblem(form.newPassword);
    if (p) return setErrors({ newPassword: p });
    try {
      await post('/auth/change-password', form);
      setForm({ currentPassword: '', newPassword: '' });
      setErrors({});
      toast.success('Password updated.');
    } catch (err) {
      setErrors({ ...err.fields, _: err.message });
    }
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <h2 className="text-title font-medium">Change password</h2>
      <Field label="Current password" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} error={errors.currentPassword} />
      <Field label="New password" type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} error={errors.newPassword} hint="At least 10 characters, with letters and numbers." />
      <FormError message={errors._} />
      <button type="submit" className="btn btn-secondary">
        Update password
      </button>
    </form>
  );
}

const EMPTY_ADDR = { label: '', fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

function Addresses() {
  const { data, reload } = useApi('/account/addresses');
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDR);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      await post('/account/addresses', form);
      setForm(EMPTY_ADDR);
      setAdding(false);
      setErrors({});
      reload();
      toast.success('Address saved.');
    } catch (err) {
      setErrors({ ...err.fields, _: err.message });
    }
  };
  const remove = async (id) => {
    await del(`/account/addresses/${id}`);
    reload();
    toast.success('Address removed.');
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-title font-medium">Saved addresses</h2>
        {!adding && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
            Add address
          </button>
        )}
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {data?.items.map((a) => (
          <li key={a.id} className="rounded-sm border border-hairline p-5 text-[0.9375rem]">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">
                {a.label || a.full_name}
                {a.is_default ? <span className="ml-2 rounded-sm bg-stone-2 px-1.5 py-0.5 text-[0.75rem] font-normal">Default</span> : null}
              </p>
              <button type="button" onClick={() => remove(a.id)} className="rounded p-1 text-graphite hover:text-danger" aria-label={`Remove address ${a.line1}`}>
                <Trash2 className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-graphite">
              {a.full_name}, {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}
            </p>
          </li>
        ))}
        {data && data.items.length === 0 && !adding && <li className="text-graphite">No saved addresses yet. Addresses you use at checkout can be saved here.</li>}
      </ul>
      {adding && (
        <form onSubmit={save} noValidate className="mt-6 grid gap-4 rounded-sm border border-hairline p-5 sm:grid-cols-2">
          <Field label="Label" optional value={form.label} onChange={set('label')} placeholder="Home, Office" error={errors.label} />
          <Field label="Full name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
          <Field label="Mobile number" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
          <Field label="PIN code" inputMode="numeric" value={form.pincode} onChange={set('pincode')} error={errors.pincode} />
          <Field label="Address line 1" className="sm:col-span-2" value={form.line1} onChange={set('line1')} error={errors.line1} />
          <Field label="Address line 2" optional className="sm:col-span-2" value={form.line2} onChange={set('line2')} />
          <Field label="City" value={form.city} onChange={set('city')} error={errors.city} />
          <Field label="State" as="select" value={form.state} onChange={set('state')} error={errors.state}>
            <option value="">Choose…</option>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Field>
          <div className="sm:col-span-2">
            <FormError message={errors._} />
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Save address
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AccountProfile() {
  return (
    <div className="grid gap-16 lg:grid-cols-12">
      <div className="space-y-14 lg:col-span-5">
        <ProfileForm />
        <PasswordForm />
      </div>
      <div className="lg:col-span-6 lg:col-start-7">
        <Addresses />
        <Link to="/account/orders" className="btn btn-secondary mt-12">
          <Package className="size-4" aria-hidden /> View your orders
        </Link>
      </div>
    </div>
  );
}

export function AccountOrders() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/account/orders?page=${page}`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  if (!data.items.length) {
    return (
      <div className="rounded-sm bg-stone px-6 py-12">
        <h2 className="text-title font-medium">No orders yet</h2>
        <p className="mt-2 text-graphite">Orders you place while signed in appear here.</p>
        <Link to="/products" className="btn btn-primary mt-6">
          Browse products
        </Link>
      </div>
    );
  }
  return (
    <div>
      <h2 className="sr-only">Your orders</h2>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {data.items.map((o) => (
          <li key={o.order_number}>
            <Link to={`/account/orders/${o.order_number}`} className="grid grid-cols-[4rem_1fr] items-center gap-4 py-5 transition-colors hover:bg-stone sm:grid-cols-[4rem_1fr_auto_auto] sm:gap-8 sm:px-3">
              <div className="size-16 overflow-hidden rounded-sm bg-stone">{o.image_url && <img src={o.image_url} alt="" className="size-full object-cover" />}</div>
              <div>
                <p className="font-medium">{o.order_number}</p>
                <p className="text-sm text-graphite">
                  {formatDate(o.created_at)} · {o.item_count} item{o.item_count === 1 ? '' : 's'}
                </p>
              </div>
              <span className="col-start-2 text-sm sm:col-start-auto">{ORDER_STATUS[o.status]}</span>
              <span className="col-start-2 font-medium tabular-nums sm:col-start-auto">{formatINR(o.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data.meta.pages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="text-sm text-graphite">
            Page {data.meta.page} of {data.meta.pages}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page >= data.meta.pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export function AccountOrderDetail() {
  const { orderNumber } = useParams();
  const { data, error, loading, reload } = useApi(`/account/orders/${encodeURIComponent(orderNumber)}`);
  useEffect(() => window.scrollTo(0, 0), []);
  if (error) return error.status === 404 ? <p className="text-graphite">We could not find this order in your account.</p> : <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  return (
    <div>
      <Link to="/account/orders" className="link text-sm">
        All orders
      </Link>
      <h2 className="mt-4 text-headline font-light">Order {data.order.order_number}</h2>
      <div className="mt-8">
        <OrderView order={data.order} />
      </div>
    </div>
  );
}
