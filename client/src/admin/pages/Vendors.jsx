import { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Phone, Mail, Package, AlertCircle, ExternalLink } from 'lucide-react';
import { PageHeader, Card, Table, StatusBadge, Toolbar } from '../components/ui.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Overlay.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { get, post, put, del } from '../../services/api.js';
import { formatPhone, formatDateTime } from '../../utils/format.js';

export default function Vendors() {
  const { data, loading, error, reload } = useApi('/admin/vendors');
  const toast = useToast();

  const [editingVendor, setEditingVendor] = useState(null); // null, 'new', or vendor object
  const [assigningVendor, setAssigningVendor] = useState(null); // vendor object for product assignment
  const [allProducts, setAllProducts] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '',
    whatsapp_number: '',
    email: '',
    is_active: true,
  });

  const openNew = () => {
    setForm({ name: '', whatsapp_number: '', email: '', is_active: true });
    setFormError('');
    setEditingVendor('new');
  };

  const openEdit = (v) => {
    setForm({
      name: v.name,
      whatsapp_number: v.whatsapp_number,
      email: v.email || '',
      is_active: Boolean(v.is_active),
    });
    setFormError('');
    setEditingVendor(v);
  };

  const openAssign = async (v) => {
    setAssigningVendor(v);
    setProductsLoading(true);
    try {
      const res = await get('/admin/vendors/products');
      const products = res.items || [];
      setAllProducts(products);
      // Pre-select products currently assigned to this vendor
      const assigned = products.filter((p) => p.vendor_id === v.id).map((p) => p.id);
      setSelectedProductIds(assigned);
    } catch (err) {
      toast.error('Failed to load products: ' + err.message);
    } finally {
      setProductsLoading(false);
    }
  };

  const saveVendor = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      if (editingVendor === 'new') {
        await post('/admin/vendors', form);
        toast.success('Vendor added successfully.');
      } else {
        await put(`/admin/vendors/${editingVendor.id}`, form);
        toast.success('Vendor updated.');
      }
      setEditingVendor(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteVendor = async (v) => {
    if (!window.confirm(`Delete vendor "${v.name}"? Any assigned products will revert to the default delivery vendor.`)) {
      return;
    }
    try {
      await del(`/admin/vendors/${v.id}`);
      toast.success('Vendor removed.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveAssignments = async () => {
    if (!assigningVendor) return;
    setBusy(true);
    try {
      await post(`/admin/vendors/${assigningVendor.id}/assign-products`, {
        productIds: selectedProductIds,
      });
      toast.success(`Assigned ${selectedProductIds.length} products to ${assigningVendor.name}.`);
      setAssigningVendor(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleProductSelect = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const vendors = data?.items || [];

  return (
    <>
      <PageHeader
        title="Delivery Vendors"
        description="Delivery partners and fulfillment vendors who receive automated WhatsApp notifications when orders are placed."
        actions={
          <button type="button" className="btn btn-primary btn-sm flex items-center gap-2" onClick={openNew}>
            <Plus className="size-4" /> Add Vendor
          </button>
        }
      />

      <Card padded={false}>
        <Table
          rows={vendors}
          empty="No vendors configured yet. Orders without an assigned vendor fall back to the default number in .env."
          columns={[
            {
              key: 'name',
              label: 'Vendor Name',
              render: (v) => (
                <div>
                  <span className="font-medium text-ink">{v.name}</span>
                  {v.email && (
                    <span className="flex items-center gap-1.5 text-xs text-graphite mt-0.5">
                      <Mail className="size-3 text-graphite/70" /> {v.email}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'whatsapp_number',
              label: 'WhatsApp Number',
              render: (v) => (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm text-ink bg-stone/50 px-2 py-0.5 rounded">
                    <Phone className="size-3.5 text-emerald-600" />
                    {v.whatsapp_number}
                  </span>
                  <a
                    href={`https://wa.me/${v.whatsapp_number.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open WhatsApp chat"
                    className="text-graphite hover:text-emerald-600 transition-colors p-1"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              ),
            },
            {
              key: 'product_count',
              label: 'Assigned Products',
              render: (v) => (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Package className="size-4 text-graphite" />
                  <span className="font-medium">{v.product_count}</span>
                  <span className="text-graphite text-xs">items</span>
                </span>
              ),
            },
            {
              key: 'is_active',
              label: 'Status',
              render: (v) => (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    v.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-2 text-graphite'
                  }`}
                >
                  {v.is_active ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                  {v.is_active ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              className: 'text-right',
              render: (v) => (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openAssign(v)}
                    className="btn btn-secondary btn-sm text-xs py-1 px-2.5"
                    title="Assign products to this vendor"
                  >
                    Assign Products
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="btn btn-secondary btn-sm p-1.5"
                    title="Edit vendor"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteVendor(v)}
                    className="btn btn-secondary btn-sm p-1.5 text-red-600 hover:text-red-700"
                    title="Delete vendor"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Add / Edit Vendor Modal */}
      {editingVendor && (
        <Modal
          open={Boolean(editingVendor)}
          onClose={() => setEditingVendor(null)}
          title={editingVendor === 'new' ? 'Add Delivery Vendor' : `Edit ${editingVendor.name}`}
        >
          <form onSubmit={saveVendor} className="space-y-4 pt-2">
            <Field
              label="Vendor / Partner Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Swift Logistics (South Bangalore)"
              required
            />
            <Field
              label="Vendor WhatsApp Number"
              value={form.whatsapp_number}
              onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              placeholder="+919876543210"
              hint="Normalized to standard E.164 (+91XXXXXXXXXX) automatically."
              required
            />
            <Field
              label="Contact Email (Optional)"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="vendor@logistics.in"
            />
            <label className="flex items-center gap-3 text-sm cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="size-4 rounded text-ink focus:ring-ink"
              />
              <span className="text-ink font-medium">Active (receives order notifications)</span>
            </label>

            <FormError message={formError} />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingVendor(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? 'Saving…' : editingVendor === 'new' ? 'Add Vendor' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Products Modal */}
      {assigningVendor && (
        <Modal
          open={Boolean(assigningVendor)}
          onClose={() => setAssigningVendor(null)}
          title={`Assign Products to ${assigningVendor.name}`}
        >
          <div className="space-y-4 pt-2">
            <p className="text-sm text-graphite">
              When a customer places a COD order containing any of these products,{' '}
              <strong className="text-ink">{assigningVendor.name}</strong> will automatically receive a WhatsApp message
              with only their assigned products, quantities, prices, and the delivery address.
            </p>

            {productsLoading ? (
              <div className="py-8 text-center text-graphite text-sm">Loading products…</div>
            ) : allProducts.length === 0 ? (
              <div className="py-6 text-center text-graphite text-sm">No products found in the catalog.</div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-hairline border border-hairline rounded-md">
                {allProducts.map((p) => {
                  const isChecked = selectedProductIds.includes(p.id);
                  const isOther = p.vendor_id && p.vendor_id !== assigningVendor.id;
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-stone/40 transition-colors ${
                        isChecked ? 'bg-stone/60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProductSelect(p.id)}
                          className="size-4 rounded text-ink focus:ring-ink"
                        />
                        <div>
                          <p className="font-medium text-ink">{p.name}</p>
                          <p className="text-xs text-graphite">SKU: {p.sku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {isOther && !isChecked && (
                          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            Assigned to {p.vendor_name}
                          </span>
                        )}
                        {isChecked && (
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-hairline">
              <span className="text-xs text-graphite">
                {selectedProductIds.length} of {allProducts.length} product(s) selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAssigningVendor(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveAssignments}
                  disabled={busy || productsLoading}
                >
                  {busy ? 'Saving…' : 'Save Assignments'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

