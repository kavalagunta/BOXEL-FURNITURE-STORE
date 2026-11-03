import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { formatINR, formatDateTime, formatPhone, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '../utils/format.js';

const FLOW = [
  { key: 'placed', label: 'Placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

export function StatusTimeline({ status, reason }) {
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50/80 p-4">
        <p className="font-semibold text-red-800">Order Rejected / Cancelled</p>
        {reason && <p className="mt-1 text-sm text-red-700"><strong>Reason:</strong> {reason}</p>}
      </div>
    );
  }

  // Map legacy statuses into the 4 customer stages
  let stageIndex = 0;
  if (status === 'placed' || status === 'pending') stageIndex = 0;
  else if (status === 'accepted' || status === 'confirmed' || status === 'processing') stageIndex = 1;
  else if (status === 'shipped') stageIndex = 2;
  else if (status === 'delivered') stageIndex = 3;

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
      {FLOW.map((step, i) => {
        const done = i <= stageIndex;
        return (
          <li key={step.key} className="text-[0.75rem] sm:text-sm" aria-current={i === stageIndex ? 'step' : undefined}>
            <span className={`block h-1.5 rounded-full ${done ? 'bg-emerald-600' : 'bg-hairline'}`} />
            <span className={`mt-2 flex items-center gap-1 font-medium ${done ? 'text-ink' : 'text-graphite'}`}>
              {done && <Check className="hidden size-3.5 text-emerald-600 sm:block" aria-hidden />}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Order summary shared by the confirmation page and the account order page. */
export default function OrderView({ order }) {
  const reason = order.rejection_reason || order.cancel_reason;
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <StatusTimeline status={order.status} reason={reason} />
        <h2 className="mt-10 text-title font-medium">Items</h2>
        <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-4">
              <div className="size-16 shrink-0 overflow-hidden rounded-sm bg-stone">{i.image_url && <img src={i.image_url} alt="" className="size-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                {i.product_slug ? (
                  <Link to={`/products/${i.product_slug}`} className="font-medium hover:underline">
                    {i.product_name}
                  </Link>
                ) : (
                  <p className="font-medium">{i.product_name}</p>
                )}
                <p className="text-sm text-graphite">
                  {i.variant_name && `${i.variant_name} · `}
                  {i.quantity} × {formatINR(i.unit_price)}
                </p>
              </div>
              <p className="font-medium tabular-nums">{formatINR(i.line_total)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-6 space-y-2 text-[0.9375rem] sm:ml-auto sm:max-w-xs">
          <div className="flex justify-between">
            <dt className="text-graphite">Subtotal</dt>
            <dd>{formatINR(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-graphite">Shipping</dt>
            <dd>{Number(order.shipping_fee) > 0 ? formatINR(order.shipping_fee) : 'Free'}</dd>
          </div>
          {Number(order.tax_amount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-graphite">{order.tax_label}</dt>
              <dd>{formatINR(order.tax_amount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-hairline pt-2 text-lg font-medium">
            <dt>Total</dt>
            <dd>{formatINR(order.total)}</dd>
          </div>
        </dl>
        {order.notifications && order.notifications.length > 0 && (
          <div className="mt-8 border-t border-hairline pt-6">
            <h2 className="text-title font-medium">Store updates & notifications</h2>
            <ul className="mt-4 space-y-3">
              {order.notifications.map((n) => (
                <li key={n.id} className="rounded-sm border border-hairline bg-stone p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{n.subject || 'Order Update'}</span>
                    <span className="text-[0.75rem] text-graphite">{formatDateTime(n.created_at)}</span>
                  </div>
                  {n.message_body && (
                    <p className="mt-2 whitespace-pre-line text-ink leading-relaxed">{n.message_body}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[0.75rem]">
                    <span className="text-graphite">Email delivery:</span>
                    <span className={`font-medium ${n.status === 'sent' ? 'text-emerald-700' : n.status === 'failed' ? 'text-danger' : 'text-graphite'}`}>
                      {n.status === 'sent' ? 'Delivered' : n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="space-y-8 text-[0.9375rem] lg:col-span-4 lg:col-start-9">
        <div>
          <h2 className="text-sm text-graphite">Delivery address</h2>
          <address className="mt-2 not-italic leading-relaxed">
            {order.customer_name}
            <br />
            {order.ship_line1}
            {order.ship_line2 && (
              <>
                <br />
                {order.ship_line2}
              </>
            )}
            <br />
            {order.ship_city}, {order.ship_state} {order.ship_pincode}
            <br />
            {order.ship_country}
            <br />
            {formatPhone(order.customer_phone)}
          </address>
        </div>
        <div>
          <h2 className="text-sm text-graphite">Payment</h2>
          <p className="mt-2">{PAYMENT_METHOD[order.payment_method]}</p>
          <p className="text-graphite">{PAYMENT_STATUS[order.payment_status]}</p>
        </div>
        {order.tracking_number && (
          <div>
            <h2 className="text-sm text-graphite">Tracking</h2>
            <p className="mt-2">
              {order.tracking_carrier && `${order.tracking_carrier} — `}
              {order.tracking_number}
            </p>
            {order.tracking_url && (
              <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="link text-sm">
                Track shipment
              </a>
            )}
          </div>
        )}
        <div>
          <h2 className="text-sm text-graphite">Placed</h2>
          <p className="mt-2">{formatDateTime(order.created_at)}</p>
        </div>
      </div>
    </div>
  );
}
