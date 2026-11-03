import { useId } from 'react';

/** Labelled form control with an accessible error message. */
export function Field({ label, error, hint, as = 'input', className = '', children, optional, ...props }) {
  const id = useId();
  const Comp = as;
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {optional && <span className="ml-1 font-normal text-graphite">(optional)</span>}
      </label>
      <Comp id={id} className="field" aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props}>
        {children}
      </Comp>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-[0.8125rem] text-graphite">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, error, className = '', ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input id={id} type="checkbox" className="mt-0.5 size-[1.125rem] shrink-0 accent-ink" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} {...props} />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Shows a form-level error summary that screen readers announce. */
export function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}
