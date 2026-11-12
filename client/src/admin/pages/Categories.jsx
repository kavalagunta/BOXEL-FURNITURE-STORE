import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader, Card, StatusBadge, ConfirmDialog } from '../components/ui.jsx';
import { SingleImageField } from '../components/ImageUploader.jsx';
import { Modal } from '../../components/ui/Overlay.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { del, post, put } from '../../services/api.js';

const BLANK = { name: '', slug: '', description: '', image_url: '', cloudinary_public_id: '', sort_order: 0, status: 'active', seo_title: '', seo_description: '' };

function CategoryEditor({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...BLANK, ...Object.fromEntries(Object.entries(initial || {}).map(([k, v]) => [k, v ?? ''])) }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((current) => ({ ...current, [k]: value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, image_url: form.image_url || null, cloudinary_public_id: form.cloudinary_public_id || null };
      if (initial?.id) await put(`/admin/categories/${initial.id}`, payload);
      else await post('/admin/categories', payload);
      onSaved();
    } catch (ex) {
      setErrors(ex.fields || {});
      setError(ex.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <Field label="Name" value={form.name} onChange={set('name')} error={errors.name} />
      <Field label="Slug" value={form.slug} onChange={set('slug')} error={errors.slug} hint="Leave empty to generate from the name." />
      <Field label="Description" as="textarea" rows={3} value={form.description} onChange={set('description')} error={errors.description} />
      <Field label="Status" as="select" value={form.status} onChange={set('status')}>
        <option value="active">Active — products can be bought</option>
        <option value="coming_soon">Coming soon — shown, nothing can be bought</option>
        <option value="inactive">Inactive — hidden</option>
      </Field>
      <SingleImageField label="Image" value={form.image_url} onChange={set('image_url')} publicId={form.cloudinary_public_id} onPublicIdChange={set('cloudinary_public_id')} onBusyChange={setBusy} folder="categories" error={errors.image_url} />
      <Field label="SEO title" optional value={form.seo_title} onChange={set('seo_title')} maxLength={160} />
      <Field label="SEO description" optional as="textarea" rows={2} value={form.seo_description} onChange={set('seo_description')} maxLength={320} />
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save category'}
        </button>
      </div>
    </form>
  );
}

export default function Categories() {
  const { data, error, loading, reload } = useApi('/admin/categories');
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  const items = data.items;
  const reassignmentCategories = items.filter((c) => Number(c.id) !== Number(deleting?.id) && c.status === 'active');

  const move = async (i, d) => {
    const ids = items.map((c) => c.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await put('/admin/categories/reorder', { ids });
    reload();
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await del(`/admin/categories/${deleting.id}`, reassignTo ? { reassignTo: Number(reassignTo) } : undefined);
      toast.success('Category deleted.');
      setDeleting(null);
      reload();
    } catch (ex) {
      setDeleteError(ex.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="Order here is the order on the homepage and the catalogue filters."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
            <Plus className="size-4" aria-hidden /> New category
          </button>
        }
      />
      <Card padded={false}>
        <ul className="divide-y divide-hairline">
          {items.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <div className="flex flex-col">
                <button type="button" className="rounded p-1 hover:bg-stone disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`}>
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" className="rounded p-1 hover:bg-stone disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`}>
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <div className="size-12 shrink-0 overflow-hidden rounded-sm bg-stone">{c.image_url && <img src={c.image_url} alt="" className="size-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-[0.8125rem] text-graphite">
                  /{c.slug} · {c.product_count} product{c.product_count === 1 ? '' : 's'}
                </p>
              </div>
              <StatusBadge status={c.status} />
              <div className="flex gap-1">
                <button type="button" className="rounded p-2 hover:bg-stone" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  className="rounded p-2 text-danger hover:bg-danger/10"
                  onClick={() => {
                    setDeleting(c);
                    setReassignTo('');
                    setDeleteError('');
                  }}
                  aria-label={`Delete ${c.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.name}` : 'New category'}>
        {editing && (
          <CategoryEditor
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast.success('Category saved.');
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={confirmDelete} title={`Delete ${deleting?.name}?`} confirmLabel="Delete category" danger busy={deleteBusy} disabled={deleting?.product_count > 0 && (!reassignTo || reassignmentCategories.length === 0)}>
        {deleting?.product_count > 0 ? (
          <div className="space-y-3">
            <p className="text-graphite">
              This category has {deleting.product_count} product{deleting.product_count === 1 ? '' : 's'}. Choose a category to move them to before deleting.
            </p>
            <Field label={`Move products to (${reassignmentCategories.length} available categories)`} as="select" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">Choose…</option>
              {reassignmentCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.product_count} product{c.product_count === 1 ? '' : 's'}
                </option>
              ))}
            </Field>
            {reassignmentCategories.length === 0 && <p className="text-sm text-danger">Create or activate another category before deleting this one; its products need an available destination.</p>}
          </div>
        ) : (
          <p className="text-graphite">This category has no products. It will be removed permanently.</p>
        )}
        <div className="mt-3">
          <FormError message={deleteError} />
        </div>
      </ConfirmDialog>
    </>
  );
}
