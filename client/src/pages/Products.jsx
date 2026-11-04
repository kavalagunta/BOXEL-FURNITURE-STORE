import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import Seo from '../components/ui/Seo.jsx';
import Breadcrumbs, { breadcrumbJsonLd } from '../components/ui/Breadcrumbs.jsx';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { stagger } from '../components/ui/Reveal.jsx';
import { useApi, useDebounced } from '../hooks/useApi.js';
import { qs } from '../services/api.js';

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
];
const AVAIL = [
  { value: 'all', label: 'All products' },
  { value: 'available', label: 'Ready to order' },
  { value: 'coming_soon', label: 'Coming soon' },
];

export default function Products() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const availability = params.get('availability') || 'all';
  const sort = params.get('sort') || 'featured';
  const page = Number(params.get('page')) || 1;
  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounced(search.trim(), 350);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || (k === 'availability' && v === 'all') || (k === 'sort' && v === 'featured') || (k === 'page' && v === 1)) next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('search') || '') !== debounced) update({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => setSearch(params.get('search') || ''), [params]);

  const categories = useApi('/categories');
  const list = useApi(`/products${qs({ search: params.get('search'), category, availability, sort, page, limit: 12 })}`);
  const activeCategory = categories.data?.items.find((c) => c.slug === category);
  const items = list.data?.items || [];
  const meta = list.data?.meta;
  const title = activeCategory ? activeCategory.name : 'Products';
  const crumbs = [{ label: 'Home', to: '/' }, { label: 'Products', to: '/products' }, ...(activeCategory ? [{ label: activeCategory.name }] : [])];

  return (
    <>
      <Seo
        title={activeCategory?.seo_title?.replace(/ — boxel$/, '') || title}
        description={activeCategory?.seo_description || activeCategory?.description || 'Shop boxel products — secure parcel drop boxes, with personal lockers and wall-hung workspaces coming soon.'}
        canonicalPath={category ? `/products?category=${category}` : '/products'}
        jsonLd={breadcrumbJsonLd(crumbs)}
      />
      <section className="shell pb-24 pt-10 sm:pt-14">
        <Breadcrumbs items={crumbs} />
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-display font-light">{title}</h1>
            <p className="mt-3 max-w-[56ch] text-lead text-graphite">
              {activeCategory?.description || 'Smart, safe products for modern Indian living — made to order, with free shipping across India.'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-10 flex flex-col gap-4 border-y border-hairline py-4 lg:flex-row lg:items-center">
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-graphite" aria-hidden />
            <label htmlFor="catalog-search" className="sr-only">
              Search products
            </label>
            <input id="catalog-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="field pl-9" maxLength={80} />
          </div>
          <div className="relative -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-1 lg:pb-0" role="group" aria-label="Filter by category">
            <button type="button" onClick={() => update({ category: '' })} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm ${!category ? 'border-ink bg-ink text-white' : 'border-hairline hover:border-ink'}`} aria-pressed={!category}>
              All
            </button>
            {categories.data?.items.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => update({ category: c.slug })}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm ${category === c.slug ? 'border-ink bg-ink text-white' : 'border-hairline hover:border-ink'}`}
                aria-pressed={category === c.slug}
              >
                {c.name}
                {c.status === 'coming_soon' && <span className="sr-only"> (coming soon)</span>}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:flex">
            <label className="sr-only" htmlFor="avail">
              Availability
            </label>
            <select id="avail" className="field min-h-10 py-2 text-sm" value={availability} onChange={(e) => update({ availability: e.target.value })}>
              {AVAIL.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="sort">
              Sort by
            </label>
            <select id="sort" className="field min-h-10 py-2 text-sm" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-6 text-sm text-graphite" role="status" aria-live="polite">
          {list.loading ? 'Loading products…' : meta ? `${meta.total} product${meta.total === 1 ? '' : 's'}` : ''}
          {params.get('search') && !list.loading && (
            <>
              {' '}
              for “{params.get('search')}”{' '}
              <button type="button" onClick={() => setSearch('')} className="ml-1 inline-flex items-center gap-1 text-ink underline">
                <X className="size-3" aria-hidden /> clear
              </button>
            </>
          )}
        </p>

        <div className="products-listing mt-8 max-sm:-mx-3">
          {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
          {list.loading && !list.data && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,330px))] items-stretch justify-center gap-3 max-sm:grid-cols-2 max-sm:gap-1.5 min-[1280px]:gap-5">
              {[0, 1, 2].map((i) => <ProductCardSkeleton key={i} compact />)}
            </div>
          )}
          {list.data && items.length === 0 && (
            <div className="rounded-sm bg-stone px-6 py-14 sm:px-12">
              <span className="tile text-2xl" aria-hidden />
              {activeCategory?.status === 'coming_soon' || availability === 'coming_soon' ? (
                <>
                  <h2 className="mt-5 text-title font-medium">{activeCategory ? `${activeCategory.name} is coming soon` : 'More products are coming soon'}</h2>
                  <p className="mt-2 max-w-[52ch] text-graphite">
                    These products are being designed and cannot be ordered yet. Contact us to register your interest and we will let you know when they launch.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/contact" className="btn btn-primary">
                      Contact us
                    </Link>
                    <button type="button" onClick={() => update({ category: '', availability: 'all' })} className="btn btn-secondary">
                      See available products
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-5 text-title font-medium">No products match these filters</h2>
                  <p className="mt-2 text-graphite">Try a different search or clear the filters.</p>
                  <button type="button" onClick={() => { setSearch(''); setParams({}, { replace: true }); }} className="btn btn-secondary mt-6">
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
          {items.length > 0 && (
            <motion.div key={params.toString()} className="grid grid-cols-[repeat(auto-fit,minmax(190px,330px))] items-stretch justify-center gap-3 max-sm:grid-cols-2 max-sm:gap-1.5 min-[1280px]:gap-5" variants={stagger} initial="hidden" animate="show">
              {items.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 3} compact />
              ))}
            </motion.div>
          )}
        </div>

        {meta && meta.pages > 1 && (
          <nav className="mt-16 flex items-center justify-center gap-2" aria-label="Pagination">
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
              Previous
            </button>
            <span className="px-3 text-sm text-graphite">
              Page {meta.page} of {meta.pages}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= meta.pages} onClick={() => update({ page: page + 1 })}>
              Next
            </button>
          </nav>
        )}
      </section>
    </>
  );
}
