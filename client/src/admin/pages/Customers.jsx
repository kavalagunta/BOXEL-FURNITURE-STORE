import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { PageHeader, Card, Table, Pagination, SearchInput, Select, StatusBadge, Toolbar, ConfirmDialog, Badge } from '../components/ui.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAdmin, can } from '../AdminAuth.jsx';
import { patch, qs } from '../../services/api.js';
import { formatDate, formatDateTime, formatINR, formatPhone, ORDER_STATUS, PAYMENT_STATUS } from '../../utils/format.js';

export function CustomersList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };
  const { data, loading, error, reload } = useApi(`/admin/customers${qs({ q: params.get('q'), status: params.get('status'), has_orders: params.get('has_orders'), page: params.get('page') })}`);
  return (
    <>
      <PageHeader title="Customers" description="Registered customer accounts. Guest orders appear under Orders." />
      {error && <ErrorState error={error} onRetry={reload} />}
      <Card padded={false}>
        <Toolbar>
          <SearchInput value={params.get('q') || ''} onChange={(v) => set('q', v)} placeholder="Name, email or phone" className="sm:w-72" />
          <Select label="Account status" value={params.get('status') || ''} onChange={(v) => set('status', v)} options={[{ value: '', label: 'Any status' }, { value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' }]} />
          <Select label="Orders" value={params.get('has_orders') || ''} onChange={(v) => set('has_orders', v)} options={[{ value: '', label: 'All customers' }, { value: '1', label: 'Has ordered' }]} />
        </Toolbar>
        <Table
          loading={loading}
          rows={data?.items}
          empty="No customers yet."
          onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
          columns={[
            { key: 'name', label: 'Customer', render: (c) => <span><Link to={`/admin/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{c.name}</Link><span className="block text-[0.75rem] text-graphite">{c.email}</span></span> },
            { key: 'phone', label: 'Phone', render: (c) => formatPhone(c.phone) || '—' },
            { key: 'created_at', label: 'Registered', render: (c) => formatDate(c.created_at) },
            { key: 'order_count', label: 'Orders' },
            { key: 'order_value', label: 'Order value', render: (c) => formatINR(c.order_value) },
            { key: 'last_order_at', label: 'Last order', render: (c) => (c.last_order_at ? formatDate(c.last_order_at) : '—') },
            { key: 'is_active', label: 'Status', render: (c) => <StatusBadge status={c.is_active ? 'active' : 'inactive'} label={c.is_active ? 'Active' : 'Disabled'} /> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(p) => set('page', String(p))} />
      </Card>
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const { admin } = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/admin/customers/${id}`);
  const [confirm, setConfirm] = useState(false);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  const { customer: c, orders, addresses, reviews } = data;

  const toggle = async () => {
    try {
      await patch(`/admin/customers/${id}/status`, { is_active: !c.is_active });
      toast.success(c.is_active ? 'Account disabled.' : 'Account enabled.');
      setConfirm(false);
      reload();
    } catch (ex) {
      toast.error(ex.message);
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: '/admin/customers', label: 'Customers' }}
        title={c.name}
        description={`Registered ${formatDate(c.created_at)}${c.last_login_at ? ` · last sign-in ${formatDateTime(c.last_login_at)}` : ''}`}
        actions={
          can(admin, 'products') && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>
              {c.is_active ? 'Disable account' : 'Enable account'}
            </button>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={`Orders (${c.order_count})`} padded={false}>
            <Table
              rows={orders}
              empty="No orders yet."
              columns={[
                { key: 'order_number', label: 'Order', render: (o) => <Link to={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.order_number}</Link> },
                { key: 'created_at', label: 'Placed', render: (o) => formatDateTime(o.created_at) },
                { key: 'status', label: 'Status', render: (o) => <StatusBadge status={o.status} label={ORDER_STATUS[o.status]} /> },
                { key: 'payment_status', label: 'Payment', render: (o) => <StatusBadge status={o.payment_status} label={PAYMENT_STATUS[o.payment_status]} /> },
                { key: 'total', label: 'Total', className: 'text-right', render: (o) => formatINR(o.total) },
              ]}
            />
          </Card>
          <Card title="Reviews" padded={false}>
            {reviews.length === 0 ? (
              <p className="p-5 text-sm text-graphite">No reviews.</p>
            ) : (
              <ul className="divide-y divide-hairline text-sm">
                {reviews.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span>
                      {r.rating}★ {r.title} <span className="text-graphite">— {r.product_name}</span>
                    </span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Contact">
            <dl className="space-y-3 text-sm">
              <div><dt className="text-graphite">Email</dt><dd><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></dd></div>
              <div><dt className="text-graphite">Phone</dt><dd>{formatPhone(c.phone) || '—'}</dd></div>
              <div><dt className="text-graphite">Lifetime order value</dt><dd>{formatINR(c.order_value)} <span className="text-graphite">(excludes cancelled)</span></dd></div>
              <div><dt className="text-graphite">Account</dt><dd>{c.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</dd></div>
            </dl>
          </Card>
          <Card title="Saved addresses">
            {addresses.length === 0 ? (
              <p className="text-sm text-graphite">None saved.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {addresses.map((a) => (
                  <li key={a.id}>
                    {a.full_name}, {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}
                    {a.is_default ? <span className="ml-1 text-graphite">(default)</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={toggle}
        title={c.is_active ? 'Disable this account?' : 'Enable this account?'}
        body={c.is_active ? 'The customer will be signed out and cannot sign in until the account is enabled again. Their orders are kept.' : 'The customer will be able to sign in again.'}
        confirmLabel={c.is_active ? 'Disable' : 'Enable'}
        danger={c.is_active}
      />
    </>
  );
}
