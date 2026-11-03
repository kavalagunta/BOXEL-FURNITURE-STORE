import { Link } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import Seo from '../components/ui/Seo.jsx';
import Breadcrumbs from '../components/ui/Breadcrumbs.jsx';
import { CartLine, Totals } from '../components/CartDrawer.jsx';
import { Spinner } from '../components/ui/States.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useSite } from '../context/SiteContext.jsx';
import { shippingNote } from '../utils/format.js';

export default function Cart() {
  const { lines, quote, quoting, count, clear } = useCart();
  const { s, paymentMethods } = useSite();
  const blocked = quote && !quote.purchasable;

  return (
    <>
      <Seo title="Your cart" noindex />
      <section className="shell pb-24 pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />
        <h1 className="mt-6 text-display font-light">Your cart</h1>

        {lines.length === 0 ? (
          <div className="mt-10 rounded-sm bg-stone px-6 py-14 sm:px-12">
            <span className="tile text-2xl" aria-hidden />
            <h2 className="mt-5 text-title font-medium">Your cart is empty</h2>
            <p className="mt-2 text-graphite">Add a product to see it here.</p>
            <Link to="/products" className="btn btn-primary mt-6">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between border-b border-hairline pb-4 text-sm text-graphite">
                <span>
                  {count} item{count === 1 ? '' : 's'}
                </span>
                <button type="button" onClick={clear} className="hover:text-ink hover:underline">
                  Empty cart
                </button>
              </div>
              <ul className="divide-y divide-hairline border-b border-hairline">
                <AnimatePresence initial={false}>
                  {lines.map((l) => (
                    <CartLine key={l.variantId} line={l} />
                  ))}
                </AnimatePresence>
              </ul>
              <Link to="/products" className="link mt-6 inline-block text-sm font-medium">
                Continue shopping
              </Link>
            </div>

            <aside className="lg:col-span-5" aria-labelledby="summary-title">
              <div className="rounded-sm bg-stone p-6 sm:p-8 lg:sticky lg:top-24">
                <h2 id="summary-title" className="flex items-center justify-between text-title font-medium">
                  Order summary {quoting && <Spinner className="size-4 text-graphite" label="Updating prices" />}
                </h2>
                <div className="mt-6" aria-live="polite">
                  {quote ? <Totals quote={quote} /> : <div className="skeleton h-28" aria-hidden />}
                </div>
                <p className="mt-4 text-sm text-graphite">{shippingNote(s)}. Prices are confirmed against live stock at checkout.</p>
                {blocked && (
                  <ul className="mt-4 space-y-1 text-sm text-danger" role="alert">
                    {quote.issues.map((i) => (
                      <li key={`${i.variantId}-${i.code}`}>{i.message}</li>
                    ))}
                  </ul>
                )}
                {paymentMethods.length === 0 && (
                  <p className="mt-4 rounded-sm bg-white p-4 text-sm">
                    Online ordering is not open yet. <Link to="/contact" className="link">Contact us</Link> to place an order.
                  </p>
                )}
                <Link
                  to="/checkout"
                  className={`btn btn-primary mt-6 w-full ${!quote || blocked || paymentMethods.length === 0 ? 'pointer-events-none opacity-45' : ''}`}
                  aria-disabled={!quote || blocked || paymentMethods.length === 0}
                  tabIndex={!quote || blocked || paymentMethods.length === 0 ? -1 : undefined}
                >
                  Proceed to checkout
                </Link>
              </div>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
