import { useLocation } from 'react-router';
import { useSite } from '../../context/SiteContext.jsx';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const abs = (u) => (!u ? undefined : /^https?:\/\//.test(u) ? u : `${ORIGIN}${u}`);

/**
 * Per-page metadata using React 19's built-in <title>/<meta>/<link> hoisting.
 * Production HTML is also pre-filled by the server (server/services/seoService.js)
 * so crawlers that do not run JavaScript still get the same tags.
 */
export default function Seo({ title, description, image, type = 'website', noindex = false, jsonLd, canonicalPath }) {
  const { s } = useSite();
  const { pathname } = useLocation();
  const brand = s.business_name || 'boxel';
  const fullTitle = title ? `${title} | ${brand}` : s.seo_default_title || `${brand} — Smart. Safe. Simple.`;
  const desc = description || s.seo_default_description || '';
  const canonical = `${ORIGIN}${canonicalPath || pathname}`;
  const img = abs(image || s.seo_og_image || '/images/parcel-drop-box-front.jpeg');
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={brand} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
      {img && <meta property="og:image" content={img} />}
      <meta name="twitter:card" content="summary_large_image" />
      {blocks.map((b, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(b)}
        </script>
      ))}
    </>
  );
}

export const absUrl = abs;
