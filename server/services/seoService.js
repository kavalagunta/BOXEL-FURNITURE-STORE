import { env } from '../config/env.js';
import { query, queryOne } from '../config/db.js';
import { getSettings } from './settingsService.js';
import { escapeHtml as e } from '../utils/helpers.js';

/**
 * Server-rendered <head> metadata for the production build. Crawlers and link previews
 * get correct titles, descriptions, canonical URLs, Open Graph tags and JSON-LD without
 * running JavaScript. The React app replaces these tags after it loads (see client Seo.jsx).
 */
const abs = (url) => (!url ? null : /^https?:\/\//.test(url) ? url : `${env.clientUrl}${url}`);
const json = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

function organization(settings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.business_name || 'boxel',
    url: env.clientUrl,
    logo: abs(settings.logo_url || '/images/boxel-logo-trimmed.png'),
    slogan: settings.business_tagline || undefined,
    contactPoint: settings.business_phone
      ? [{ '@type': 'ContactPoint', telephone: settings.business_phone, contactType: 'customer service', areaServed: 'IN' }]
      : undefined,
  };
}

const NOINDEX = /^\/(admin|account|cart|checkout|order-success|login|register|forgot-password|reset-password)(\/|$)/;

// Every route the React app knows. Anything else is served with HTTP 404 (no soft 404s).
const KNOWN =
  /^\/(about|products|cart|checkout|contact|privacy-policy|terms|shipping-returns|login|register|forgot-password|reset-password|account(\/orders(\/[^/]+)?)?|order-success\/[^/]+|admin(\/.*)?)$/;

const STATIC = {
  '/about': ['About boxel', 'Why boxel exists, what we believe and how we build smart, safe products for modern Indian living.'],
  '/products': ['Products', 'Shop boxel products — secure parcel drop boxes, with personal lockers and wall-hung workspaces coming soon.'],
  '/contact': ['Contact boxel', 'Call or WhatsApp +91 83100 18733, or send us a message.'],
  '/shipping-returns': ['Shipping, delivery & returns', 'Free shipping across India. How made-to-order delivery, returns and warranty work at boxel.'],
  '/privacy-policy': ['Privacy policy', 'How boxel collects and uses your information.'],
  '/terms': ['Terms and conditions', 'Terms that apply to purchases on the boxel website.'],
};

export async function headFor(pathname) {
  const settings = await getSettings();
  const brand = settings.business_name || 'boxel';
  let title = settings.seo_default_title || `${brand} — Smart. Safe. Simple.`;
  let description = settings.seo_default_description || '';
  let image = abs(settings.seo_og_image || '/images/parcel-drop-box-front.jpeg');
  let type = 'website';
  let robots = 'index, follow';
  let status = 200;
  const jsonLd = [];
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/') {
    jsonLd.push(organization(settings), { '@context': 'https://schema.org', '@type': 'WebSite', name: brand, url: env.clientUrl });
  } else if (STATIC[path]) {
    [title, description] = [`${STATIC[path][0]} | ${brand}`, STATIC[path][1]];
  } else if (path.startsWith('/products/')) {
    const slug = decodeURIComponent(path.slice('/products/'.length)).slice(0, 180);
    const p = await queryOne(
      `SELECT p.*, c.name AS category_name, c.status AS category_status,
              (SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS rating_avg,
              (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS review_count
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.slug = ? AND p.status IN ('active','coming_soon') AND c.status <> 'inactive'`,
      [slug],
    );
    if (p) {
      const images = await query('SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [p.id]);
      title = `${p.seo_title || p.name} | ${brand}`;
      description = p.seo_description || p.short_description || description;
      image = abs(p.og_image_url || images[0]?.image_url) || image;
      type = 'product';
      const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
      const product = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        sku: p.sku,
        description: p.short_description || undefined,
        image: images.map((i) => abs(i.image_url)),
        brand: { '@type': 'Brand', name: brand },
        category: p.category_name,
      };
      // Offers are only published when there is a real price and the product can be bought.
      if (Number(price) > 0 && p.status === 'active' && p.category_status === 'active') {
        product.offers = {
          '@type': 'Offer',
          url: `${env.clientUrl}/products/${p.slug}`,
          priceCurrency: 'INR',
          price: Number(price).toFixed(2),
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
        };
      }
      // Ratings only from approved, real reviews.
      if (Number(p.review_count) > 0) {
        product.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(p.rating_avg).toFixed(1), reviewCount: Number(p.review_count) };
      }
      jsonLd.push(product, {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${env.clientUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Products', item: `${env.clientUrl}/products` },
          { '@type': 'ListItem', position: 3, name: p.name, item: `${env.clientUrl}/products/${p.slug}` },
        ],
      });
    } else {
      title = `Page not found | ${brand}`;
      robots = 'noindex';
      status = 404;
    }
  } else if (path !== '/' && !KNOWN.test(path)) {
    title = `Page not found | ${brand}`;
    robots = 'noindex';
    status = 404;
  }
  if (NOINDEX.test(path)) robots = 'noindex, nofollow';

  const canonical = `${env.clientUrl}${path === '/' ? '/' : path}`;
  const tags = [
    `<title data-ssr-head>${e(title)}</title>`,
    `<meta data-ssr-head name="description" content="${e(description)}">`,
    `<meta data-ssr-head name="robots" content="${robots}">`,
    `<link data-ssr-head rel="canonical" href="${e(canonical)}">`,
    `<meta data-ssr-head property="og:type" content="${type}">`,
    `<meta data-ssr-head property="og:site_name" content="${e(brand)}">`,
    `<meta data-ssr-head property="og:title" content="${e(title)}">`,
    `<meta data-ssr-head property="og:description" content="${e(description)}">`,
    `<meta data-ssr-head property="og:url" content="${e(canonical)}">`,
    image ? `<meta data-ssr-head property="og:image" content="${e(image)}">` : '',
    `<meta data-ssr-head name="twitter:card" content="summary_large_image">`,
    ...jsonLd.map((j) => `<script data-ssr-head type="application/ld+json">${json(j)}</script>`),
  ];
  return { head: tags.filter(Boolean).join('\n    '), status };
}
