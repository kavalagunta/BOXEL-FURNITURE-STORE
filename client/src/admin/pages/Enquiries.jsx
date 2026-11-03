import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Trash2 } from 'lucide-react';
import { PageHeader, Card, Table, Pagination, SearchInput, Select, StatusBadge, Toolbar } from '../components/ui.jsx';
import { Drawer } from '../../components/ui/Overlay.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAdmin, can } from '../AdminAuth.jsx';
import { del, get, patch, post, qs } from '../../services/api.js';
import { formatDateTime, formatPhone } from '../../utils/format.js';

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

function EnquiryPanel({ id, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState('');
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    get(`/admin/enquiries/${id}`)
      .then((d) => {
        setData(d);
        setNotes(d.enquiry.internal_notes || '');
        onChanged();
      })
      .catch(setError);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="p-5"><ErrorState error={error} /></div>;
  if (!data) return <PageLoader />;
  const e = data.enquiry;

  const update = async (body, msg) => {
    setBusy(true);
    try {
      await patch(`/admin/enquiries/${id}`, body);
      toast.success(msg);
      await load();
    } catch (ex) {
      toast.error(ex.message);
    }
    setBusy(false);
  };

  const sendReply = async () => {
    setReplyError('');
    setBusy(true);
    try {
      await post(`/admin/enquiries/${id}/reply`, { message: reply });
      setReply('');
      toast.success(`Reply sent to ${e.email}.`);
      await load();
    } catch (ex) {
      setReplyError(ex.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6 p-5">
      <div>
        <p className="text-[0.8125rem] text-graphite">
          {e.reference} · {formatDateTime(e.created_at)}
        </p>
        <h3 className="mt-1 text-lg font-medium">{e.topic}</h3>
      </div>
      <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
        <dt className="text-graphite">Name</dt>
        <dd>{e.name}</dd>
        <dt className="text-graphite">Email</dt>
        <dd>
          <a href={`mailto:${e.email}`} className="hover:underline">
            {e.email}
          </a>
        </dd>
        <dt className="text-graphite">Phone</dt>
        <dd>{e.phone ? <a href={`tel:${e.phone}`} className="hover:underline">{formatPhone(e.phone)}</a> : '—'}</dd>
      </dl>
      <div className="whitespace-pre-line rounded bg-stone p-4 text-sm">{e.message}</div>

      <Field label="Status" as="select" value={e.status} onChange={(ev) => update({ status: ev.target.value }, 'Status updated.')} disabled={busy}>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Field>

      <div>
        <Field label="Internal notes" as="textarea" rows={4} value={notes} onChange={(ev) => setNotes(ev.target.value)} hint="Only staff can see these notes." />
        <button type="button" className="btn btn-secondary btn-sm mt-2" disabled={busy || notes === (e.internal_notes || '')} onClick={() => update({ internal_notes: notes }, 'Notes saved.')}>
          Save notes
        </button>
      </div>

      <div className="border-t border-hairline pt-5">
        {data.canReply ? (
          <>
            <Field label={`Reply to ${e.email}`} as="textarea" rows={5} value={reply} onChange={(ev) => setReply(ev.target.value)} />
            <FormError message={replyError} />
            <button type="button" className="btn btn-primary btn-sm mt-2" disabled={busy || reply.trim().length < 5} onClick={sendReply}>
              Send reply
            </button>
          </>
        ) : (
          <p className="text-sm text-graphite">
            Replying from here needs SMTP to be configured. Meanwhile, reply from your email: <a href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: ${e.topic} (${e.reference})`)}`} className="link text-ink">open email</a>.
          </p>
        )}
      </div>

      {data.emails.length > 0 && (
        <div className="border-t border-hairline pt-5">
          <p className="text-sm font-medium">Emails</p>
          <ul className="mt-2 space-y-1.5 text-[0.8125rem]">
            {data.emails.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>
                  {m.type.replace('enquiry_', '').replace('_', ' ')} → {m.recipient}
                </span>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Newsletter() {
  const { admin } = useAdmin();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useApi(`/admin/newsletter?page=${page}`);
  const exportCsv = () => {
    const rows = [['email', 'status', 'subscribed_at'], ...(data?.items || []).map((s) => [s.email, s.status, new Date(s.created_at).toISOString()])];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'boxel-newsletter.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card padded={false} title="Newsletter subscribers" actions={data?.items.length ? <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}>Export this page (CSV)</button> : null}>
      <Table
        loading={loading}
        rows={data?.items}
        empty="No subscribers yet."
        columns={[
          { key: 'email', label: 'Email' },
          { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status === 'subscribed' ? 'active' : 'inactive'} label={s.status} /> },
          { key: 'created_at', label: 'Subscribed', render: (s) => formatDateTime(s.created_at) },
          {
            key: 'actions',
            label: '',
            className: 'text-right',
            render: (s) =>
              can(admin, 'products') && (
                <button
                  type="button"
                  className="rounded p-1.5 text-danger hover:bg-danger/10"
                  aria-label={`Remove ${s.email}`}
                  onClick={async () => {
                    if (!window.confirm(`Remove ${s.email}?`)) return;
                    await del(`/admin/newsletter/${s.id}`);
                    toast.success('Subscriber removed.');
                    reload();
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              ),
          },
        ]}
      />
      <Pagination meta={data?.meta} onPage={setPage} />
    </Card>
  );
}

export default function Enquiries() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'enquiries';
  const openId = params.get('open');
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page' && k !== 'open') n.delete('page');
    setParams(n, { replace: true });
  };
  const { data, loading, error, reload } = useApi(tab === 'enquiries' ? `/admin/enquiries${qs({ q: params.get('q'), status: params.get('status'), page: params.get('page') })}` : null);

  return (
    <>
      <PageHeader title="Enquiries" description="Messages from the contact forms, and newsletter sign-ups." />
      <div className="mb-4 flex gap-2" role="tablist">
        {[
          ['enquiries', 'Enquiries'],
          ['newsletter', 'Newsletter'],
        ].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setParams(k === 'enquiries' ? {} : { tab: k })} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-ink text-white' : 'border border-hairline bg-white'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'newsletter' ? (
        <Newsletter />
      ) : (
        <>
          {error && <ErrorState error={error} onRetry={reload} />}
          <Card padded={false}>
            <Toolbar>
              <SearchInput value={params.get('q') || ''} onChange={(v) => set('q', v)} placeholder="Reference, name, email or message" className="sm:w-80" />
              <Select label="Status" value={params.get('status') || ''} onChange={(v) => set('status', v)} options={[{ value: '', label: 'Any status' }, ...STATUSES]} />
            </Toolbar>
            <Table
              loading={loading}
              rows={data?.items}
              empty="No enquiries match."
              onRowClick={(e) => set('open', String(e.id))}
              columns={[
                { key: 'reference', label: 'Reference', render: (e) => <span className={e.status === 'new' ? 'font-semibold' : ''}>{e.reference}</span> },
                { key: 'name', label: 'From', render: (e) => <span><span className="block">{e.name}</span><span className="text-[0.75rem] text-graphite">{e.email}</span></span> },
                { key: 'topic', label: 'Topic', render: (e) => <span><span className="block">{e.topic}</span><span className="line-clamp-1 max-w-xs text-[0.75rem] text-graphite">{e.excerpt}</span></span> },
                { key: 'created_at', label: 'Received', render: (e) => formatDateTime(e.created_at) },
                { key: 'status', label: 'Status', render: (e) => <StatusBadge status={e.status} /> },
              ]}
            />
            <Pagination meta={data?.meta} onPage={(p) => set('page', String(p))} />
          </Card>
        </>
      )}
      <Drawer open={Boolean(openId)} onClose={() => set('open', '')} title="Enquiry" width="max-w-lg">
        {openId && <EnquiryPanel id={openId} onChanged={reload} />}
      </Drawer>
    </>
  );
}
