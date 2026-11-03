import { useSearchParams } from 'react-router';
import { BadgeCheck, Trash2 } from 'lucide-react';
import { PageHeader, Card, Pagination, Select, StatusBadge, Toolbar } from '../components/ui.jsx';
import { ErrorState, PageLoader } from '../../components/ui/States.jsx';
import { Stars } from '../../components/ProductBits.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAdmin, can } from '../AdminAuth.jsx';
import { del, patch, qs } from '../../services/api.js';
import { formatDateTime } from '../../utils/format.js';

export default function Reviews() {
  const [params, setParams] = useSearchParams();
  const { admin } = useAdmin();
  const toast = useToast();
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };
  const { data, loading, error, reload } = useApi(`/admin/reviews${qs({ status: params.get('status'), rating: params.get('rating'), page: params.get('page') })}`);

  const act = async (fn, msg) => {
    try {
      await fn();
      toast.success(msg);
      reload();
    } catch (ex) {
      toast.error(ex.message);
    }
  };

  return (
    <>
      <PageHeader title="Reviews" description="Only approved reviews appear on the site and count towards ratings." />
      {error && <ErrorState error={error} onRetry={reload} />}
      <Card padded={false}>
        <Toolbar>
          <Select label="Moderation status" value={params.get('status') || ''} onChange={(v) => set('status', v)} options={[{ value: '', label: 'All reviews' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
          <Select label="Rating" value={params.get('rating') || ''} onChange={(v) => set('rating', v)} options={[{ value: '', label: 'Any rating' }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} stars` }))]} />
        </Toolbar>
        {loading && !data ? (
          <PageLoader />
        ) : data?.items.length === 0 ? (
          <p className="p-10 text-center text-graphite">No reviews to show.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {data?.items.map((r) => (
              <li key={r.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars value={r.rating} />
                    <p className="font-medium">{r.title}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-2 max-w-[80ch] whitespace-pre-line text-sm">{r.body}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-graphite">
                    <span>
                      {r.display_name} ({r.customer_email || 'deleted account'})
                    </span>
                    {r.is_verified_purchase ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <BadgeCheck className="size-3.5" aria-hidden /> Verified purchase
                      </span>
                    ) : null}
                    <span>on {r.product_name}</span>
                    <span>{formatDateTime(r.created_at)}</span>
                    {r.moderated_by && <span>· moderated by {r.moderated_by}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {r.status !== 'approved' && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => act(() => patch(`/admin/reviews/${r.id}`, { status: 'approved' }), 'Review approved.')}>
                      Approve
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(() => patch(`/admin/reviews/${r.id}`, { status: 'rejected' }), 'Review rejected.')}>
                      Reject
                    </button>
                  )}
                  {can(admin, 'products') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm px-2.5 text-danger"
                      onClick={() => window.confirm('Delete this review permanently?') && act(() => del(`/admin/reviews/${r.id}`), 'Review deleted.')}
                      aria-label="Delete review"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination meta={data?.meta} onPage={(p) => set('page', String(p))} />
      </Card>
    </>
  );
}
