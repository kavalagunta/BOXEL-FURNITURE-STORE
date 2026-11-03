import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Field, Checkbox, FormError } from './ui/Field.jsx';
import { Spinner } from './ui/States.jsx';
import { post } from '../services/api.js';
import { isEmail } from '../utils/validation.js';

const TOPICS = ['Product question', 'Order support', 'Bulk or society enquiry', 'Partnership', 'Other'];
const EMPTY = { topic: TOPICS[0], name: '', email: '', phone: '', message: '', consent: false, website: '' };

/** Shows success only after the server has stored the enquiry. */
export default function ContactForm({ defaultTopic }) {
  const [form, setForm] = useState({ ...EMPTY, topic: defaultTopic || TOPICS[0] });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [formError, setFormError] = useState('');
  const [reference, setReference] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your name.';
    if (!isEmail(form.email)) e.email = 'Enter a valid email address.';
    if (form.message.trim().length < 10) e.message = 'Tell us a little more (at least 10 characters).';
    if (!form.consent) e.consent = 'Please agree so we can reply to you.';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) return;
    setStatus('sending');
    try {
      const res = await post('/enquiries', form);
      setReference(res.reference);
      setStatus('sent');
      setForm({ ...EMPTY });
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      setStatus('idle');
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {status === 'sent' ? (
        <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-sm border border-hairline bg-white p-8" role="status">
          <CheckCircle2 className="size-8 text-success" strokeWidth={1.5} aria-hidden />
          <h3 className="mt-4 text-title font-medium">Message received</h3>
          <p className="mt-2 text-graphite">
            Thank you. Your reference is <strong className="font-semibold text-ink">{reference}</strong>. We will reply as soon as possible.
          </p>
          <button type="button" className="link mt-6 text-sm font-medium" onClick={() => setStatus('idle')}>
            Send another message
          </button>
        </motion.div>
      ) : (
        <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
          <Field label="Topic" as="select" value={form.topic} onChange={set('topic')} className="sm:col-span-2" error={errors.topic}>
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Field>
          <Field label="Name" value={form.name} onChange={set('name')} autoComplete="name" error={errors.name} required />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" error={errors.email} required />
          <Field label="Phone" optional type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" error={errors.phone} className="sm:col-span-2" />
          <Field label="Message" as="textarea" value={form.message} onChange={set('message')} error={errors.message} className="sm:col-span-2" rows={5} required maxLength={4000} />
          {/* Honeypot for bots — hidden from people and assistive tech. */}
          <div className="hidden" aria-hidden>
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
            </label>
          </div>
          <Checkbox
            className="sm:col-span-2"
            checked={form.consent}
            onChange={set('consent')}
            error={errors.consent}
            label={
              <>
                I agree that boxel may use these details to reply to my message, as described in the{' '}
                <Link to="/privacy-policy" className="link">
                  privacy policy
                </Link>
                .
              </>
            }
          />
          <div className="sm:col-span-2">
            <FormError message={formError} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={status === 'sending'}>
              {status === 'sending' ? <Spinner className="size-4" label="Sending" /> : null}
              {status === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
