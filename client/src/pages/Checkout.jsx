import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Lock } from 'lucide-react';
import Seo from '../components/ui/Seo.jsx';
import Logo from '../components/ui/Logo.jsx';
import { Field, Checkbox, FormError } from '../components/ui/Field.jsx';
import { Totals } from '../components/CartDrawer.jsx';
import { Spinner } from '../components/ui/States.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSite } from '../context/SiteContext.jsx';
import { get, post } from '../services/api.js';
import { formatINR, PAYMENT_METHOD, uuid } from '../utils/format.js';
import { INDIAN_STATES, isEmail, isIndianMobile, isPincode } from '../utils/validation.js';

const EMPTY = { fullName: '', email: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', deliveryInstructions: '', orderNotes: '' };

const PAYMENT_HELP = {
  cod: 'Pay in cash when your order is delivered.',
  bank_transfer: 'Our team contacts you with payment details after you place the order. We start production once payment is received.',
};

export default function Checkout() {
  const { lines, quote, quoting, items, clear } = useCart();
  const { customer, ready } = useAuth();
  const { paymentMethods, s, loaded } = useSite();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [addresses, setAddresses] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // One key per checkout visit: retries of the same submission can never create a second order.
  const idempotencyKey = useRef(uuid());
  const errorRef = useRef(null);

  // Authentication gate: redirect unauthenticated guests to login/register
  useEffect(() => {
    if (ready && !customer) {
      navigate('/login?next=/checkout', { replace: true });
    }
  }, [ready, customer, navigate]);

  const applyAddress = (a) =>
    setForm((f) => ({ ...f, fullName: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state, pincode: a.pincode }));

  useEffect(() => {
    if (!customer) return;
    setForm((f) => ({ ...f, fullName: f.fullName || customer.name, email: f.email || customer.email, phone: f.phone || customer.phone || '' }));
    get('/account/addresses')
      .then((d) => {
        setAddresses(d.items);
        const def = d.items.find((a) => a.is_default) || d.items[0];
        if (def) applyAddress(def);
      })
      .catch(() => {});
  }, [customer]);

  useEffect(() => {
    if (!paymentMethod && paymentMethods.length) setPaymentMethod(paymentMethods[0]);
  }, [paymentMethods, paymentMethod]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (form.fullName.trim().length < 2) e.fullName = 'Enter your full name.';
    if (!isEmail(form.email)) e.email = 'Enter a valid email address.';
    if (!isIndianMobile(form.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (form.line1.trim().length < 3) e.line1 = 'Enter your house number and street.';
    if (form.city.trim().length < 2) e.city = 'Enter your city.';
    if (!form.state) e.state = 'Choose your state or union territory.';
    if (!isPincode(form.pincode)) e.pincode = 'Enter a valid 6-digit PIN code.';
    if (!paymentMethod) e.paymentMethod = 'Choose a payment method.';
    return e;
  };

  const blocked = !quote || !quote.purchasable || quoting;
  const noPayment = loaded && paymentMethods.length === 0;

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const v = validate();
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) {
      setFormError('Please check the highlighted fields.');
      setTimeout(() => errorRef.current?.focus(), 0);
      return;
    }
    setSubmitting(true);
    try {
      const res = await post('/orders', {
        ...form,
        country: 'India',
        paymentMethod,
        saveAddress: Boolean(customer && saveAddress),
        idempotencyKey: idempotencyKey.current,
        expectedTotal: quote.total,
        items: items.map(({ variantId, quantity }) => ({ variantId, quantity })),
      });
      clear();
      navigate(`/order-success/${res.orderNumber}`, { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.code === 'CART_CHANGED' ? `${err.message} ${(err.details || []).map((d) => d.message).join(' ')}` : err.message);
      setSubmitting(false);
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  };

  const summary = useMemo(
    () =>
      lines.map((l) => (
        <li key={l.variantId} className="flex gap-4 py-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-sm bg-[linear-gradient(180deg,var(--color-studio-top),var(--color-studio-floor))]">
            {l.imageUrl && <img src={l.imageUrl} alt="" className="size-full object-cover" />}
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-[0.6875rem] text-white">{l.quantity}</span>
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{l.name}</p>
            <p className="text-graphite">
              {l.variantName} · Qty {l.quantity}
            </p>
            {l.issue && <p className="text-danger">Not available to order</p>}
          </div>
          <p className="text-sm font-medium tabular-nums">{l.lineTotal !== undefined && !l.issue ? formatINR(l.lineTotal) : '—'}</p>
        </li>
      )),
    [lines],
  );

  if (!lines.length) {
    return (
      <section className="shell py-20">
        <Seo title="Checkout" noindex />
        <h1 className="text-display font-light">Checkout</h1>
        <p className="mt-4 text-graphite">Your cart is empty.</p>
        <Link to="/products" className="btn btn-primary mt-6">
          Browse products
        </Link>
      </section>
    );
  }

  return (
    <>
      <Seo title="Checkout" noindex />
      <section className="shell pb-24 pt-10 sm:pt-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-display font-light">Checkout</h1>
          <p className="flex items-center gap-2 text-sm text-graphite">
            <Lock className="size-4" aria-hidden /> Secure checkout with <Logo asLink={false} className="h-4 w-auto" />
          </p>
        </div>
        {!customer && (
          <p className="mt-4 text-graphite">
            Checking out as a guest.{' '}
            <Link to="/login?next=/checkout" className="link text-ink">
              Sign in
            </Link>{' '}
            to use saved addresses and track orders in your account.
          </p>
        )}

        <form onSubmit={submit} noValidate className="mt-10 grid gap-12 lg:grid-cols-12">
          <div className="space-y-12 lg:col-span-7">
            <fieldset className="grid gap-5 sm:grid-cols-2">
              <legend className="mb-6 text-title font-medium">Contact</legend>
              <Field label="Full name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} autoComplete="name" className="sm:col-span-2" maxLength={120} />
              <Field label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" hint="Your order confirmation is sent here." />
              <Field label="Mobile number" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" placeholder="98450 12345" hint="10-digit Indian mobile number." />
            </fieldset>

            <fieldset className="grid gap-5 sm:grid-cols-2">
              <legend className="mb-6 text-title font-medium">Delivery address</legend>
              {addresses.length > 0 && (
                <Field
                  label="Saved addresses"
                  as="select"
                  className="sm:col-span-2"
                  onChange={(e) => {
                    const a = addresses.find((x) => String(x.id) === e.target.value);
                    if (a) applyAddress(a);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose a saved address
                  </option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label ? `${a.label} — ` : ''}
                      {a.line1}, {a.city} {a.pincode}
                    </option>
                  ))}
                </Field>
              )}
              <Field label="Address line 1" value={form.line1} onChange={set('line1')} error={errors.line1} autoComplete="address-line1" placeholder="House / flat number, building, street" className="sm:col-span-2" maxLength={200} />
              <Field label="Address line 2" optional value={form.line2} onChange={set('line2')} autoComplete="address-line2" placeholder="Area, landmark" className="sm:col-span-2" maxLength={200} />
              <Field label="City" value={form.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" maxLength={100} />
              <Field label="PIN code" inputMode="numeric" value={form.pincode} onChange={set('pincode')} error={errors.pincode} autoComplete="postal-code" maxLength={7} />
              <Field label="State" as="select" value={form.state} onChange={set('state')} error={errors.state} autoComplete="address-level1">
                <option value="">Choose…</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st}>{st}</option>
                ))}
              </Field>
              <Field label="Country" value="India" readOnly disabled hint="We deliver within India." />
              <Field label="Delivery instructions" optional as="textarea" rows={3} value={form.deliveryInstructions} onChange={set('deliveryInstructions')} className="sm:col-span-2" maxLength={500} placeholder="Gate code, best time to deliver, where to place the box" />
              <Field label="Order notes" optional as="textarea" rows={3} value={form.orderNotes} onChange={set('orderNotes')} className="sm:col-span-2" maxLength={1000} />
              {customer && <Checkbox className="sm:col-span-2" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} label="Save this address to my account" />}
            </fieldset>

            <fieldset>
              <legend className="mb-6 text-title font-medium">Payment</legend>
              {noPayment ? (
                <p className="rounded-sm bg-stone p-5">
                  Online ordering is not open yet. Please <Link to="/contact" className="link">contact us</Link> or call {s.business_phone} to place your order.
                </p>
              ) : (
                <div className="space-y-3" role="radiogroup" aria-describedby={errors.paymentMethod ? 'pm-err' : undefined}>
                  {paymentMethods.map((m) => (
                    <label key={m} className={`flex cursor-pointer gap-4 rounded-sm border p-5 transition-colors ${paymentMethod === m ? 'border-ink' : 'border-hairline hover:border-graphite'}`}>
                      <input type="radio" name="payment" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} className="mt-1 size-4 accent-ink" />
                      <span>
                        <span className="block font-medium">{PAYMENT_METHOD[m]}</span>
                        <span className="mt-1 block text-sm text-graphite">{m === 'bank_transfer' ? s.bank_transfer_instructions || PAYMENT_HELP[m] : PAYMENT_HELP[m]}</span>
                      </span>
                    </label>
                  ))}
                  <div className="flex gap-4 rounded-sm border border-dashed border-hairline p-5 text-graphite" aria-disabled="true">
                    <input type="radio" disabled className="mt-1 size-4" aria-label="Online payment (not available yet)" />
                    <span>
                      <span className="block font-medium">Online payment</span>
                      <span className="mt-1 block text-sm">Card and UPI payments are not available yet.</span>
                    </span>
                  </div>
                  {errors.paymentMethod && (
                    <p id="pm-err" className="field-error">
                      {errors.paymentMethod}
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          </div>

          <aside className="lg:col-span-5" aria-labelledby="co-summary">
            <div className="rounded-sm bg-stone p-6 sm:p-8 lg:sticky lg:top-24">
              <h2 id="co-summary" className="flex items-center justify-between text-title font-medium">
                Your order {quoting && <Spinner className="size-4 text-graphite" label="Updating prices" />}
              </h2>
              <ul className="mt-4 divide-y divide-hairline border-y border-hairline">{summary}</ul>
              <div className="mt-6" aria-live="polite">
                {quote ? <Totals quote={quote} /> : <div className="skeleton h-28" aria-hidden />}
              </div>
              {quote && !quote.purchasable && (
                <ul className="mt-4 space-y-1 text-sm text-danger" role="alert">
                  {quote.issues.map((i) => (
                    <li key={`${i.variantId}-${i.code}`}>{i.message}</li>
                  ))}
                  <li>
                    <Link to="/cart" className="link">
                      Update your cart
                    </Link>
                  </li>
                </ul>
              )}
              <div ref={errorRef} tabIndex={-1} className="mt-6 outline-none">
                <FormError message={formError} />
              </div>
              <button type="submit" className="btn btn-primary mt-4 w-full" disabled={submitting || blocked || noPayment}>
                {submitting && <Spinner className="size-4" label="Placing order" />}
                {submitting ? 'Placing your order…' : quote ? `Place Order (COD) — ${formatINR(quote.total)}` : 'Place Order (COD)'}
              </button>
              <p className="mt-4 text-[0.8125rem] leading-relaxed text-graphite">
                By placing your order you agree to our{' '}
                <Link to="/terms" className="link">
                  terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="link">
                  privacy policy
                </Link>
                . Your order is marked as paid only after payment is received.
              </p>
            </div>
          </aside>
        </form>
      </section>
    </>
  );
}
