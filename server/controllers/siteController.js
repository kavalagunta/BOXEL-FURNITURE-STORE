import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { ensureCsrfToken } from '../middleware/csrf.js';
import { getSettings, publicSettings } from '../services/settingsService.js';
import { enabledPaymentMethods } from '../services/orderService.js';
import { escapeHtml } from '../utils/helpers.js';

export function csrf(req, res) {
  res.json({ csrfToken: ensureCsrfToken(req) });
}

export async function activeHeroBanner() {
  const rows = await query(
    `SELECT id, headline, subheadline, cta_text, cta_url, secondary_cta_text, secondary_cta_url,
            desktop_image_url, mobile_image_url, image_alt, video_url
       FROM banners
      WHERE placement = 'hero' AND is_active = 1
        AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
        AND (ends_at IS NULL OR ends_at > UTC_TIMESTAMP())
      ORDER BY sort_order, id LIMIT 1`,
  );
  return rows[0] || null;
}

/** Everything the public layout needs in one request: settings, social links, hero, payment options. */
export async function site(_req, res) {
  const settings = await getSettings();
  const [social, hero, promos] = await Promise.all([
    query("SELECT platform, url FROM social_links WHERE is_active = 1 AND url IS NOT NULL AND url <> '' ORDER BY sort_order"),
    activeHeroBanner(),
    query(
      `SELECT id, headline, subheadline, cta_text, cta_url, desktop_image_url, mobile_image_url, image_alt, video_url FROM banners
        WHERE placement = 'promo' AND is_active = 1
          AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP()) AND (ends_at IS NULL OR ends_at > UTC_TIMESTAMP())
        ORDER BY sort_order, id LIMIT 3`,
    ),
  ]);
  res.set('Cache-Control', 'no-cache');
  res.json({
    settings: publicSettings(settings),
    social,
    hero,
    promos,
    paymentMethods: enabledPaymentMethods(settings),
    onlinePaymentEnabled: false,
  });
}

export async function faqs(_req, res) {
  const rows = await query('SELECT id, question, answer FROM faqs WHERE is_active = 1 AND product_id IS NULL ORDER BY sort_order, id');
  res.json({ items: rows });
}

export async function sitemap(_req, res) {
  const base = env.clientUrl;
  const products = await query(
    "SELECT p.slug, p.updated_at FROM products p JOIN categories c ON c.id = p.category_id WHERE p.status IN ('active','coming_soon') AND c.status <> 'inactive'",
  );
  const categories = await query("SELECT slug, updated_at FROM categories WHERE status IN ('active','coming_soon')");
  const staticPaths = ['/', '/products', '/about', '/contact', '/shipping-returns', '/privacy-policy', '/terms'];
  const urls = [
    ...staticPaths.map((p) => ({ loc: `${base}${p}`, priority: p === '/' ? '1.0' : '0.6' })),
    ...categories.map((c) => ({ loc: `${base}/products?category=${encodeURIComponent(c.slug)}`, lastmod: c.updated_at, priority: '0.5' })),
    ...products.map((p) => ({ loc: `${base}/products/${encodeURIComponent(p.slug)}`, lastmod: p.updated_at, priority: '0.9' })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>`;
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
}

export function robots(_req, res) {
  res.type('text/plain').send(
    ['User-agent: *', 'Disallow: /admin', 'Disallow: /account', 'Disallow: /cart', 'Disallow: /checkout', 'Disallow: /order-success', 'Disallow: /api/', '', `Sitemap: ${env.clientUrl}/sitemap.xml`, ''].join('\n'),
  );
}
