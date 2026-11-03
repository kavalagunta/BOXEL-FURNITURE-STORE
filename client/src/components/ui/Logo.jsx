import { Link } from 'react-router';
import { useSite } from '../../context/SiteContext.jsx';

/** The supplied boxel logo, trimmed of its whitespace padding; intrinsic ratio 717 × 271 is preserved. */
export default function Logo({ className = 'h-7 w-auto', to = '/', label, asLink = true, variant = 'dark' }) {
  const { s } = useSite();
  const img = (
    <img
      src={variant === 'light' ? '/images/boxel-logo-white.png' : s.logo_url || '/images/boxel-logo-trimmed.png'}
      alt={label || s.business_name || 'boxel'}
      width="717"
      height="271"
      className={className}
      decoding="async"
    />
  );
  if (!asLink) return img;
  return (
    <Link to={to} className="inline-flex shrink-0 items-center" aria-label={`${s.business_name || 'boxel'} home`}>
      {img}
    </Link>
  );
}
