import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import Seo from '../components/ui/Seo.jsx';
import Logo from '../components/ui/Logo.jsx';
import { Field, FormError } from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { post } from '../services/api.js';
import { isEmail, passwordProblem } from '../utils/validation.js';

/** Only allow same-site relative redirects after sign-in. */
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/admin') ? n : '/account');

function AuthShell({ title, intro, children, footer }) {
  return (
    <section className="shell grid min-h-[70vh] place-items-center py-14 sm:py-20">
      <div className="w-full max-w-md">
        <Logo className="h-8 w-auto" />
        <h1 className="mt-10 text-headline font-light">{title}</h1>
        {intro && <p className="mt-3 text-graphite">{intro}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 border-t border-hairline pt-6 text-sm text-graphite">{footer}</div>}
      </div>
    </section>
  );
}

export function Login() {
  const { login, customer, ready } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && customer) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!isEmail(form.email)) v.email = 'Enter a valid email address.';
    if (!form.password) v.password = 'Enter your password.';
    setErrors(v);
    setError('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      intro="Track your orders and check out faster."
      footer={
        <>
          New to boxel?{' '}
          <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`} className="link text-ink">
            Create an account
          </Link>
        </>
      }
    >
      <Seo title="Sign in" noindex />
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
        <FormError message={error} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <Link to="/forgot-password" className="link inline-block text-sm">
          Forgot your password?
        </Link>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { register, customer, ready } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && customer) return <Navigate to={next} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (form.name.trim().length < 2) v.name = 'Enter your name.';
    if (!isEmail(form.email)) v.email = 'Enter a valid email address.';
    const pw = passwordProblem(form.password);
    if (pw) v.password = pw;
    setErrors(v);
    setError('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await register(form);
      navigate(next, { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      intro="Save addresses, track orders and review products you own."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="link text-ink">
            Sign in
          </Link>
        </>
      }
    >
      <Seo title="Create an account" noindex />
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Full name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} maxLength={120} />
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Field label="Mobile number" optional type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Field label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 10 characters, with letters and numbers." />
        <FormError message={error} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-[0.8125rem] text-graphite">
          By creating an account you agree to our <Link to="/terms" className="link">terms</Link> and <Link to="/privacy-policy" className="link">privacy policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '', error: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) return setState({ status: 'idle', message: '', error: 'Enter a valid email address.' });
    setState({ status: 'sending', message: '', error: '' });
    try {
      const res = await post('/auth/forgot-password', { email });
      setState({ status: 'done', message: res.message, error: '' });
    } catch (err) {
      setState({ status: 'idle', message: '', error: err.message });
    }
  };
  return (
    <AuthShell title="Reset your password" intro="Enter the email you used for your account and we will send you a reset link." footer={<Link to="/login" className="link text-ink">Back to sign in</Link>}>
      <Seo title="Reset password" noindex />
      {state.status === 'done' ? (
        <p role="status" className="rounded-sm bg-stone p-5">
          {state.message}
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={state.error} />
          <button type="submit" className="btn btn-primary w-full" disabled={state.status === 'sending'}>
            {state.status === 'sending' ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '', error: '' });
  const submit = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) return setState({ status: 'idle', message: '', error: problem });
    setState({ status: 'sending', message: '', error: '' });
    try {
      const res = await post('/auth/reset-password', { token, password });
      setState({ status: 'done', message: res.message, error: '' });
    } catch (err) {
      setState({ status: 'idle', message: '', error: err.fields?.password || err.message });
    }
  };
  return (
    <AuthShell title="Choose a new password">
      <Seo title="Choose a new password" noindex />
      {state.status === 'done' ? (
        <div role="status" className="space-y-5">
          <p className="rounded-sm bg-stone p-5">{state.message}</p>
          <Link to="/login" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      ) : !/^[a-f0-9]{64}$/.test(token) ? (
        <p className="text-graphite">
          This reset link is incomplete. <Link to="/forgot-password" className="link text-ink">Request a new one</Link>.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={state.error} hint="At least 10 characters, with letters and numbers." />
          <button type="submit" className="btn btn-primary w-full" disabled={state.status === 'sending'}>
            {state.status === 'sending' ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
