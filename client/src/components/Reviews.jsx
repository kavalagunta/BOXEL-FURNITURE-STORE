import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { BadgeCheck } from 'lucide-react';
import { Stars, StarInput } from './ProductBits.jsx';
import { Field, FormError } from './ui/Field.jsx';
import { get, post } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../utils/format.js';

function ReviewForm({ slug }) {
  const { customer } = useAuth();
  const [form, setForm] = useState({ rating: 0, title: '', body: '', displayName: customer?.name?.split(' ')[0] || '' });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: 'idle', message: '' });

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!form.rating) v.rating = 'Choose a rating from 1 to 5.';
    if (form.title.trim().length < 2) v.title = 'Add a short title.';
    if (form.body.trim().length < 10) v.body = 'Write at least 10 characters.';
    if (form.displayName.trim().length < 2) v.displayName = 'Enter the name to show with your review.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setState({ status: 'sending', message: '' });
    try {
      const res = await post(`/products/${slug}/reviews`, form);
      setState({ status: 'done', message: res.message });
    } catch (err) {
      setErrors(err.fields || {});
      setState({ status: 'idle', message: err.message });
    }
  };

  if (state.status === 'done') {
    return (
      <p role="status" className="rounded-sm bg-stone p-5">
        {state.message}
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <StarInput value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} error={errors.rating} />
      <Field label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} error={errors.title} maxLength={150} />
      <Field label="Your review" as="textarea" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} error={errors.body} maxLength={3000} />
      <Field label="Display name" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} error={errors.displayName} maxLength={80} hint="Shown publicly with your review." />
      <FormError message={state.message} />
      <div>
        <button type="submit" className="btn btn-primary" disabled={state.status === 'sending'}>
          {state.status === 'sending' ? 'Submitting…' : 'Submit review'}
        </button>
        <p className="mt-3 text-sm text-graphite">Reviews are published after a quick check by our team.</p>
      </div>
    </form>
  );
}

/** Only approved reviews are shown; the summary is calculated from them alone. */
export default function Reviews({ product }) {
  const { customer } = useAuth();
  const { pathname } = useLocation();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [writing, setWriting] = useState(false);
  const rating = product.rating;
  const total = rating?.count || 0;

  const load = (page = 1) =>
    get(`/products/${product.slug}/reviews?page=${page}`)
      .then((d) => {
        setItems((prev) => (page === 1 ? d.items : [...prev, ...d.items]));
        setMeta(d.meta);
      })
      .catch(() => {});

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  return (
    <section className="border-t border-hairline py-16 sm:py-20" aria-labelledby="reviews-title">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="reviews-title" className="text-headline font-light">
            Reviews
          </h2>
          {total > 0 ? (
            <div className="mt-6">
              <p className="flex items-baseline gap-3">
                <span className="text-5xl font-light tracking-tight">{rating.average.toFixed(1)}</span>
                <span className="text-graphite">out of 5</span>
              </p>
              <Stars value={rating.average} className="mt-2 size-5" />
              <p className="mt-2 text-sm text-graphite">
                Based on {total} approved review{total === 1 ? '' : 's'}
              </p>
              <ul className="mt-6 space-y-2" aria-label="Rating breakdown">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = product.ratingBreakdown?.[n] || 0;
                  return (
                    <li key={n} className="flex items-center gap-3 text-sm">
                      <span className="w-8 tabular-nums">{n} ★</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-2">
                        <span className="block h-full bg-ink" style={{ width: `${(c / total) * 100}%` }} />
                      </span>
                      <span className="w-6 text-right tabular-nums text-graphite">{c}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-graphite">No reviews yet. If you own this product, tell others what you think.</p>
          )}
          <div className="mt-8">
            {product.availability === 'coming_soon' ? null : customer ? (
              !writing && (
                <button type="button" className="btn btn-secondary" onClick={() => setWriting(true)}>
                  Write a review
                </button>
              )
            ) : (
              <Link to={`/login?next=${encodeURIComponent(pathname)}`} className="btn btn-secondary">
                Sign in to write a review
              </Link>
            )}
          </div>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          {writing && (
            <div className="mb-12 rounded-sm border border-hairline p-6 sm:p-8">
              <h3 className="mb-6 text-title font-medium">Your review</h3>
              <ReviewForm slug={product.slug} />
            </div>
          )}
          {items.length > 0 && (
            <ul className="divide-y divide-hairline border-y border-hairline">
              {items.map((r) => (
                <li key={r.id} className="py-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    <h3 className="font-medium">{r.title}</h3>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-graphite">{r.body}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-graphite">
                    <span className="text-ink">{r.display_name}</span>
                    {r.is_verified_purchase ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <BadgeCheck className="size-4" aria-hidden /> Verified purchase
                      </span>
                    ) : null}
                    <span>{formatDate(r.created_at)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {meta && meta.page < meta.pages && (
            <button type="button" className="btn btn-secondary mt-6" onClick={() => load(meta.page + 1)}>
              Show more reviews
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
