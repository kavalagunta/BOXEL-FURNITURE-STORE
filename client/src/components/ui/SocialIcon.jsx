// Simple outline glyphs (Lucide v1 no longer ships brand icons).
const ICONS = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="m10 9 5 3-5 3z" fill="currentColor" />
    </>
  ),
  facebook: <path d="M14 21v-7.5h2.6l.4-3H14V8.7c0-.9.3-1.5 1.5-1.5H17V4.5c-.3 0-1.2-.1-2.3-.1-2.3 0-3.7 1.4-3.7 3.9v2.2H8.5v3H11V21" />,
  x: (
    <>
      <path d="M4 4h4.2L20 20h-4.2z" />
      <path d="m19.5 4-6.6 7.2M4.5 20l6.6-7.2" />
    </>
  ),
};

export const SOCIAL_LABELS = { instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook', x: 'X' };

export default function SocialIcon({ platform, className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[platform]}
    </svg>
  );
}
