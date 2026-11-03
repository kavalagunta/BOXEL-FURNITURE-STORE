import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, Pencil, Plus, RotateCw, XCircle } from 'lucide-react';
import { PageHeader, Card, Table, Pagination, Select, StatusBadge, Toolbar, Toggle, titleCase } from '../components/ui.jsx';
import { SettingsForm } from './Settings.jsx';
import { Modal } from '../../components/ui/Overlay.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAdmin } from '../AdminAuth.jsx';
import { post, put, qs } from '../../services/api.js';
import { formatDateTime } from '../../utils/format.js';

const TYPE_LABELS = {
  order_customer: 'Order confirmation (customer)',
  order_admin: 'New order (admin)',
  order_status: 'Order update (customer)',
  enquiry_admin: 'New enquiry (admin)',
  enquiry_ack: 'Enquiry receipt (customer)',
  enquiry_reply: 'Enquiry reply',
  password_reset: 'Password reset',
  newsletter_admin: 'New subscriber (admin)',
  test: 'SMTP test',
};

export function EmailSettings() {
  const { admin } = useAdmin();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = useApi('/admin/email/status');
  const logs = useApi(`/admin/email/logs${qs({ status: params.get('status'), page: params.get('page') })}`);
  const [testTo, setTestTo] = useState(admin.email);
  const [testState, setTestState] = useState({ busy: false, error: '' });
  const superAdmin = admin.role === 'super_admin';

  const retry = async (id) => {
    try {
      const res = await post(`/admin/email/logs/${id}/retry`);
      if (res.status === 'sent') toast.success('Email sent.');
      else toast.error(`Email ${res.status}${res.error ? `: ${res.error}` : '.'}`);
      logs.reload();
      status.reload();
    } catch (ex) {
      toast.error(ex.message);
    }
  };

  const sendTest = async (e) => {
    e.preventDefault();
    setTestState({ busy: true, error: '' });
    try {
      await post('/admin/email/test', { to: testTo });
      toast.success(`Test email sent to ${testTo}.`);
      setTestState({ busy: false, error: '' });
      logs.reload();
    } catch (ex) {
      setTestState({ busy: false, error: ex.message });
    }
  };

  const smtp = status.data?.smtp;
  return (
    <>
      <PageHeader title="Email" description="SMTP credentials live only in server/.env and are never sent to the browser." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="SMTP connection">
          {!smtp ? (
            <PageLoader />
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm font-medium">
                {smtp.configured ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <XCircle className="size-4 text-danger" aria-hidden />}
                {smtp.configured ? 'Configured' : 'Not configured — emails are logged as skipped'}
              </p>
              <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-graphite">Host</dt>
                <dd>{smtp.host ? `${smtp.host}:${smtp.port}${smtp.secure ? ' (TLS)' : ''}` : '—'}</dd>
                <dt className="text-graphite">User</dt>
                <dd>{smtp.user || '—'}</dd>
                <dt className="text-graphite">From</dt>
                <dd className="break-all">{smtp.fromEmail ? `${smtp.fromName} <${smtp.fromEmail}>` : '—'}</dd>
                <dt className="text-graphite">Admin inbox</dt>
                <dd className="break-all">{smtp.adminEmail || '—'}</dd>
              </dl>
              {!smtp.configured && <p className="mt-4 text-[0.8125rem] text-graphite">Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM_EMAIL in server/.env, then restart the server.</p>}
              {superAdmin && smtp.configured && (
                <form onSubmit={sendTest} className="mt-5 border-t border-hairline pt-4">
                  <Field label="Send a test email to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                  <FormError message={testState.error} />
                  <button type="submit" className="btn btn-secondary btn-sm mt-2" disabled={testState.busy}>
                    {testState.busy ? 'Sending…' : 'Send test email'}
                  </button>
                </form>
              )}
            </>
          )}
        </Card>
        <div className="xl:col-span-2">
          {superAdmin ? (
            <SettingsForm
              embedded
              group="email"
              title="Notification settings"
              sections={[
                {
                  title: 'Which emails are sent',
                  fields: [
                    { key: 'email_notify_customer_orders', label: 'Order confirmation and status updates to customers', type: 'toggle' },
                    { key: 'email_notify_admin_orders', label: 'New-order alerts to the admin inbox', type: 'toggle' },
                    { key: 'email_notify_enquiries', label: 'New-enquiry alerts to the admin inbox', type: 'toggle' },
                    { key: 'email_contact_ack', label: 'Enquiry receipts to customers', type: 'toggle' },
                    { key: 'email_notify_newsletter', label: 'New newsletter subscriber alerts', type: 'toggle' },
                    { key: 'admin_notification_email', label: 'Admin inbox override', hint: 'Optional. Defaults to ADMIN_EMAIL from server/.env.' },
                  ],
                },
              ]}
            />
          ) : (
            <Card title="Notification settings">
              <p className="text-sm text-graphite">Only a super admin can change which emails are sent.</p>
            </Card>
          )}
        </div>
      </div>

      <Card title="Email log" padded={false} className="mt-6">
        <Toolbar>
          <Select
            label="Delivery status"
            value={params.get('status') || ''}
            onChange={(v) => setParams(v ? { status: v } : {}, { replace: true })}
            options={[{ value: '', label: 'All emails' }, { value: 'failed', label: 'Failed' }, { value: 'skipped', label: 'Skipped' }, { value: 'sent', label: 'Sent' }, { value: 'pending', label: 'Pending' }]}
          />
          {status.data?.counts?.failed > 0 && <span className="text-sm text-danger">{status.data.counts.failed} failed</span>}
        </Toolbar>
        {logs.error && <ErrorState error={logs.error} onRetry={logs.reload} />}
        <Table
          loading={logs.loading}
          rows={logs.data?.items}
          empty="No emails yet."
          columns={[
            { key: 'created_at', label: 'Created', render: (l) => formatDateTime(l.created_at) },
            { key: 'type', label: 'Email', render: (l) => <span><span className="block">{TYPE_LABELS[l.type] || l.type}</span><span className="text-[0.75rem] text-graphite">{l.subject}</span></span> },
            { key: 'recipient', label: 'To', render: (l) => <span className="break-all">{l.recipient}</span> },
            { key: 'related', label: 'For', render: (l) => (l.order_number ? <Link to={`/admin/orders/${l.related_id}`} className="hover:underline">{l.order_number}</Link> : l.enquiry_reference || '—') },
            { key: 'status', label: 'Status', render: (l) => <span><StatusBadge status={l.status} />{l.error_message && <span className="mt-1 block max-w-xs text-[0.75rem] text-danger">{l.error_message}</span>}</span> },
            { key: 'attempts', label: 'Tries' },
            {
              key: 'retry',
              label: '',
              render: (l) =>
                l.status !== 'sent' && ['order_customer', 'order_admin', 'order_status', 'enquiry_admin', 'enquiry_ack'].includes(l.type) ? (
                  <button type="button" className="inline-flex items-center gap-1 text-sm underline" onClick={() => retry(l.id)}>
                    <RotateCw className="size-3.5" aria-hidden /> Retry
                  </button>
                ) : null,
            },
          ]}
        />
        <Pagination meta={logs.data?.meta} onPage={(p) => setParams({ ...Object.fromEntries(params), page: String(p) }, { replace: true })} />
      </Card>
    </>
  );
}

const ROLE_HELP = {
  super_admin: 'Everything, including admin users and email settings.',
  admin: 'Catalogue, orders, content and store settings.',
  support: 'Orders, customers, enquiries and reviews.',
};

function UserEditor({ initial, onSaved, onClose }) {
  const isNew = !initial.id;
  const [form, setForm] = useState({ name: initial.name || '', email: initial.email || '', role: initial.role || 'support', is_active: initial.is_active ?? true, password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try {
      if (isNew) await post('/admin/users', form);
      else await put(`/admin/users/${initial.id}`, { name: form.name, role: form.role, is_active: form.is_active, password: form.password });
      onSaved();
    } catch (ex) {
      setErrors(ex.fields || {});
      setError(ex.message);
    }
  };
  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
      <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} disabled={!isNew} />
      <Field label="Role" as="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} hint={ROLE_HELP[form.role]}>
        <option value="support">Support</option>
        <option value="admin">Admin</option>
        <option value="super_admin">Super admin</option>
      </Field>
      <Field label={isNew ? 'Password' : 'New password'} optional={!isNew} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} hint="At least 10 characters, with letters and numbers. Share it securely." />
      {!isNew && <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Account active" />}
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm">
          {isNew ? 'Create admin' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export function Users() {
  const { data, error, loading, reload } = useApi('/admin/users');
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  return (
    <>
      <PageHeader
        title="Admin users"
        description="People who can sign in to this admin. There must always be at least one active super admin."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
            <Plus className="size-4" aria-hidden /> New admin
          </button>
        }
      />
      <Card padded={false}>
        <Table
          rows={data.items}
          columns={[
            { key: 'name', label: 'Name', render: (a) => <span><span className="block font-medium">{a.name}</span><span className="text-[0.75rem] text-graphite">{a.email}</span></span> },
            { key: 'role', label: 'Role', render: (a) => titleCase(a.role) },
            { key: 'is_active', label: 'Status', render: (a) => <StatusBadge status={a.is_active ? 'active' : 'inactive'} label={a.is_active ? 'Active' : 'Disabled'} /> },
            { key: 'last_login_at', label: 'Last sign-in', render: (a) => (a.last_login_at ? formatDateTime(a.last_login_at) : 'Never') },
            {
              key: 'edit',
              label: '',
              className: 'text-right',
              render: (a) => (
                <button type="button" className="rounded p-2 hover:bg-stone" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                  <Pencil className="size-4" />
                </button>
              ),
            },
          ]}
        />
      </Card>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.name}` : 'New admin'}>
        {editing && (
          <UserEditor
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast.success('Admin saved.');
              reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}

const ENTITIES = ['order', 'product', 'category', 'settings', 'banner', 'faq', 'review', 'enquiry', 'customer', 'admin', 'email'];

function describe(details) {
  if (!details) return '';
  if (details.changed) return Object.entries(details.changed).map(([k, v]) => `${k}: “${v.from}” → “${v.to}”`).join('; ');
  if (details.from !== undefined && details.to !== undefined) return `${details.from} → ${details.to}${details.note ? ` (${details.note})` : ''}`;
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

export function ActivityLogs() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApi(`/admin/activity-logs${qs({ entity: params.get('entity'), page: params.get('page') })}`);
  return (
    <>
      <PageHeader title="Activity log" description="Who changed what, and when. Entries cannot be edited or deleted from the admin." />
      {error && <ErrorState error={error} onRetry={reload} />}
      <Card padded={false}>
        <Toolbar>
          <Select label="Area" value={params.get('entity') || ''} onChange={(v) => setParams(v ? { entity: v } : {}, { replace: true })} options={[{ value: '', label: 'All areas' }, ...ENTITIES.map((e) => ({ value: e, label: titleCase(e) }))]} />
        </Toolbar>
        <Table
          loading={loading}
          rows={data?.items}
          empty="No activity yet."
          columns={[
            { key: 'created_at', label: 'When', render: (l) => <span className="whitespace-nowrap">{formatDateTime(l.created_at)}</span> },
            { key: 'admin', label: 'Who', render: (l) => l.admin_name || 'Removed admin' },
            { key: 'action', label: 'Action', render: (l) => <code className="rounded bg-stone px-1.5 py-0.5 text-[0.75rem]">{l.action}</code> },
            {
              key: 'entity',
              label: 'Item',
              render: (l) =>
                l.entity_type === 'order' && l.entity_id ? (
                  <Link to={`/admin/orders/${l.entity_id}`} className="hover:underline">Order #{l.entity_id}</Link>
                ) : l.entity_type === 'product' && l.entity_id ? (
                  <Link to={`/admin/products/${l.entity_id}/edit`} className="hover:underline">Product #{l.entity_id}</Link>
                ) : (
                  [titleCase(l.entity_type), l.entity_id].filter(Boolean).join(' ')
                ),
            },
            { key: 'details', label: 'Details', render: (l) => <span className="line-clamp-2 max-w-md text-[0.8125rem] text-graphite" title={describe(l.details)}>{describe(l.details)}</span> },
            { key: 'ip_address', label: 'IP', render: (l) => <span className="text-[0.75rem] text-graphite">{l.ip_address}</span> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(p) => setParams({ ...Object.fromEntries(params), page: String(p) }, { replace: true })} />
      </Card>
    </>
  );
}
