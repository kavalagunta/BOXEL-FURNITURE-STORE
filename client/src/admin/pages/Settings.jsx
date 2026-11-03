import { useEffect, useRef, useState } from 'react';
import { PageHeader, Card, Toggle } from '../components/ui.jsx';
import { SingleImageField } from '../components/ImageUploader.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSite } from '../../context/SiteContext.jsx';
import { put } from '../../services/api.js';
import { formatDateTime } from '../../utils/format.js';
import { FONTS, applyTypography, fontStack, readTypography } from '../../utils/typography.js';

const WEIGHTS = [
  { value: '300', label: '300 — Light' },
  { value: '350', label: '350 — Book' },
  { value: '400', label: '400 — Regular' },
  { value: '450', label: '450 — Medium light' },
  { value: '500', label: '500 — Medium' },
  { value: '600', label: '600 — Semibold' },
  { value: '700', label: '700 — Bold' },
];

/**
 * Live preview: while you edit, the whole page switches to the chosen typography.
 * Leaving without saving restores the saved settings.
 */
function TypographyPreview({ values }) {
  const { s } = useSite();
  const t = readTypography(values);
  const key = `${t.font}|${t.baseSize}|${t.headingWeight}|${t.bodyWeight}`;
  useEffect(() => {
    applyTypography(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const saved = useRef(s);
  saved.current = s;
  useEffect(() => () => applyTypography(readTypography(saved.current)), []);

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-hairline" style={{ fontFamily: fontStack(t.font) }}>
      <div className="flex items-center justify-between border-b border-hairline bg-stone px-4 py-2 text-[0.75rem] text-graphite">
        <span>Live preview — the whole site uses this after you save</span>
        <span>
          {FONTS[t.font].family.replace(/'/g, '').replace(' Variable', '')} · {t.baseSize}px
        </span>
      </div>
      <div className="bg-white p-6">
        <p className="text-display-xl" style={{ fontWeight: t.headingWeight }}>
          Your space.
        </p>
        <p className="mt-3 text-headline" style={{ fontWeight: t.headingWeight }}>
          Meet the boxel Parcel Drop Box
        </p>
        <p className="mt-4 max-w-[60ch] text-lead text-graphite" style={{ fontWeight: t.bodyWeight }}>
          Parcels, groceries, laundry and returns arrive when you are out. The Parcel Drop Box receives them safely and holds them until you are back.
        </p>
        <p className="mt-3 text-sm" style={{ fontWeight: t.bodyWeight }}>
          Small text: Free shipping across India · ₹14,999 · +91 83100 18733
        </p>
      </div>
    </div>
  );
}

/**
 * Renders a settings group from a section/field description.
 * Field types: text, textarea, toggle, number, select, image. All values are validated on the server.
 */
export function SettingsForm({ group, title, description, sections, embedded = false }) {
  const { data, error, loading, reload } = useApi(`/admin/settings/${group}`);
  const { reload: reloadSite } = useSite();
  const toast = useToast();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (data) setValues(data.settings);
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !values) return <PageLoader />;
  const set = (k) => (v) => setValues((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const dirty = JSON.stringify(values) !== JSON.stringify(data.settings);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError('');
    try {
      const res = await put(`/admin/settings/${group}`, { settings: values });
      toast.success(res.changed.length ? `Saved ${res.changed.length} change${res.changed.length === 1 ? '' : 's'}.` : 'No changes to save.');
      reload();
      reloadSite();
    } catch (ex) {
      setErrors(ex.fields || {});
      setFormError(ex.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f) => {
    const common = { label: f.label, error: errors[f.key], hint: f.hint };
    switch (f.type) {
      case 'toggle':
        return <Toggle key={f.key} checked={values[f.key]} onChange={set(f.key)} label={f.label} description={f.hint} />;
      case 'textarea':
        return <Field key={f.key} {...common} as="textarea" rows={f.rows || 4} value={values[f.key] ?? ''} onChange={set(f.key)} className={f.wide !== false ? 'sm:col-span-2' : ''} />;
      case 'select':
        return (
          <Field key={f.key} {...common} as="select" value={values[f.key] ?? ''} onChange={set(f.key)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Field>
        );
      case 'image':
        return <SingleImageField key={f.key} label={f.label} value={values[f.key]} onChange={set(f.key)} onBusyChange={setUploading} folder="site" hint={f.hint} error={errors[f.key]} />;
      case 'number':
        return <Field key={f.key} {...common} type="number" min="0" step={f.step || '1'} value={values[f.key] ?? ''} onChange={set(f.key)} />;
      default:
        return <Field key={f.key} {...common} value={values[f.key] ?? ''} onChange={set(f.key)} placeholder={f.placeholder} className={f.wide ? 'sm:col-span-2' : ''} />;
    }
  };

  return (
    <form onSubmit={save} noValidate>
      {embedded ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{title}</h2>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || uploading || !dirty}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      ) : (
        <PageHeader title={title} description={description} actions={<button type="submit" className="btn btn-primary btn-sm" disabled={saving || uploading || !dirty}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>} />
      )}
      <div className="mb-4">
        <FormError message={formError} />
      </div>
      <div className="space-y-6">
        {sections.map((s) => (
          <Card key={s.title} title={s.title}>
            {s.intro && <p className="mb-4 text-sm text-graphite">{s.intro}</p>}
            <div className="grid gap-5 sm:grid-cols-2">{s.fields.map(renderField)}</div>
            {s.render && s.render(values)}
          </Card>
        ))}
      </div>
      {data.lastUpdated && (
        <p className="mt-6 text-[0.8125rem] text-graphite">
          Last settings change: {formatDateTime(data.lastUpdated.updated_at)}
          {data.lastUpdated.updated_by ? ` by ${data.lastUpdated.updated_by}` : ''}. Every change is recorded in the activity log.
        </p>
      )}
      <div className="sticky bottom-4 mt-6 flex justify-end">
        {dirty && (
          <button type="submit" className="btn btn-primary shadow-[var(--shadow-float)]" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>
    </form>
  );
}

export function StoreSettings() {
  return (
    <SettingsForm
      group="store"
      title="Store settings"
      description="Brand, homepage text, announcement bar, payments, tax, SEO and legal pages."
      sections={[
        {
          title: 'Brand',
          fields: [
            { key: 'business_name', label: 'Business name' },
            { key: 'business_tagline', label: 'Tagline' },
            { key: 'business_supporting_line', label: 'Supporting line', wide: true },
            { key: 'business_description', label: 'Short description (footer)', type: 'textarea', rows: 3 },
            { key: 'logo_url', label: 'Logo', type: 'image', hint: 'Transparent PNG works best. Keep the original proportions.' },
          ],
        },
        {
          title: 'Announcement bar',
          fields: [
            { key: 'announcement_enabled', label: 'Show the announcement bar', type: 'toggle' },
            { key: 'announcement_text', label: 'Text' },
            { key: 'announcement_link', label: 'Link', placeholder: '/about or https://…' },
          ],
        },
        {
          title: 'Homepage text',
          intro: 'The hero headline, buttons and image are edited under Homepage & banners.',
          fields: [
            { key: 'home_intro_heading', label: 'Product introduction heading', wide: true },
            { key: 'home_intro_body', label: 'Product introduction text', type: 'textarea' },
            { key: 'home_quality_note', label: '“How it works” note', type: 'textarea', rows: 3, hint: 'Shown under the order-to-door steps.' },
            { key: 'newsletter_enabled', label: 'Show newsletter sign-up', type: 'toggle' },
          ],
        },
        {
          title: 'Payments',
          intro: 'Online card/UPI payment stays off until a payment provider is integrated. Checkout is closed while no method is enabled.',
          fields: [
            { key: 'cod_enabled', label: 'Cash on delivery', type: 'toggle', hint: 'Enable only if your business accepts cash on delivery.' },
            { key: 'bank_transfer_enabled', label: 'Pay on confirmation (bank transfer / UPI shared by your team)', type: 'toggle' },
            { key: 'bank_transfer_instructions', label: 'Pay-on-confirmation instructions', type: 'textarea', rows: 3, hint: 'Shown at checkout and in the order email.' },
          ],
        },
        {
          title: 'Tax',
          intro: 'Leave off unless your tax setup has been confirmed with your accountant.',
          fields: [
            { key: 'tax_enabled', label: 'Show tax on orders', type: 'toggle' },
            { key: 'prices_include_tax', label: 'Product prices already include tax', type: 'toggle', hint: 'On: tax is shown as included. Off: tax is added on top.' },
            { key: 'tax_label', label: 'Tax name', placeholder: 'GST' },
            { key: 'tax_rate', label: 'Rate (%)', type: 'number', step: '0.01' },
          ],
        },
        {
          title: 'Typography',
          intro: 'Font family, text size and weight for the whole website. Changes preview live on this page; click Save to publish them.',
          fields: [
            { key: 'typography_font', label: 'Font family', type: 'select', options: Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label })) },
            {
              key: 'typography_base_size',
              label: 'Base text size',
              type: 'select',
              options: [14, 15, 16, 17, 18, 19, 20].map((n) => ({ value: String(n), label: `${n}px${n === 16 ? ' — standard' : n === 17 ? ' — comfortable' : ''}` })),
              hint: 'Scales every text size on the site proportionally.',
            },
            { key: 'typography_heading_weight', label: 'Heading weight', type: 'select', options: WEIGHTS, hint: '400 or heavier stays sharpest on Windows screens.' },
            { key: 'typography_body_weight', label: 'Body text weight', type: 'select', options: WEIGHTS.filter((w) => Number(w.value) >= 350 && Number(w.value) <= 600).concat([{ value: '420', label: '420 — Default (crisp)' }]).sort((a, b) => a.value - b.value) },
          ],
          render: (values) => <TypographyPreview values={values} />,
        },
        {
          title: 'Search engines and sharing',
          fields: [
            { key: 'seo_default_title', label: 'Default page title', wide: true, hint: 'Up to about 60 characters.' },
            { key: 'seo_default_description', label: 'Default description', type: 'textarea', rows: 2, hint: 'Up to about 160 characters.' },
            { key: 'seo_og_image', label: 'Default sharing image', type: 'image' },
          ],
        },
        {
          title: 'Legal pages',
          intro: 'Plain text. Leave a blank line between paragraphs. Have these reviewed for your business.',
          fields: [
            { key: 'privacy_policy', label: 'Privacy policy', type: 'textarea', rows: 10 },
            { key: 'terms_content', label: 'Terms and conditions', type: 'textarea', rows: 10 },
          ],
        },
      ]}
    />
  );
}

export function ContactSettings() {
  return (
    <SettingsForm
      group="contact"
      title="Business contact"
      description="Your public contact details and location. These are separate from customer enquiries."
      sections={[
        {
          title: 'Contact details',
          fields: [
            { key: 'business_phone', label: 'Phone', hint: 'Shown across the site, e.g. +91 83100 18733.' },
            { key: 'business_whatsapp', label: 'WhatsApp number' },
            { key: 'business_email', label: 'Public email', hint: 'Shown on the site and in emails. Leave empty to hide.' },
            { key: 'business_hours', label: 'Hours', placeholder: 'Mon–Sat, 10am–6pm' },
          ],
        },
        {
          title: 'Location',
          intro: 'Without a physical store, choose “Service area” and the homepage shows where you deliver instead of an address.',
          fields: [
            { key: 'location_mode', label: 'Homepage location section', type: 'select', options: [{ value: 'service_area', label: 'Service area (no walk-in store)' }, { value: 'store', label: 'Store or showroom' }] },
            { key: 'store_name', label: 'Store / showroom name' },
            { key: 'business_city', label: 'City' },
            { key: 'business_state', label: 'State' },
            { key: 'business_address', label: 'Full address', type: 'textarea', rows: 2 },
            { key: 'service_area_text', label: 'Service area text', wide: true },
            { key: 'map_url', label: 'Google Maps link', wide: true, placeholder: 'https://maps.app.goo.gl/…', hint: 'Used for “Get directions”.' },
            { key: 'map_embed_url', label: 'Google Maps embed link', wide: true, placeholder: 'https://www.google.com/maps/embed?pb=…', hint: 'From Google Maps → Share → Embed a map. Copy only the src="…" link.' },
          ],
        },
      ]}
    />
  );
}

export function ShippingSettings() {
  return (
    <SettingsForm
      group="shipping"
      title="Shipping & policies"
      description="Shipping charges are applied on the server to every cart and order."
      sections={[
        {
          title: 'Shipping charges',
          intro: 'A shipping fee of 0 means free shipping everywhere.',
          fields: [
            { key: 'shipping_fee', label: 'Shipping fee (₹)', type: 'number', step: '0.01' },
            { key: 'free_shipping_threshold', label: 'Free shipping from order value (₹)', type: 'number', step: '0.01', hint: '0 = no threshold.' },
          ],
        },
        {
          title: 'Policies',
          intro: 'Shown on the Shipping & returns page. Do not promise timelines or terms the business has not confirmed.',
          fields: [
            { key: 'shipping_policy', label: 'Shipping and delivery', type: 'textarea', rows: 8 },
            { key: 'returns_policy', label: 'Returns and cancellations', type: 'textarea', rows: 8 },
            { key: 'warranty_policy', label: 'Warranty', type: 'textarea', rows: 6 },
          ],
        },
      ]}
    />
  );
}
