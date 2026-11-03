import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, Eye, Plus, Trash2 } from 'lucide-react';
import { PageHeader, Card, Table, Pagination, SearchInput, Select, StatusBadge, Toggle, ConfirmDialog, Toolbar, titleCase } from '../components/ui.jsx';
import { ImageListEditor, SingleImageField } from '../components/ImageUploader.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { PageLoader, ErrorState } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { del, get, post, put, qs } from '../../services/api.js';
import { formatINR, formatDate } from '../../utils/format.js';

export function ProductsList() {
  const [params, setParams] = useSearchParams();
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };
  const { data, loading, error, reload } = useApi(`/admin/products${qs({ q: params.get('q'), status: params.get('status'), page: params.get('page') })}`);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Products"
        description="Products with a price of ₹0 are visible but cannot be ordered until you set a price."
        actions={
          <Link to="/admin/products/new" className="btn btn-primary btn-sm">
            <Plus className="size-4" aria-hidden /> New product
          </Link>
        }
      />
      {error && <ErrorState error={error} onRetry={reload} />}
      <Card padded={false}>
        <Toolbar>
          <SearchInput value={params.get('q') || ''} onChange={(v) => set('q', v)} placeholder="Search name or SKU" className="sm:w-72" />
          <Select
            label="Status"
            value={params.get('status') || ''}
            onChange={(v) => set('status', v)}
            options={[
              { value: '', label: 'All except archived' },
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' },
              { value: 'coming_soon', label: 'Coming soon' },
              { value: 'archived', label: 'Archived' },
              { value: 'all', label: 'Everything' },
            ]}
          />
        </Toolbar>
        <Table
          loading={loading}
          rows={data?.items}
          empty="No products match."
          onRowClick={(p) => navigate(`/admin/products/${p.id}/edit`)}
          columns={[
            {
              key: 'name',
              label: 'Product',
              render: (p) => (
                <span className="flex items-center gap-3">
                  <span className="size-10 shrink-0 overflow-hidden rounded-sm bg-stone">{p.image_url && <img src={p.image_url} alt="" className="size-full object-cover" />}</span>
                  <span>
                    <Link to={`/admin/products/${p.id}/edit`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {p.name}
                    </Link>
                    <span className="block text-[0.75rem] text-graphite">
                      {p.sku} · {p.category_name}
                    </span>
                  </span>
                </span>
              ),
            },
            { key: 'status', label: 'Status', render: (p) => <span className="flex flex-wrap gap-1"><StatusBadge status={p.status} />{p.is_featured ? <StatusBadge status="featured" label="Featured" /> : null}</span> },
            {
              key: 'price',
              label: 'Price',
              render: (p) =>
                Number(p.price) > 0 ? (
                  <span>
                    {formatINR(p.sale_price && p.sale_price < p.price ? p.sale_price : p.price)}
                    {p.sale_price && p.sale_price < p.price ? <span className="ml-1 text-graphite line-through">{formatINR(p.price)}</span> : null}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[#8a4b00]">
                    <AlertTriangle className="size-3.5" aria-hidden /> Not set
                  </span>
                ),
            },
            { key: 'stock', label: 'Stock', render: (p) => (p.track_stock ? `${p.stock} across ${p.variant_count} variant${p.variant_count === 1 ? '' : 's'}` : 'Made to order') },
            { key: 'updated_at', label: 'Updated', render: (p) => formatDate(p.updated_at) },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(p) => set('page', String(p))} />
      </Card>
    </>
  );
}

const BLANK = {
  name: '', slug: '', sku: '', category_id: '', vendor_id: '', short_description: '', description: '', features: [], specifications: [],
  price: '', sale_price: '', status: 'draft', is_featured: false, sort_order: 0, track_stock: false, low_stock_threshold: 3,
  shipping_info: '', warranty_info: '', seo_title: '', seo_description: '', og_image_url: '',
  variants: [{ name: 'White', color_hex: '#F2F2EF', sku: '', price_adjustment: 0, stock_quantity: 0, is_active: true }],
  images: [],
};

export function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const categories = useApi('/admin/categories');
  const vendors = useApi('/admin/vendors');
  const [form, setForm] = useState(isNew ? BLANK : null);
  const [orderCount, setOrderCount] = useState(0);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (isNew) return;
    get(`/admin/products/${id}`)
      .then(({ product: p }) => {
        setOrderCount(p.order_count);
        setForm({
          ...BLANK,
          ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === null ? '' : v])),
          sale_price: p.sale_price ?? '',
          variants: p.variants.map((v) => ({ ...v, color_hex: v.color_hex || '', sku: v.sku || '' })),
          images: p.images.map((i) => ({ url: i.url, public_id: i.public_id || '', alt: i.alt || '' })),
        });
      })
      .catch(setLoadError);
  }, [id, isNew]);

  if (loadError) return <ErrorState error={loadError} />;
  if (!form) return <PageLoader />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const err = (k) => errors[k];

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError('');
    const payload = {
      ...form,
      category_id: Number(form.category_id) || 0,
      vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
      price: form.price === '' ? 0 : Number(form.price),
      sale_price: form.sale_price === '' ? '' : Number(form.sale_price),
      features: form.features.map((f) => f.trim()).filter(Boolean),
      specifications: form.specifications.filter((s) => s.label.trim() && s.value.trim()),
      variants: form.variants.map((v) => ({ ...v, color_hex: v.color_hex || null, price_adjustment: Number(v.price_adjustment) || 0, stock_quantity: Number(v.stock_quantity) || 0 })),
      og_image_url: form.og_image_url || null,
    };
    try {
      if (isNew) {
        const res = await post('/admin/products', payload);
        toast.success('Product created.');
        navigate(`/admin/products/${res.id}/edit`, { replace: true });
      } else {
        await put(`/admin/products/${id}`, payload);
        toast.success('Product saved.');
      }
    } catch (ex) {
      setErrors(ex.fields || {});
      setFormError(ex.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    await post(`/admin/products/${id}/archive`);
    toast.success('Product archived.');
    navigate('/admin/products');
  };
  const remove = async () => {
    try {
      await del(`/admin/products/${id}`);
      toast.success('Product deleted.');
      navigate('/admin/products');
    } catch (ex) {
      setConfirm(null);
      toast.error(ex.message);
    }
  };

  const variantErr = (i, k) => errors[`variants.${i}.${k}`];
  const zeroPrice = !(Number(form.price) > 0);

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        back={{ to: '/admin/products', label: 'Products' }}
        title={isNew ? 'New product' : form.name || 'Edit product'}
        actions={
          <>
            {!isNew && form.slug && (
              <a href={`/products/${form.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                <Eye className="size-4" aria-hidden /> Preview
              </a>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save product'}
            </button>
          </>
        }
      />
      <div className="mb-6 space-y-3">
        <FormError message={formError} />
        {zeroPrice && form.status === 'active' && (
          <p className="flex items-center gap-2 rounded-md border border-[#f3d3a8] bg-[#fdf6ec] px-4 py-3 text-sm">
            <AlertTriangle className="size-4 text-[#8a4b00]" aria-hidden /> This product is active but has no price, so customers see “Price coming soon” and cannot order it.
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Basics">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" value={form.name} onChange={set('name')} error={err('name')} className="sm:col-span-2" maxLength={160} />
              <Field label="URL slug" value={form.slug} onChange={set('slug')} error={err('slug')} hint={`/products/${form.slug || '(generated from name)'}`} maxLength={160} />
              <Field label="SKU" value={form.sku} onChange={set('sku')} error={err('sku')} maxLength={64} />
              <Field label="Short description" as="textarea" rows={2} value={form.short_description} onChange={set('short_description')} error={err('short_description')} className="sm:col-span-2" maxLength={400} hint="Shown on product cards and in search results." />
              <Field label="Description" as="textarea" rows={8} value={form.description} onChange={set('description')} error={err('description')} className="sm:col-span-2" maxLength={10000} hint="Plain text. Leave a blank line between paragraphs." />
            </div>
          </Card>

          <Card title="Images">
              <ImageListEditor images={form.images} onChange={set('images')} onBusyChange={(busy) => setSaving(busy)} />
          </Card>

          <Card
            title="Colours and variants"
            actions={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('variants')([...form.variants, { name: '', color_hex: '', sku: '', price_adjustment: 0, stock_quantity: 0, is_active: true }])}>
                <Plus className="size-4" aria-hidden /> Add variant
              </button>
            }
          >
            {err('variants') && <p className="field-error mb-3">{err('variants')}</p>}
            <div className="space-y-4">
              {form.variants.map((v, i) => {
                const upd = (k, val) => set('variants')(form.variants.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
                return (
                  <div key={v.id || `new-${i}`} className="grid gap-3 rounded border border-hairline p-4 sm:grid-cols-12 sm:items-end">
                    <Field label="Name" value={v.name} onChange={(e) => upd('name', e.target.value)} error={variantErr(i, 'name')} className="sm:col-span-3" placeholder="White" />
                    <div className="sm:col-span-3">
                      <label className="field-label" htmlFor={`hex-${i}`}>
                        Colour
                      </label>
                      <div className="flex gap-2">
                        <input type="color" aria-label="Pick colour" value={/^#[0-9a-f]{6}$/i.test(v.color_hex) ? v.color_hex : '#ffffff'} onChange={(e) => upd('color_hex', e.target.value.toUpperCase())} className="h-12 w-12 shrink-0 cursor-pointer rounded border border-hairline bg-white p-1" />
                        <input id={`hex-${i}`} className="field" value={v.color_hex} onChange={(e) => upd('color_hex', e.target.value)} placeholder="#FFFFFF" maxLength={7} aria-invalid={variantErr(i, 'color_hex') ? 'true' : undefined} />
                      </div>
                      {variantErr(i, 'color_hex') && <p className="field-error">{variantErr(i, 'color_hex')}</p>}
                    </div>
                    <Field label="Variant SKU" optional value={v.sku} onChange={(e) => upd('sku', e.target.value)} error={variantErr(i, 'sku')} className="sm:col-span-2" />
                    <Field label="Price ± (₹)" type="number" step="0.01" value={v.price_adjustment} onChange={(e) => upd('price_adjustment', e.target.value)} className="sm:col-span-2" hint="Added to base price" />
                    <Field label="Stock" type="number" min="0" value={v.stock_quantity} onChange={(e) => upd('stock_quantity', e.target.value)} className="sm:col-span-2" disabled={!form.track_stock} hint={form.track_stock ? '' : 'Not tracked'} />
                    <div className="flex items-center justify-between gap-3 sm:col-span-12">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={v.is_active} onChange={(e) => upd('is_active', e.target.checked)} className="size-4 accent-ink" /> Available to customers
                      </label>
                      {form.variants.length > 1 && (
                        <button type="button" className="inline-flex items-center gap-1 text-sm text-danger hover:underline" onClick={() => set('variants')(form.variants.filter((_, j) => j !== i))}>
                          <Trash2 className="size-4" aria-hidden /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[0.8125rem] text-graphite">Variants that appear in past orders are deactivated instead of deleted.</p>
          </Card>

          <Card title="Features and specifications">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="field-label">Features</p>
                <div className="space-y-2">
                  {form.features.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="field" aria-label={`Feature ${i + 1}`} value={f} maxLength={160} onChange={(e) => set('features')(form.features.map((x, j) => (j === i ? e.target.value : x)))} />
                      <button type="button" className="rounded px-2 text-graphite hover:text-danger" onClick={() => set('features')(form.features.filter((_, j) => j !== i))} aria-label="Remove feature">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => set('features')([...form.features, ''])}>
                  Add feature
                </button>
              </div>
              <div>
                <p className="field-label">Specifications</p>
                <p className="mb-2 text-[0.8125rem] text-graphite">Only add specifications you have verified. Empty rows are ignored.</p>
                <div className="space-y-2">
                  {form.specifications.map((sp, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="field" aria-label="Specification name" placeholder="Label" value={sp.label} maxLength={80} onChange={(e) => set('specifications')(form.specifications.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      <input className="field" aria-label="Specification value" placeholder="Value" value={sp.value} maxLength={200} onChange={(e) => set('specifications')(form.specifications.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                      <button type="button" className="rounded px-2 text-graphite hover:text-danger" onClick={() => set('specifications')(form.specifications.filter((_, j) => j !== i))} aria-label="Remove specification">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => set('specifications')([...form.specifications, { label: '', value: '' }])}>
                  Add specification
                </button>
              </div>
            </div>
          </Card>

          <Card title="Shipping, warranty and SEO">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Shipping information" as="textarea" rows={3} value={form.shipping_info} onChange={set('shipping_info')} maxLength={2000} />
              <Field label="Warranty information" as="textarea" rows={3} value={form.warranty_info} onChange={set('warranty_info')} maxLength={2000} />
              <Field label="SEO title" value={form.seo_title} onChange={set('seo_title')} maxLength={160} hint={`${form.seo_title.length}/60 recommended`} />
              <Field label="SEO description" as="textarea" rows={2} value={form.seo_description} onChange={set('seo_description')} maxLength={320} hint={`${form.seo_description.length}/160 recommended`} />
              <div className="sm:col-span-2">
                <SingleImageField label="Social preview image" value={form.og_image_url} onChange={set('og_image_url')} folder="products" hint="Used when the product link is shared. Defaults to the main image." />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <Field label="Status" as="select" value={form.status} onChange={set('status')} error={err('status')}>
              <option value="draft">Draft — hidden</option>
              <option value="active">Active — published</option>
              <option value="coming_soon">Coming soon — visible, cannot be ordered</option>
              <option value="archived">Archived — hidden</option>
            </Field>
            <Toggle checked={form.is_featured} onChange={set('is_featured')} label="Featured on homepage" />
            <Field label="Display order" type="number" min="0" value={form.sort_order} onChange={set('sort_order')} className="mt-2" />
          </Card>
          <Card title="Category">
            <Field label="Category" as="select" value={form.category_id} onChange={set('category_id')} error={err('category_id')}>
              <option value="">Choose…</option>
              {categories.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({titleCase(c.status)})
                </option>
              ))}
            </Field>
          </Card>
          <Card title="Delivery Vendor">
            <Field
              label="Assigned Vendor"
              as="select"
              value={form.vendor_id || ''}
              onChange={set('vendor_id')}
              hint="Delivery partner notified on WhatsApp when this item is ordered."
            >
              <option value="">Default vendor (from .env)</option>
              {vendors.data?.items?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.whatsapp_number})
                </option>
              ))}
            </Field>
          </Card>
          <Card title="Pricing (₹)">
            <div className="space-y-4">
              <Field label="Price" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} error={err('price')} hint="Inclusive of any tax you collect. 0 = not for sale yet." />
              <Field label="Sale price" optional type="number" min="0" step="0.01" value={form.sale_price} onChange={set('sale_price')} error={err('sale_price')} hint="Must be lower than the price." />
            </div>
          </Card>
          <Card title="Inventory">
            <Toggle checked={form.track_stock} onChange={set('track_stock')} label="Track stock" description="Off = made to order (no stock limit). On = orders are limited to the stock of each variant." />
            {form.track_stock && <Field label="Low-stock alert at" type="number" min="0" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} className="mt-2" />}
          </Card>
          {!isNew && (
            <Card title="Remove">
              <p className="text-sm text-graphite">{orderCount > 0 ? `This product is in ${orderCount} order(s), so it can be archived but not deleted.` : 'Archive hides the product; delete removes it permanently.'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm('archive')}>
                  Archive
                </button>
                {orderCount === 0 && (
                  <button type="button" className="btn btn-sm bg-danger text-white hover:bg-danger/90" onClick={() => setConfirm('delete')}>
                    Delete
                  </button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={confirm === 'delete' ? remove : archive}
        title={confirm === 'delete' ? 'Delete this product?' : 'Archive this product?'}
        body={confirm === 'delete' ? 'This permanently removes the product, its images and its variants.' : 'The product will be hidden from the store. You can restore it by changing its status.'}
        confirmLabel={confirm === 'delete' ? 'Delete' : 'Archive'}
        danger={confirm === 'delete'}
      />
    </form>
  );
}
