import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Printer, RotateCw } from 'lucide-react';
import { PageHeader, Card, Table, Pagination, SearchInput, Select, StatusBadge, Toolbar, ConfirmDialog, Badge } from '../components/ui.jsx';
import { Field, FormError } from '../../components/ui/Field.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import Logo from '../../components/ui/Logo.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSite } from '../../context/SiteContext.jsx';
import { useAdmin, can } from '../AdminAuth.jsx';
import { patch, post, qs } from '../../services/api.js';
import { formatDateTime, formatINR, formatPhone, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '../../utils/format.js';

const STATUS_OPTIONS = [{ value: '', label: 'Any status' }, ...Object.entries(ORDER_STATUS).map(([value, label]) => ({ value, label }))];
const PAYMENT_OPTIONS = [{ value: '', label: 'Any payment' }, ...Object.entries(PAYMENT_STATUS).map(([value, label]) => ({ value, label }))];

export function OrdersList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };
  const query = qs({ q: params.get('q'), status: params.get('status'), payment: params.get('payment'), from: params.get('from'), to: params.get('to'), page: params.get('page') });
  const { data, loading, error, reload } = useApi(`/admin/orders${query}`);

  return (
    <>
      <PageHeader title="Orders" description="Search by order number, customer name, email or phone." />
      {error && <ErrorState error={error} onRetry={reload} />}
      <Card padded={false}>
        <Toolbar>
          <SearchInput value={params.get('q') || ''} onChange={(v) => set('q', v)} placeholder="Search orders" className="sm:w-64" />
          <Select label="Order status" value={params.get('status') || ''} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
          <Select label="Payment status" value={params.get('payment') || ''} onChange={(v) => set('payment', v)} options={PAYMENT_OPTIONS} />
          <label className="flex items-center gap-2 text-sm text-graphite">
            From
            <input type="date" className="field min-h-10 py-1.5 text-sm" value={params.get('from') || ''} onChange={(e) => set('from', e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-graphite">
            To
            <input type="date" className="field min-h-10 py-1.5 text-sm" value={params.get('to') || ''} onChange={(e) => set('to', e.target.value)} />
          </label>
        </Toolbar>
        <Table
          loading={loading}
          rows={data?.items}
          empty="No orders match these filters."
          onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
          columns={[
            { key: 'order_number', label: 'Order', render: (o) => <Link to={`/admin/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{o.order_number}</Link> },
            { key: 'created_at', label: 'Placed', render: (o) => formatDateTime(o.created_at) },
            { key: 'customer', label: 'Customer', render: (o) => <span><span className="block">{o.customer_name}</span><span className="text-[0.75rem] text-graphite">{formatPhone(o.customer_phone)}</span></span> },
            { key: 'items', label: 'Items', render: (o) => o.item_count },
            { key: 'status', label: 'Status', render: (o) => <StatusBadge status={o.status} label={ORDER_STATUS[o.status]} /> },
            { key: 'payment', label: 'Payment', render: (o) => <span className="flex flex-col gap-1"><StatusBadge status={o.payment_status} label={PAYMENT_STATUS[o.payment_status]} /><span className="text-[0.75rem] text-graphite">{PAYMENT_METHOD[o.payment_method]}</span></span> },
            { key: 'total', label: 'Total', className: 'text-right', render: (o) => formatINR(o.total) },
          ]}
        />
        <Pagination meta={data?.meta} onPage={(p) => set('page', String(p))} />
      </Card>
    </>
  );
}

function Invoice({ order }) {
  const { s } = useSite();
  return (
    <div className="hidden print:block">
      <div className="flex items-start justify-between border-b border-hairline pb-6">
        <Logo asLink={false} className="h-8 w-auto" />
        <div className="text-right text-sm">
          <p className="text-lg font-medium">Order summary</p>
          <p>{order.order_number}</p>
          <p>{formatDateTime(order.created_at)}</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="font-medium">From</p>
          <p>{s.business_name}</p>
          {s.business_address && <p>{s.business_address}</p>}
          <p>{[s.business_city, s.business_state].filter(Boolean).join(', ')}</p>
          <p>{formatPhone(s.business_phone)}</p>
          {s.business_email && <p>{s.business_email}</p>}
        </div>
        <div>
          <p className="font-medium">Deliver to</p>
          <p>{order.customer_name}</p>
          <p>{order.ship_line1}</p>
          {order.ship_line2 && <p>{order.ship_line2}</p>}
          <p>
            {order.ship_city}, {order.ship_state} {order.ship_pincode}
          </p>
          <p>{formatPhone(order.customer_phone)}</p>
        </div>
      </div>
      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink">
            <th className="py-2">Item</th>
            <th className="py-2">Qty</th>
            <th className="py-2 text-right">Unit</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-hairline">
              <td className="py-2">
                {i.product_name}
                {i.variant_name && ` — ${i.variant_name}`}
                <br />
                <span className="text-graphite">{i.sku}</span>
              </td>
              <td className="py-2">{i.quantity}</td>
              <td className="py-2 text-right">{formatINR(i.unit_price)}</td>
              <td className="py-2 text-right">{formatINR(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
        <p className="flex justify-between"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></p>
        <p className="flex justify-between"><span>Shipping</span><span>{Number(order.shipping_fee) > 0 ? formatINR(order.shipping_fee) : 'Free'}</span></p>
        {Number(order.tax_amount) > 0 && <p className="flex justify-between"><span>{order.tax_label}</span><span>{formatINR(order.tax_amount)}</span></p>}
        <p className="flex justify-between border-t border-ink pt-1 font-medium"><span>Total</span><span>{formatINR(order.total)}</span></p>
        <p className="pt-2">Payment: {PAYMENT_METHOD[order.payment_method]} — {PAYMENT_STATUS[order.payment_status]}</p>
      </div>
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { admin } = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/admin/orders/${id}`);
  const [statusDialog, setStatusDialog] = useState(null);
  const [statusNote, setStatusNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [dialogError, setDialogError] = useState('');
  const [note, setNote] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  const { order, notes = [], payments = [], emails = [], notifications = [], allowedTransitions = [] } = data;
  const track = tracking ?? { tracking_carrier: order.tracking_carrier || '', tracking_number: order.tracking_number || '', tracking_url: order.tracking_url || '' };

  const run = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      reload();
      return true;
    } catch (ex) {
      toast.error(ex.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async () => {
    setDialogError('');
    const isRejection = statusDialog === 'rejected' || statusDialog === 'cancelled';
    if (isRejection && statusNote.trim().length < 3) {
      return setDialogError('A reason for rejecting/cancelling is required.');
    }
    const ok = await run(
      () =>
        patch(`/admin/orders/${id}/status`, {
          status: statusDialog,
          note: isRejection ? undefined : statusNote,
          cancelReason: isRejection ? statusNote : undefined,
          rejectionReason: isRejection ? statusNote : undefined,
          notifyCustomer: notify,
        }),
      `Order ${statusDialog === 'accepted' ? 'accepted successfully' : statusDialog === 'rejected' ? 'rejected' : `marked ${ORDER_STATUS[statusDialog]?.toLowerCase() || statusDialog}`}.`,
    );
    if (ok) {
      setStatusDialog(null);
      setStatusNote('');
    }
  };

  const canPay = can(admin, 'products'); // admin or super admin
  const paymentActions = { pending: ['paid', 'failed'], failed: ['paid'], paid: ['refunded'] }[order.payment_status] || [];

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          back={{ to: '/admin/orders', label: 'Orders' }}
          title={`Order ${order.order_number}`}
          description={`Placed ${formatDateTime(order.created_at)}`}
          actions={
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print summary
            </button>
          }
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Fulfilment & Order Status">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={order.status} label={ORDER_STATUS[order.status]} />
                
                {(order.status === 'placed' || order.status === 'pending') && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-semibold"
                      onClick={() => {
                        setStatusDialog('accepted');
                        setNotify(true);
                        setDialogError('');
                      }}
                    >
                      ✓ Accept Order
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm bg-red-600 text-white hover:bg-red-700 shadow-sm font-semibold"
                      onClick={() => {
                        setStatusDialog('rejected');
                        setNotify(true);
                        setDialogError('');
                      }}
                    >
                      ✕ Reject Order
                    </button>
                  </div>
                )}

                {order.status !== 'placed' && order.status !== 'pending' && allowedTransitions.length > 0 && (
                  <>
                    <span className="text-sm text-graphite">Move to:</span>
                    {allowedTransitions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`btn btn-sm ${t === 'rejected' || t === 'cancelled' ? 'btn-secondary text-danger hover:bg-red-50' : 'btn-primary'}`}
                        onClick={() => {
                          setStatusDialog(t);
                          setNotify(true);
                          setDialogError('');
                        }}
                      >
                        {t === 'rejected' || t === 'cancelled' ? 'Reject / Cancel order' : ORDER_STATUS[t]}
                      </button>
                    ))}
                  </>
                )}

                {allowedTransitions.length === 0 && (
                  <span className="text-sm text-graphite">This order is in a final state.</span>
                )}
              </div>

              {order.accepted_at && (order.status === 'accepted' || order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered') && (
                <p className="mt-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2">
                  Order was accepted on {formatDateTime(order.accepted_at)} for delivery to {order.ship_city}, {order.ship_state}.
                </p>
              )}

              {(order.rejection_reason || order.cancel_reason) && (
                <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-semibold">Order Rejected / Cancelled</p>
                  <p className="mt-1"><strong>Reason:</strong> {order.rejection_reason || order.cancel_reason}</p>
                  {order.rejected_at && <p className="mt-1 text-xs text-red-600">Recorded on {formatDateTime(order.rejected_at)}</p>}
                  <p className="mt-1 text-xs text-red-600">Product stock has been restored to inventory.</p>
                </div>
              )}

              <p className="mt-4 text-[0.8125rem] text-graphite">
                Order Lifecycle: Placed → Accepted / Rejected → Shipped → Delivered. Rejecting restores product stock. WhatsApp and Email notifications are dispatched automatically.
              </p>
            </Card>

            <Card title="Items" padded={false}>
              <ul className="divide-y divide-hairline">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <div className="size-12 shrink-0 overflow-hidden rounded-sm bg-stone">{i.image_url && <img src={i.image_url} alt="" className="size-full object-cover" />}</div>
                    <div className="flex-1">
                      <p className="font-medium">{i.product_name}</p>
                      <p className="text-graphite">
                        {i.variant_name && (
                          <>
                            <span className="mr-1 inline-block size-2.5 rounded-full border border-black/15 align-middle" style={{ background: i.color_hex || '#ddd' }} aria-hidden />
                            {i.variant_name} ·{' '}
                          </>
                        )}
                        {i.sku}
                      </p>
                    </div>
                    <p className="tabular-nums text-graphite">
                      {i.quantity} × {formatINR(i.unit_price)}
                    </p>
                    <p className="w-24 text-right font-medium tabular-nums">{formatINR(i.line_total)}</p>
                  </li>
                ))}
              </ul>
              <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t border-hairline px-5 py-4 text-sm">
                <div className="flex justify-between"><dt className="text-graphite">Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-graphite">Shipping</dt><dd>{Number(order.shipping_fee) > 0 ? formatINR(order.shipping_fee) : 'Free'}</dd></div>
                {Number(order.tax_amount) > 0 && <div className="flex justify-between"><dt className="text-graphite">{order.tax_label}</dt><dd>{formatINR(order.tax_amount)}</dd></div>}
                <div className="flex justify-between border-t border-hairline pt-1.5 font-medium"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
              </dl>
            </Card>

            <Card title="Tracking (visible to the customer)">
              <form
                className="grid gap-4 sm:grid-cols-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run(() => patch(`/admin/orders/${id}/tracking`, track), 'Tracking saved.')) setTracking(null);
                }}
              >
                <Field label="Carrier" value={track.tracking_carrier} onChange={(e) => setTracking({ ...track, tracking_carrier: e.target.value })} />
                <Field label="Tracking number" value={track.tracking_number} onChange={(e) => setTracking({ ...track, tracking_number: e.target.value })} />
                <Field label="Tracking link" value={track.tracking_url} onChange={(e) => setTracking({ ...track, tracking_url: e.target.value })} placeholder="https://" />
                <div className="sm:col-span-3">
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !tracking}>
                    Save tracking
                  </button>
                </div>
              </form>
            </Card>

            <Card title="History">
              <ol className="space-y-3 text-sm">
                {order.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="w-40 shrink-0 text-graphite">{formatDateTime(h.created_at)}</span>
                    <span className="flex-1">
                      {h.from_status && h.from_status !== h.to_status ? `${ORDER_STATUS[h.from_status]} → ` : ''}
                      <strong className="font-medium">{h.from_status === h.to_status ? '' : ORDER_STATUS[h.to_status]}</strong>
                      {h.note && <span className="text-graphite"> {h.from_status === h.to_status ? '' : '— '}{h.note}</span>}
                      <span className="text-graphite"> · by {h.admin_name || h.changed_by_label}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Customer">
              <div className="space-y-1 text-sm">
                <p className="font-medium">{order.customer_name}</p>
                <p>
                  <span className="text-[0.75rem] text-graphite block">Registered Email:</span>
                  <a href={`mailto:${order.customer_email}`} className="font-semibold text-ink underline">
                    {order.customer_email}
                  </a>
                </p>
                <p>
                  <span className="text-[0.75rem] text-graphite block">Phone:</span>
                  <a href={`tel:${order.customer_phone}`} className="hover:underline">
                    {formatPhone(order.customer_phone)}
                  </a>
                </p>
                {order.customer_id ? (
                  <Link to={`/admin/customers/${order.customer_id}`} className="link mt-2 inline-block">
                    Customer profile
                  </Link>
                ) : (
                  <p className="pt-1 text-graphite">Guest checkout</p>
                )}
              </div>
              <div className="mt-5 border-t border-hairline pt-4 text-sm">
                <p className="mb-1 text-graphite">Delivery address</p>
                <address className="not-italic leading-relaxed">
                  {order.ship_line1}
                  {order.ship_line2 && <><br />{order.ship_line2}</>}
                  <br />
                  {order.ship_city}, {order.ship_state} {order.ship_pincode}
                  <br />
                  {order.ship_country}
                </address>
                {order.delivery_instructions && <p className="mt-3"><span className="text-graphite">Instructions:</span> {order.delivery_instructions}</p>}
                {order.order_notes && <p className="mt-2"><span className="text-graphite">Customer notes:</span> {order.order_notes}</p>}
              </div>
            </Card>

            <Card title="Send Customer Update / Feedback">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!customerMessage.trim() || sendingMessage) return;
                  setSendingMessage(true);
                  const ok = await run(
                    () => post(`/admin/orders/${id}/message`, { message: customerMessage.trim(), subject: messageSubject.trim() || undefined }),
                    'Email notification sent to customer.'
                  );
                  if (ok) {
                    setCustomerMessage('');
                    setMessageSubject('');
                  }
                  setSendingMessage(false);
                }}
                className="space-y-3"
              >
                <p className="text-[0.8125rem] text-graphite">
                  Sends an email directly to <strong className="text-ink">{order.customer_email}</strong> and stores the message in the customer dashboard.
                </p>
                <Field
                  label="Subject (optional)"
                  placeholder={`Update regarding order ${order.order_number}`}
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                />
                <Field
                  label="Message / Feedback"
                  as="textarea"
                  rows={3}
                  required
                  placeholder="e.g. Your order is confirmed and moving into production."
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm w-full"
                  disabled={busy || sendingMessage || !customerMessage.trim()}
                >
                  {sendingMessage ? 'Sending Email…' : 'Send Email / Update'}
                </button>
              </form>
            </Card>

            <Card title="Payment">
              <div className="flex items-center gap-2">
                <StatusBadge status={order.payment_status} label={PAYMENT_STATUS[order.payment_status]} />
                <span className="text-sm text-graphite">{PAYMENT_METHOD[order.payment_method]}</span>
              </div>
              <ul className="mt-3 space-y-1 text-[0.8125rem] text-graphite">
                {payments.map((p) => (
                  <li key={p.id}>
                    {formatINR(p.amount)} — {PAYMENT_STATUS[p.status]}
                    {p.provider_reference && ` · ref ${p.provider_reference}`}
                    {p.recorded_by && ` · recorded by ${p.recorded_by}`}
                    {p.paid_at && ` · ${formatDateTime(p.paid_at)}`}
                  </li>
                ))}
              </ul>
              {canPay && paymentActions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {paymentActions.map((a) => (
                    <button key={a} type="button" className="btn btn-secondary btn-sm" onClick={() => setPayment({ status: a, reference: '', notes: '' })} disabled={a === 'paid' && order.status === 'cancelled'}>
                      Mark {PAYMENT_STATUS[a].toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[0.75rem] text-graphite">Only mark an order paid after the money has actually been received.</p>
            </Card>

            <Card title="Internal notes">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (note.trim() && (await run(() => post(`/admin/orders/${id}/notes`, { note }), 'Note added.'))) setNote('');
                }}
              >
                <Field label="Add a note" as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint="Only staff can see notes." />
                <button type="submit" className="btn btn-secondary btn-sm mt-2" disabled={busy || !note.trim()}>
                  Add note
                </button>
              </form>
              <ul className="mt-4 space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded bg-stone p-3 text-sm">
                    <p className="whitespace-pre-line">{n.note}</p>
                    <p className="mt-1 text-[0.75rem] text-graphite">
                      {n.admin_name || 'Admin'} · {formatDateTime(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Notifications (WhatsApp & Email)">
              {emails.length === 0 && notifications.length === 0 ? (
                <p className="text-sm text-graphite">No notifications recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {notifications.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-graphite">WhatsApp Notifications</p>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded transition-colors"
                          onClick={() => run(() => post(`/admin/orders/${id}/resend-vendor`), 'Vendor notifications sent.')}
                          disabled={busy}
                        >
                          <RotateCw className="size-3" /> Resend to Vendors
                        </button>
                      </div>
                      <ul className="space-y-2.5 text-sm">
                        {notifications.map((n) => {
                          const isVendor = n.type === 'vendor_order_placed';
                          return (
                            <li key={`wa-${n.id}`} className="rounded border border-hairline bg-stone/40 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span
                                    className={`inline-block rounded px-1.5 py-0.5 text-[0.7rem] font-bold ${
                                      isVendor ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {isVendor ? '🚚 Delivery Vendor' : 'WhatsApp'}
                                  </span>
                                  <span className="ml-2 font-medium">
                                    {isVendor ? `Order Details to ${n.vendor_name || 'Vendor'}` : n.type.replace(/_/g, ' ')}
                                  </span>
                                  <span className="block text-[0.75rem] text-graphite mt-0.5">
                                    Recipient: {n.recipient} {n.vendor_name ? `(${n.vendor_name})` : ''} · {formatDateTime(n.created_at)}
                                  </span>
                                  {n.error && <span className="mt-1 block text-[0.75rem] text-danger">{n.error}</span>}
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                  <StatusBadge status={n.status} />
                                  {n.fallback_link && (
                                    <a
                                      href={n.fallback_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[0.75rem] font-medium text-white hover:bg-emerald-700 shadow-sm"
                                    >
                                      {isVendor ? 'Send to vendor on WhatsApp' : 'Send via WhatsApp'}
                                    </a>
                                  )}
                                  {isVendor ? (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-[0.75rem] underline text-graphite hover:text-ink"
                                      onClick={() => run(() => post(`/admin/orders/${id}/resend-vendor`, { vendorId: n.vendor_id }), 'Resent to vendor.')}
                                      disabled={busy}
                                    >
                                      <RotateCw className="size-3" aria-hidden /> Resend to vendor
                                    </button>
                                  ) : n.status !== 'sent' ? (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-[0.75rem] underline text-graphite hover:text-ink"
                                      onClick={() => run(() => post(`/admin/orders/${id}/emails/${n.id}/retry`), 'Notification retried.')}
                                      disabled={busy}
                                    >
                                      <RotateCw className="size-3" aria-hidden /> Resend
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {n.payload && (
                                <p className="mt-2 text-xs text-graphite whitespace-pre-wrap rounded bg-white p-2 border border-hairline font-mono text-[0.72rem]">
                                  {n.payload}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {emails.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-graphite">Email Notifications</p>
                      <ul className="space-y-2.5 text-sm">
                        {emails.map((m) => (
                          <li key={`email-${m.id}`} className="rounded border border-hairline bg-stone/40 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[0.7rem] font-bold text-blue-800">
                                  Email
                                </span>
                                <span className="ml-2 font-medium">{m.type.replace('order_', 'Order ').replace(/_/g, ' ')}</span>
                                <span className="block text-[0.75rem] text-graphite mt-0.5">
                                  {m.recipient} · {m.attempts} attempt{m.attempts === 1 ? '' : 's'}
                                </span>
                                {m.error_message && <span className="mt-1 block text-[0.75rem] text-danger">{m.error_message}</span>}
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <StatusBadge status={m.status} />
                                {m.status !== 'sent' && (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-[0.75rem] underline text-graphite hover:text-ink"
                                    onClick={() => run(() => post(`/admin/orders/${id}/emails/${m.id}/retry`), 'Email retried.')}
                                    disabled={busy}
                                  >
                                    <RotateCw className="size-3" aria-hidden /> Resend
                                  </button>
                                )}
                              </div>
                            </div>
                            {m.message_body && (
                              <p className="mt-2 text-xs text-graphite whitespace-pre-wrap rounded bg-white p-2 border border-hairline">
                                {m.message_body}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <Invoice order={order} />

      <ConfirmDialog
        open={Boolean(statusDialog)}
        onClose={() => setStatusDialog(null)}
        onConfirm={changeStatus}
        busy={busy}
        title={
          statusDialog === 'accepted'
            ? `Accept Order #${order.order_number}?`
            : statusDialog === 'rejected'
            ? `Reject Order #${order.order_number}?`
            : statusDialog === 'cancelled'
            ? `Cancel Order #${order.order_number}?`
            : `Mark as ${ORDER_STATUS[statusDialog] || ''}?`
        }
        confirmLabel={
          statusDialog === 'accepted'
            ? 'Accept & Notify Customer'
            : statusDialog === 'rejected'
            ? 'Reject Order'
            : statusDialog === 'cancelled'
            ? 'Cancel Order'
            : 'Update status'
        }
        danger={statusDialog === 'rejected' || statusDialog === 'cancelled'}
      >
        <div className="mt-2 space-y-3">
          {statusDialog === 'accepted' && (
            <div className="rounded bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Accepting for delivery</p>
              <p className="mt-1">
                Delivering to: <strong>{order.ship_line1}, {order.ship_city} - {order.ship_pincode}</strong>
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Total: ₹{Number(order.total).toLocaleString('en-IN')} (Cash on Delivery). This will store acceptance details and dispatch notifications.
              </p>
            </div>
          )}

          {(statusDialog === 'rejected' || statusDialog === 'cancelled') && (
            <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <p className="font-semibold">Rejection details</p>
              <p className="mt-1 text-xs">
                Rejecting this order will automatically restore product quantities to stock.
              </p>
            </div>
          )}

          <Field
            label={
              statusDialog === 'rejected' || statusDialog === 'cancelled'
                ? 'Rejection reason (Required — sent to customer)'
                : 'Note (optional, internal)'
            }
            as="textarea"
            rows={3}
            required={statusDialog === 'rejected' || statusDialog === 'cancelled'}
            placeholder={
              statusDialog === 'rejected' || statusDialog === 'cancelled'
                ? 'e.g. Delivery address unserviceable or item temporarily out of stock.'
                : ''
            }
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm text-graphite">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="size-4 accent-ink"
            />{' '}
            Send WhatsApp & Email notifications to customer
          </label>

          {statusDialog === 'shipped' && !order.tracking_number && (
            <Badge tone="amber">Tip: add tracking details first so they are included in the notification.</Badge>
          )}
          <FormError message={dialogError} />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(payment)}
        onClose={() => setPayment(null)}
        busy={busy}
        title={`Mark payment as ${payment ? PAYMENT_STATUS[payment.status].toLowerCase() : ''}?`}
        confirmLabel="Record payment status"
        onConfirm={async () => {
          if (await run(() => patch(`/admin/orders/${id}/payment`, payment), 'Payment status recorded.')) setPayment(null);
        }}
      >
        {payment && (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-graphite">This is recorded against your name in the order history and activity log.</p>
            <Field label="Reference (UTR, receipt no.)" optional value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
            <Field label="Notes" optional value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
