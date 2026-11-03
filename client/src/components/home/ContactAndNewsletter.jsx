import { useState } from 'react';
import { Link } from 'react-router';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import Reveal from '../ui/Reveal.jsx';
import ContactForm from '../ContactForm.jsx';
import { Checkbox } from '../ui/Field.jsx';
import { useSite } from '../../context/SiteContext.jsx';
import { post } from '../../services/api.js';
import { isEmail } from '../../utils/validation.js';
import { formatPhone, telHref, whatsappHref } from '../../utils/format.js';

export function ContactDetails({ dark = false }) {
  const { s } = useSite();
  const row = `flex items-center gap-4 py-4 border-b ${dark ? 'border-white/15' : 'border-hairline'}`;
  const muted = dark ? 'text-white/60' : 'text-graphite';
  return (
    <ul className={`border-t ${dark ? 'border-white/15' : 'border-hairline'}`}>
      <li className={row}>
        <Phone className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
        <div>
          <p className={`text-sm ${muted}`}>Phone</p>
          <a href={telHref(s.business_phone)} className="text-lg hover:underline">
            {formatPhone(s.business_phone)}
          </a>
        </div>
      </li>
      {s.business_whatsapp && (
        <li className={row}>
          <MessageCircle className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          <div>
            <p className={`text-sm ${muted}`}>WhatsApp</p>
            <a href={whatsappHref(s.business_whatsapp, 'Hi boxel, I have a question.')} target="_blank" rel="noopener noreferrer" className="text-lg hover:underline">
              {formatPhone(s.business_whatsapp)}
            </a>
          </div>
        </li>
      )}
      {s.business_email && (
        <li className={row}>
          <Mail className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0">
            <p className={`text-sm ${muted}`}>Email</p>
            <a href={`mailto:${s.business_email}`} className="break-all text-lg hover:underline">
              {s.business_email}
            </a>
          </div>
        </li>
      )}
    </ul>
  );
}

/* M — contact CTA ------------------------------------------------------- */
export function ContactSection() {
  return (
    <section className="relative overflow-hidden bg-charcoal py-20 text-white sm:py-28 lg:py-32" aria-labelledby="contact-title" id="contact">
      <div aria-hidden className="pointer-events-none absolute -right-48 -top-48 size-[40rem] rounded-full bg-[radial-gradient(circle,rgb(241_126_0/0.13),transparent_62%)]" />
      <div className="shell relative grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <h2 id="contact-title" className="text-headline font-light">
            Talk to us
          </h2>
          <p className="mt-4 max-w-[46ch] text-lead text-white/65">Ask about fitting a drop box at your entrance, orders for your housing society, or anything else.</p>
          <div className="mt-10">
            <ContactDetails dark />
          </div>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-7">
          <div className="rounded-md bg-white p-6 text-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)] sm:p-8 lg:p-10">
            <ContactForm />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* N — newsletter -------------------------------------------------------- */
export function Newsletter() {
  const { s } = useSite();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState({ status: 'idle', message: '', errors: {} });
  if (s.newsletter_enabled === false) return null;

  const submit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!isEmail(email)) errors.email = 'Enter a valid email address.';
    if (!consent) errors.consent = 'Please confirm you would like to receive updates.';
    if (Object.keys(errors).length) return setState({ status: 'idle', message: '', errors });
    setState({ status: 'sending', message: '', errors: {} });
    try {
      const res = await post('/newsletter', { email, consent });
      setState({ status: 'done', message: res.message, errors: {} });
      setEmail('');
      setConsent(false);
    } catch (err) {
      setState({ status: 'idle', message: err.message, errors: err.fields || {} });
    }
  };

  return (
    <section className="grain bg-sand py-16 sm:py-20" aria-labelledby="news-title">
      <div className="shell relative z-[2]">
      <div className="relative grid gap-8 overflow-hidden rounded-[1.5rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-10 lg:grid-cols-12 lg:items-center">
        <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(241_126_0/0.12),transparent_65%)]" />
        <div className="relative lg:col-span-5">
          <div className="mb-5 flex items-end gap-1 text-xl" aria-hidden><span className="tile bg-sand-2" /><span className="tile mb-[0.4em] bg-sand-2" /><span className="tile" /></div>
          <h2 id="news-title" className="text-title font-medium">
            Hear about new boxel products first
          </h2>
          <p className="mt-2 text-graphite">An occasional email when something new launches. No spam.</p>
        </div>
        <form onSubmit={submit} noValidate className="relative lg:col-span-7">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field flex-1"
              aria-invalid={state.errors.email ? 'true' : undefined}
              aria-describedby="newsletter-status"
            />
            <button type="submit" className="btn btn-primary" disabled={state.status === 'sending'}>
              {state.status === 'sending' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </div>
          <Checkbox
            className="mt-4"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            error={state.errors.consent}
            label={
              <>
                Send me product updates by email. I can unsubscribe any time. See our{' '}
                <Link to="/privacy-policy" className="link">
                  privacy policy
                </Link>
                .
              </>
            }
          />
          <p id="newsletter-status" className={`mt-3 min-h-5 text-sm ${state.status === 'done' ? 'text-success' : 'text-danger'}`} role="status">
            {state.errors.email || state.message}
          </p>
        </form>
      </div>
      </div>
    </section>
  );
}
