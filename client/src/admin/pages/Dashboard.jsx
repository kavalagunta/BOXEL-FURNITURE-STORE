import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { PageHeader, Card, StatusBadge, Table } from '../components/ui.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAdmin } from '../AdminAuth.jsx';
import { formatINR, formatDate, formatDateTime, ORDER_STATUS } from '../../utils/format.js';

function Stat({ label, value, note, to }) {
  const inner = (
    <>
      <p className="text-[0.8125rem] text-graphite">{label}</p>
      <p className="mt-2 text-[1.75rem] font-light leading-none tracking-tight tabular-nums">{value}</p>
      {note && <p className="mt-2 text-[0.75rem] text-graphite">{note}</p>}
    </>
  );
  const cls = 'block rounded-md border border-hairline bg-white p-5';
  return to ? (
    <Link to={to} className={`${cls} transition-colors hover:border-ink`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

const compactINR = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${Math.round(n)}`);

/** 30-day order value — one series, one hue, rounded data-ends on a shared baseline, hover tooltip per bar. */
function SalesChart({ sales }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...sales.map((d) => d.value), 1);
  const nice = (() => {
    const p = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / p) * p;
  })();
  const W = 720;
  const H = 220;
  const pad = { l: 44, r: 8, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / sales.length;
  const bw = Math.max(4, step - 2);
  const ticks = [0, nice / 2, nice];
  const totalValue = sales.reduce((s, d) => s + d.value, 0);
  const totalOrders = sales.reduce((s, d) => s + d.orders, 0);

  return (
    <div>
      <p className="mb-4 text-sm text-graphite">
        {formatINR(totalValue)} across {totalOrders} order{totalOrders === 1 ? '' : 's'} in the last 30 days (excludes cancelled orders)
      </p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily order value for the last 30 days" onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => {
            const y = pad.t + ih - (t / nice) * ih;
            return (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#E8E8E5" strokeWidth="1" />
                <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#707070">
                  {compactINR(t)}
                </text>
              </g>
            );
          })}
          {sales.map((d, i) => {
            const h = (d.value / nice) * ih;
            const x = pad.l + i * step + (step - bw) / 2;
            const y = pad.t + ih - h;
            const r = Math.min(4, bw / 2, h);
            return (
              <g key={d.day} onPointerEnter={() => setHover(i)}>
                {/* Hit target spans the full column height, larger than the mark. */}
                <rect x={pad.l + i * step} y={pad.t} width={step} height={ih} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + h} Z`}
                    fill={hover === i ? '#171717' : '#3d3d3b'}
                  />
                )}
                {(i % 5 === 0 || i === sales.length - 1) && (
                  <text x={pad.l + i * step + step / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#707070">
                    {formatDate(`${d.day}T00:00:00+05:30`, { day: 'numeric', month: 'short' })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded bg-ink px-3 py-2 text-[0.75rem] text-white shadow-lg"
            style={{ left: `${((pad.l + hover * step + step / 2) / W) * 100}%` }}
          >
            <p className="font-medium">{formatDate(`${sales[hover].day}T00:00:00+05:30`, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <p>{formatINR(sales[hover].value)}</p>
            <p className="text-white/70">
              {sales[hover].orders} order{sales[hover].orders === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-graphite">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-graphite">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 font-medium">Orders</th>
              <th className="py-1 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {sales.filter((d) => d.orders > 0).map((d) => (
              <tr key={d.day} className="border-t border-hairline">
                <td className="py-1">{formatDate(`${d.day}T00:00:00+05:30`)}</td>
                <td className="py-1">{d.orders}</td>
                <td className="py-1 text-right">{formatINR(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Orders by status — a ranked horizontal bar list; labels and counts are text, not color. */
function StatusBars({ dist }) {
  const order = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  const max = Math.max(...order.map((s) => dist[s] || 0), 1);
  return (
    <ul className="space-y-3">
      {order.map((s) => {
        const n = dist[s] || 0;
        return (
          <li key={s} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm" title={`${ORDER_STATUS[s]}: ${n}`}>
            <Link to={`/admin/orders?status=${s}`} className="text-graphite hover:text-ink">
              {ORDER_STATUS[s]}
            </Link>
            <span className="h-2 overflow-hidden rounded-full bg-stone">
              <span className="block h-full rounded-full bg-ink/80" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{n}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function Dashboard() {
  const { admin } = useAdmin();
  const { data, error, loading, reload } = useApi('/admin/dashboard');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  const m = data.metrics;

  return (
    <>
      <PageHeader title={`Hello, ${admin.name.split(' ')[0]}`} description="Every figure below is calculated live from the store database." />

      {data.warnings.length > 0 && (
        <ul className="mb-6 space-y-2">
          {data.warnings.map((w) => (
            <li key={w.message} className="flex items-start gap-3 rounded-md border border-[#f3d3a8] bg-[#fdf6ec] px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#8a4b00]" aria-hidden />
              <span className="flex-1">{w.message}</span>
              {w.link && (
                <Link to={w.link} className="link shrink-0 font-medium">
                  Fix
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total orders" value={m.totalOrders} note={`${m.ordersToday} today`} to="/admin/orders" />
        <Stat label="Pending orders" value={m.pendingOrders} note="Awaiting confirmation" to="/admin/orders?status=pending" />
        <Stat label="Completed orders" value={m.completedOrders} note="Delivered" to="/admin/orders?status=delivered" />
        <Stat label="Registered customers" value={m.customers} to="/admin/customers" />
        <Stat label="Gross order value" value={formatINR(m.grossOrderValue)} note="All orders except cancelled, paid or not" />
        <Stat label="Collected revenue" value={formatINR(m.collectedRevenue)} note="Payments recorded as received" />
        <Stat label="Unread enquiries" value={m.unreadEnquiries} to="/admin/enquiries?status=new" />
        <Stat label="Low-stock variants" value={m.lowStockCount} note={m.pendingReviews ? `${m.pendingReviews} reviews to moderate` : 'Stock-tracked products only'} to={m.pendingReviews ? '/admin/reviews?status=pending' : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Order value over time" className="xl:col-span-2">
          <SalesChart sales={data.sales} />
        </Card>
        <Card title="Orders by status">
          <StatusBars dist={data.statusDistribution} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Recent orders" className="xl:col-span-2" padded={false} actions={<Link to="/admin/orders" className="link text-sm">All orders</Link>}>
          <Table
            rows={data.recentOrders}
            empty="No orders yet."
            columns={[
              { key: 'order_number', label: 'Order', render: (o) => <Link to={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.order_number}</Link> },
              { key: 'customer_name', label: 'Customer' },
              { key: 'created_at', label: 'Placed', render: (o) => formatDateTime(o.created_at) },
              { key: 'status', label: 'Status', render: (o) => <StatusBadge status={o.status} label={ORDER_STATUS[o.status]} /> },
              { key: 'total', label: 'Total', className: 'text-right', render: (o) => formatINR(o.total) },
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card title="Recent enquiries" padded={false} actions={<Link to="/admin/enquiries" className="link text-sm">All</Link>}>
            {data.recentEnquiries.length === 0 ? (
              <p className="p-5 text-sm text-graphite">No enquiries yet.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {data.recentEnquiries.map((e) => (
                  <li key={e.id}>
                    <Link to={`/admin/enquiries?open=${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-stone">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.name}</span>
                        <span className="block truncate text-graphite">{e.topic}</span>
                      </span>
                      <StatusBadge status={e.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {data.lowStock.length > 0 && (
            <Card title="Low stock" padded={false}>
              <ul className="divide-y divide-hairline">
                {data.lowStock.map((v) => (
                  <li key={v.variant_id}>
                    <Link to={`/admin/products/${v.product_id}/edit`} className="flex justify-between gap-3 px-5 py-3 text-sm hover:bg-stone">
                      <span>
                        {v.name} — {v.variant_name}
                      </span>
                      <span className={v.stock_quantity === 0 ? 'text-danger' : ''}>{v.stock_quantity} left</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
