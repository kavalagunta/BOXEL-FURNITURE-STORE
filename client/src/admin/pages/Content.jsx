import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader, Card, StatusBadge, ConfirmDialog, Toggle, Badge } from '../components/ui.jsx';
import { SingleImageField } from '../components/ImageUploader.jsx';
import { VideoField } from '../components/ImageUploader.jsx';
import { Modal } from '../../components/ui/Overlay.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import SocialIcon, { SOCIAL_LABELS } from '../../components/ui/SocialIcon.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSite } from '../../context/SiteContext.jsx';
import { del, post, put } from '../../services/api.js';
import { formatDateTime } from '../../utils/format.js';

/* ------------------------------ FAQs ------------------------------ */
function FaqEditor({ initial, products, onSaved, onClose }) {
  const [form, setForm] = useState(() => ({ question: '', answer: '', sort_order: 0, is_active: true, ...initial, product_id: initial?.product_id || '' }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try {
      if (initial?.id) await put(`/admin/faqs/${initial.id}`, form);
      else await post('/admin/faqs', form);
      onSaved();
    } catch (ex) {
      setErrors(ex.fields || {});
      setError(ex.message);
    }
  };
  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <Field label="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} error={errors.question} maxLength={300} />
      <Field label="Answer" as="textarea" rows={6} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} error={errors.answer} hint="Plain text. Only state what the business has confirmed." />
      <Field label="Show on" as="select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
        <option value="">Homepage (general FAQ)</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            Product page: {p.name}
          </option>
        ))}
      </Field>
      <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Published" />
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm">
          Save FAQ
        </button>
      </div>
    </form>
  );
}

export function Faqs() {
  const { data, error, loading, reload } = useApi('/admin/faqs');
  const products = useApi('/admin/products?status=all&limit=100');
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  const general = data.items.filter((f) => !f.product_id);
  const specific = data.items.filter((f) => f.product_id);

  const move = async (list, i, d) => {
    const ids = list.map((f) => f.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await put('/admin/faqs/reorder', { ids });
    reload();
  };

  const renderList = (list) => (
    <ul className="divide-y divide-hairline">
      {list.map((f, i) => (
        <li key={f.id} className="flex items-start gap-3 px-4 py-3">
          <div className="flex flex-col">
            <button type="button" className="rounded p-1 hover:bg-stone disabled:opacity-30" disabled={i === 0} onClick={() => move(list, i, -1)} aria-label="Move up">
              <ArrowUp className="size-4" />
            </button>
            <button type="button" className="rounded p-1 hover:bg-stone disabled:opacity-30" disabled={i === list.length - 1} onClick={() => move(list, i, 1)} aria-label="Move down">
              <ArrowDown className="size-4" />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{f.question}</p>
            <p className="mt-1 line-clamp-2 text-sm text-graphite">{f.answer}</p>
            {f.product_name && <p className="mt-1 text-[0.75rem] text-graphite">On {f.product_name}</p>}
          </div>
          {!f.is_active && <Badge>Hidden</Badge>}
          <button type="button" className="rounded p-2 hover:bg-stone" onClick={() => setEditing(f)} aria-label={`Edit ${f.question}`}>
            <Pencil className="size-4" />
          </button>
          <button type="button" className="rounded p-2 text-danger hover:bg-danger/10" onClick={() => setDeleting(f)} aria-label={`Delete ${f.question}`}>
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader
        title="FAQs"
        description="General FAQs show on the homepage. Product FAQs show on that product's page (otherwise the general ones are used)."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
            <Plus className="size-4" aria-hidden /> New FAQ
          </button>
        }
      />
      <div className="space-y-6">
        <Card title={`Homepage (${general.length})`} padded={false}>
          {general.length ? renderList(general) : <p className="p-5 text-sm text-graphite">No general FAQs.</p>}
        </Card>
        {specific.length > 0 && (
          <Card title={`Product pages (${specific.length})`} padded={false}>
            {renderList(specific)}
          </Card>
        )}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit FAQ' : 'New FAQ'} size="max-w-2xl">
        {editing && (
          <FaqEditor
            initial={editing}
            products={products.data?.items || []}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast.success('FAQ saved.');
              reload();
            }}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        danger
        confirmLabel="Delete FAQ"
        title="Delete this FAQ?"
        body={deleting?.question}
        onConfirm={async () => {
          await del(`/admin/faqs/${deleting.id}`);
          setDeleting(null);
          toast.success('FAQ deleted.');
          reload();
        }}
      />
    </>
  );
}

/* ----------------------------- Banners ----------------------------- */
const BANNER_BLANK = {
  placement: 'hero', headline: '', subheadline: '', cta_text: '', cta_url: '', secondary_cta_text: '', secondary_cta_url: '',
  desktop_image_url: '', desktop_image_public_id: '', mobile_image_url: '', mobile_image_public_id: '', video_url: '', video_public_id: '', image_alt: '', is_active: true, sort_order: 0, starts_at: '', ends_at: '',
};
const toLocalInput = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function BannerEditor({ initial, onSaved, onClose }) {
  const [form, setForm] = useState(() => {
    const merged = { ...BANNER_BLANK, ...Object.fromEntries(Object.entries(initial || {}).map(([k, v]) => [k, v ?? ''])) };
    return { ...merged, starts_at: toLocalInput(initial?.starts_at), ends_at: toLocalInput(initial?.ends_at) };
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const save = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
    try {
      if (initial?.id) await put(`/admin/banners/${initial.id}`, payload);
      else await post('/admin/banners', payload);
      onSaved();
    } catch (ex) {
      setErrors(ex.fields || {});
      setError(ex.message);
    }
  };
  return (
    <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Placement" as="select" value={form.placement} onChange={set('placement')} className="sm:col-span-2" hint="The first active hero banner is the homepage hero.">
        <option value="hero">Homepage hero</option>
        <option value="promo">Promotional banner</option>
      </Field>
      <Field label="Headline" value={form.headline} onChange={set('headline')} error={errors.headline} className="sm:col-span-2" maxLength={200} hint="End sentences with a full stop — each sentence animates in on its own line." />
      <Field label="Supporting text" as="textarea" rows={2} value={form.subheadline} onChange={set('subheadline')} error={errors.subheadline} className="sm:col-span-2" maxLength={400} />
      <Field label="Main button text" value={form.cta_text} onChange={set('cta_text')} error={errors.cta_text} />
      <Field label="Main button link" value={form.cta_url} onChange={set('cta_url')} error={errors.cta_url} placeholder="/products/parcel-drop-box" />
      <Field label="Second link text" optional value={form.secondary_cta_text} onChange={set('secondary_cta_text')} />
      <Field label="Second link" optional value={form.secondary_cta_url} onChange={set('secondary_cta_url')} error={errors.secondary_cta_url} placeholder="/about" />
      <SingleImageField label="Desktop image" value={form.desktop_image_url} onChange={set('desktop_image_url')} publicId={form.desktop_image_public_id} onPublicIdChange={set('desktop_image_public_id')} onBusyChange={setUploading} folder="banners" error={errors.desktop_image_url} hint="Use the real product photo, ideally on a plain studio background." />
      <SingleImageField label="Mobile image" value={form.mobile_image_url} onChange={set('mobile_image_url')} publicId={form.mobile_image_public_id} onPublicIdChange={set('mobile_image_public_id')} onBusyChange={setUploading} folder="banners" hint="Optional. Falls back to the desktop image." />
      {form.placement === 'hero' && <VideoField label="Hero video" value={form.video_url} onChange={set('video_url')} publicId={form.video_public_id} onPublicIdChange={set('video_public_id')} onBusyChange={setUploading} />}
      <Field label="Image description (alt text)" value={form.image_alt} onChange={set('image_alt')} error={errors.image_alt} className="sm:col-span-2" maxLength={255} />
      <Field label="Show from" optional type="datetime-local" value={form.starts_at} onChange={set('starts_at')} error={errors.starts_at} />
      <Field label="Show until" optional type="datetime-local" value={form.ends_at} onChange={set('ends_at')} error={errors.ends_at} />
      <Field label="Display order" type="number" min="0" value={form.sort_order} onChange={set('sort_order')} />
      <div className="sm:pt-6">
        <Toggle checked={form.is_active} onChange={set('is_active')} label="Active" />
      </div>
      <div className="sm:col-span-2">
        <FormError message={error} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
          Save banner
        </button>
      </div>
    </form>
  );
}

export function Banners() {
  const { data, error, loading, reload } = useApi('/admin/banners');
  const { reload: reloadSite } = useSite();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  const now = Date.now();
  const live = (b) => b.is_active && (!b.starts_at || new Date(b.starts_at) <= now) && (!b.ends_at || new Date(b.ends_at) > now);
  const heroLive = data.items.find((b) => b.placement === 'hero' && live(b));

  return (
    <>
      <PageHeader
        title="Homepage & banners"
        description="Change the homepage hero headline, buttons and image here — no code changes needed. Other homepage text is in Store settings."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
            <Plus className="size-4" aria-hidden /> New banner
          </button>
        }
      />
      {!heroLive && <p className="mb-4 rounded-md border border-[#f3d3a8] bg-[#fdf6ec] px-4 py-3 text-sm">No hero banner is live, so the homepage shows the default hero text.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.items.map((b) => (
          <Card key={b.id} padded={false}>
            <div className="flex gap-4 p-4">
              <div className="size-24 shrink-0 overflow-hidden rounded-sm bg-stone">{b.desktop_image_url && <img src={b.desktop_image_url} alt="" className="size-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="dark">{b.placement === 'hero' ? 'Hero' : 'Promo'}</Badge>
                  {heroLive?.id === b.id ? <Badge tone="green">Live on homepage</Badge> : <StatusBadge status={live(b) ? 'active' : 'inactive'} label={live(b) ? 'Active' : b.is_active ? 'Scheduled / expired' : 'Off'} />}
                </div>
                <p className="mt-2 font-medium">{b.headline}</p>
                {b.subheadline && <p className="line-clamp-2 text-sm text-graphite">{b.subheadline}</p>}
                {(b.starts_at || b.ends_at) && (
                  <p className="mt-1 text-[0.75rem] text-graphite">
                    {b.starts_at ? `From ${formatDateTime(b.starts_at)}` : ''} {b.ends_at ? `until ${formatDateTime(b.ends_at)}` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" className="rounded p-2 hover:bg-stone" onClick={() => setEditing(b)} aria-label="Edit banner">
                  <Pencil className="size-4" />
                </button>
                <button type="button" className="rounded p-2 text-danger hover:bg-danger/10" onClick={() => setDeleting(b)} aria-label="Delete banner">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit banner' : 'New banner'} size="max-w-3xl">
        {editing && (
          <BannerEditor
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast.success('Banner saved.');
              reload();
              reloadSite();
            }}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        danger
        confirmLabel="Delete banner"
        title="Delete this banner?"
        body={deleting?.headline}
        onConfirm={async () => {
          await del(`/admin/banners/${deleting.id}`);
          setDeleting(null);
          toast.success('Banner deleted.');
          reload();
          reloadSite();
        }}
      />
    </>
  );
}

/* --------------------------- Social links --------------------------- */
export function SocialLinks() {
  const { data, error, loading, reload } = useApi('/admin/social-links');
  const { reload: reloadSite } = useSite();
  const toast = useToast();
  const [links, setLinks] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (data) setLinks(data.items);
  }, [data]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !links) return <PageLoader />;

  const save = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError('');
    try {
      await put('/admin/social-links', { links });
      toast.success('Social links saved.');
      reloadSite();
    } catch (ex) {
      setErrors(ex.fields || {});
      setFormError(ex.message);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <PageHeader title="Social links" description="Only enter real boxel profiles. Links that are empty or switched off are hidden from the site." actions={<button type="submit" className="btn btn-primary btn-sm">Save links</button>} />
      <Card>
        <ul className="divide-y divide-hairline">
          {links.map((l, i) => (
            <li key={l.platform} className="grid gap-3 py-4 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
              <span className="flex items-center gap-2 font-medium">
                <SocialIcon platform={l.platform} /> {SOCIAL_LABELS[l.platform]}
              </span>
              <Field label={`${SOCIAL_LABELS[l.platform]} profile URL`} value={l.url} placeholder="https://" onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} error={errors[`links.${i}.url`]} />
              <Toggle checked={l.is_active} onChange={(v) => setLinks(links.map((x, j) => (j === i ? { ...x, is_active: v } : x)))} label="Show" />
            </li>
          ))}
        </ul>
        <FormError message={formError} />
      </Card>
    </form>
  );
}
