import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'size-5', label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={`${className} animate-spin`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="size-6 text-graphite" />
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-hairline px-6 py-12 sm:items-center sm:text-center">
      <span className="tile text-2xl" aria-hidden />
      <h2 className="text-title font-medium">{title}</h2>
      {body && <p className="max-w-md text-graphite">{body}</p>}
      {action && (
        <Link to={action.to} className="btn btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-hairline bg-stone px-6 py-10 sm:items-center sm:text-center">
      <h2 className="text-lg font-medium">This section could not load</h2>
      <p className="max-w-md text-graphite">{error?.message || 'Check your connection and try again.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm mt-1">
          Try again
        </button>
      )}
    </div>
  );
}
