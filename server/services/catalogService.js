import { query, queryOne } from '../config/db.js';
import { parseJson, toRupees, likeTerm } from '../utils/helpers.js';
import { unitPricePaise, unavailableReason } from './pricingService.js';
import { imageTransform } from './cloudinaryService.js';

const SORTS = {
  featured: 'p.is_featured DESC, p.sort_order ASC, p.id ASC',
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'effective_price = 0, effective_price ASC, p.id ASC',
  price_desc: 'effective_price DESC, p.id ASC',
  name: 'p.name ASC',
};

function availabilityOf(p, variants) {
  const reason = unavailableReason(p);
  if (reason === 'coming_soon') return 'coming_soon';
  if (reason) return reason;
  const active = variants.filter((v) => v.is_active);
  if (!active.length) return 'unavailable';
  if (p.track_stock && !active.some((v) => v.stock_quantity > 0)) return 'out_of_stock';
  return 'available';
}

function mapVariant(p, v) {
  return {
    id: v.id,
    name: v.name,
    colorHex: v.color_hex,
    price: toRupees(unitPricePaise(p, v)),
    available: Boolean(v.is_active) && (!p.track_stock || v.stock_quantity > 0),
    ...(p.track_stock ? { stock: Math.max(0, v.stock_quantity) } : {}),
  };
}

export function mapProductCard(p, images, variants) {
  const activeVariants = variants.filter((v) => v.is_active);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.short_description,
    price: Number(p.price),
    salePrice: p.sale_price !== null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price) ? Number(p.sale_price) : null,
    status: p.status,
    availability: availabilityOf(p, variants),
    isFeatured: Boolean(p.is_featured),
    category: p.category_slug ? { name: p.category_name, slug: p.category_slug, status: p.category_status } : null,
    images: images.map((i) => ({ url: i.image_url, srcset: i.image_url?.includes('res.cloudinary.com/') ? [400, 800, 1200].map((w) => `${imageTransform(i.image_url, w)} ${w}w`).join(', ') : undefined, alt: i.alt_text || p.name })),
    variants: activeVariants.map((v) => mapVariant(p, v)),
    rating: p.review_count > 0 ? { average: Math.round(Number(p.rating_avg) * 10) / 10, count: Number(p.review_count) } : null,
  };
}

const baseSelect = `SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.status AS category_status,
  CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 AND p.sale_price < p.price THEN p.sale_price ELSE p.price END AS effective_price,
  (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS rating_avg,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS review_count
  FROM products p JOIN categories c ON c.id = p.category_id`;

async function attachMedia(products, { imageLimit = 2 } = {}) {
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const images = await query('SELECT product_id, image_url, alt_text FROM product_images WHERE product_id IN (?) ORDER BY sort_order, id', [ids]);
  const variants = await query('SELECT * FROM product_variants WHERE product_id IN (?) ORDER BY sort_order, id', [ids]);
  return products.map((p) =>
    mapProductCard(
      p,
      images.filter((i) => i.product_id === p.id).slice(0, imageLimit),
      variants.filter((v) => v.product_id === p.id),
    ),
  );
}

/**
 * Public catalogue listing. By default shows published products in active categories;
 * `availability=coming_soon` also includes upcoming products.
 */
export async function listPublicProducts({ search, category, availability = 'all', sort = 'featured', featured, limit, offset, excludeId }) {
  const where = [];
  const params = [];
  if (availability === 'coming_soon') {
    where.push("(p.status = 'coming_soon' OR (p.status = 'active' AND c.status = 'coming_soon'))");
  } else {
    where.push("p.status = 'active' AND c.status = 'active'");
    if (availability === 'available') {
      where.push('p.price > 0');
      where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1 AND (p.track_stock = 0 OR v.stock_quantity > 0))`);
    }
  }
  if (search) {
    where.push('(p.name LIKE ? OR p.short_description LIKE ?)');
    params.push(likeTerm(search), likeTerm(search));
  }
  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }
  if (featured) where.push('p.is_featured = 1');
  if (excludeId) {
    where.push('p.id <> ?');
    params.push(excludeId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}`, params);
  const rows = await query(`${baseSelect} ${whereSql} ORDER BY ${SORTS[sort] || SORTS.featured} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { items: await attachMedia(rows), total };
}

export async function getPublicProduct(slug) {
  const p = await queryOne(`${baseSelect} WHERE p.slug = ? AND p.status IN ('active','coming_soon') AND c.status <> 'inactive'`, [slug]);
  if (!p) return null;
  const images = await query('SELECT image_url, alt_text FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [p.id]);
  const variants = await query('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id', [p.id]);
  const faqs = await query('SELECT id, question, answer FROM faqs WHERE product_id = ? AND is_active = 1 ORDER BY sort_order, id', [p.id]);
  const breakdown = await query(
    "SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? AND status = 'approved' GROUP BY rating",
    [p.id],
  );
  const card = mapProductCard(p, images, variants);
  return {
    ...card,
    sku: p.sku,
    description: p.description,
    features: parseJson(p.features, []),
    specifications: parseJson(p.specifications, []).filter((s) => s?.label && s?.value),
    shippingInfo: p.shipping_info,
    warrantyInfo: p.warranty_info,
    seo: {
      title: p.seo_title || p.name,
      description: p.seo_description || p.short_description || '',
      image: p.og_image_url || images[0]?.image_url || null,
    },
    faqs,
    ratingBreakdown: Object.fromEntries(breakdown.map((b) => [b.rating, Number(b.n)])),
    updatedAt: p.updated_at,
    _categoryId: p.category_id,
  };
}

export async function relatedProducts(product, limit = 4) {
  const rows = await query(
    `${baseSelect} WHERE p.id <> ? AND p.status IN ('active','coming_soon') AND c.status <> 'inactive'
     ORDER BY (p.category_id = ?) DESC, p.is_featured DESC, p.sort_order LIMIT ?`,
    [product.id, product._categoryId, limit],
  );
  return attachMedia(rows, { imageLimit: 1 });
}
