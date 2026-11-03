import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

async function seedData() {
  console.log('[seed] Seeding admin users...');
  const hash123 = await bcrypt.hash('Admin@123', 12);
  const hash12345 = await bcrypt.hash('Admin@12345', 12);

  // 1. Seed requested admin credentials
  await query('DELETE FROM admins WHERE email IN (?, ?)', ['admin@shop.com', 'admin@boxel.com']);
  await query(
    `INSERT INTO admins (name, email, password_hash, role, is_active) VALUES 
     ('Shop Admin', 'admin@shop.com', ?, 'admin', 1),
     ('Super Admin', 'admin@boxel.com', ?, 'super_admin', 1)`,
    [hash123, hash12345]
  );
  console.log('✅ Admin accounts created: admin@shop.com (Admin@123), admin@boxel.com (Admin@12345)');

  // 2. Ensure categories are active
  await query("UPDATE categories SET status = 'active' WHERE status <> 'inactive'");

  // 3. Seed 8-10 sample products
  console.log('[seed] Seeding sample products...');
  const sampleProducts = [
    {
      categoryId: 1,
      name: 'boxel Parcel Drop Box Pro',
      slug: 'parcel-drop-box-pro',
      sku: 'BX-PDB-PRO-01',
      shortDescription: 'Heavy-duty galvanized steel smart delivery box with two-way mechanical trapdoor.',
      description: 'Engineered for complete home security and hassle-free deliveries. Weatherproof powder coat and anti-pry lock mechanism.',
      price: 6499.00,
      trackStock: 1,
      stockQuantity: 25,
      isFeatured: 1,
      variantName: 'Charcoal Black',
      colorHex: '#1C1C1E',
      imageUrl: '/images/parcel-drop-box-front.jpeg'
    },
    {
      categoryId: 1,
      name: 'boxel Secure Post Box Slim',
      slug: 'secure-post-box-slim',
      sku: 'BX-SPB-SLM-02',
      shortDescription: 'Compact parcel and mail delivery box for gates, apartments and front doors.',
      description: 'Sleek wall-mounted design that fits packages up to shoe-box size safely while keeping water and dust out.',
      price: 3499.00,
      trackStock: 1,
      stockQuantity: 40,
      isFeatured: 1,
      variantName: 'Signal Orange',
      colorHex: '#F17E00',
      imageUrl: '/images/parcel-drop-box-open.jpeg'
    },
    {
      categoryId: 2,
      name: 'boxel Smart Parcel Pillar',
      slug: 'smart-parcel-pillar',
      sku: 'BX-SPP-PIL-03',
      shortDescription: 'Freestanding architectural parcel pillar with keypad combination lock.',
      description: 'Cast aluminium body with reinforced mounting plate. Accepts courier deliveries with auto-locking drop mechanism.',
      price: 9999.00,
      trackStock: 1,
      stockQuantity: 15,
      isFeatured: 1,
      variantName: 'Graphite Grey',
      colorHex: '#3A3A3C',
      imageUrl: '/images/parcel-drop-box-front.jpeg'
    },
    {
      categoryId: 2,
      name: 'boxel Wall-Mounted Delivery Vault',
      slug: 'wall-mounted-delivery-vault',
      sku: 'BX-WMV-VLT-04',
      shortDescription: 'Flush-mount through-the-wall parcel drop vault for perimeter walls.',
      description: 'Couriers drop packages from the exterior street; you safely retrieve them from inside your compound wall.',
      price: 7999.00,
      trackStock: 1,
      stockQuantity: 18,
      isFeatured: 1,
      variantName: 'Matte Slate',
      colorHex: '#48484A',
      imageUrl: '/images/parcel-drop-box-open.jpeg'
    },
    {
      categoryId: 3,
      name: 'boxel Dual-Access Courier Locker',
      slug: 'dual-access-courier-locker',
      sku: 'BX-DAC-LCK-05',
      shortDescription: 'Two-tier smart parcel storage box with letter slot and grocery chamber.',
      description: 'Separate top slot for envelopes and magazines, and a large lower hatch for package deliveries.',
      price: 5299.00,
      trackStock: 1,
      stockQuantity: 30,
      isFeatured: 0,
      variantName: 'Powder White',
      colorHex: '#F2F2F7',
      imageUrl: '/images/parcel-drop-box-front.jpeg'
    },
    {
      categoryId: 3,
      name: 'boxel Heavy-Duty Parcel Safe',
      slug: 'heavy-duty-parcel-safe',
      sku: 'BX-HDS-SFE-06',
      shortDescription: 'Commercial-grade package box for offices, gated villas and small businesses.',
      description: '2mm cold-rolled steel with reinforced internal baffles and drill-resistant euro profile cylinder lock.',
      price: 8499.00,
      trackStock: 1,
      stockQuantity: 12,
      isFeatured: 0,
      variantName: 'Industrial Grey',
      colorHex: '#636366',
      imageUrl: '/images/parcel-drop-box-open.jpeg'
    },
    {
      categoryId: 4,
      name: 'boxel Compact Drop Caddy',
      slug: 'compact-drop-caddy',
      sku: 'BX-CDC-CAD-07',
      shortDescription: 'Lightweight weather-sealed parcel lockbox for porches and covered entries.',
      description: 'Quick-install parcel box designed for contactless doorstep delivery of medicines, food deliveries and small electronics.',
      price: 2499.00,
      trackStock: 1,
      stockQuantity: 50,
      isFeatured: 0,
      variantName: 'Midnight Black',
      colorHex: '#000000',
      imageUrl: '/images/parcel-drop-box-front.jpeg'
    },
    {
      categoryId: 4,
      name: 'boxel Smart Parcel Trunk XL',
      slug: 'smart-parcel-trunk-xl',
      sku: 'BX-SPT-TXL-08',
      shortDescription: 'Large volume capacity parcel trunk for frequent shoppers and bulky packages.',
      description: 'Holds up to 4 large parcel boxes simultaneously with internal impact-dampening foam matting.',
      price: 11499.00,
      trackStock: 1,
      stockQuantity: 8,
      isFeatured: 1,
      variantName: 'Stone White',
      colorHex: '#E5E5EA',
      imageUrl: '/images/parcel-drop-box-open.jpeg'
    }
  ];

  for (const p of sampleProducts) {
    const existing = await query('SELECT id FROM products WHERE slug = ?', [p.slug]);
    let prodId;
    if (existing.length) {
      prodId = existing[0].id;
      await query(
        `UPDATE products SET name = ?, price = ?, short_description = ?, description = ?, status = 'active', is_featured = ? WHERE id = ?`,
        [p.name, p.price, p.shortDescription, p.description, p.isFeatured, prodId]
      );
    } else {
      const res = await query(
        `INSERT INTO products (category_id, name, slug, sku, short_description, description, price, status, is_featured, track_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [p.categoryId, p.name, p.slug, p.sku, p.shortDescription, p.description, p.price, p.isFeatured, p.trackStock]
      );
      prodId = res.insertId;
    }

    // Set images
    await query('DELETE FROM product_images WHERE product_id = ?', [prodId]);
    await query('INSERT INTO product_images (product_id, image_url, alt_text, sort_order) VALUES (?, ?, ?, 0)', [
      prodId,
      p.imageUrl,
      p.name
    ]);

    // Set variant
    await query('DELETE FROM product_variants WHERE product_id = ?', [prodId]);
    await query(
      `INSERT INTO product_variants (product_id, name, color_hex, sku, price_adjustment, stock_quantity, is_active)
       VALUES (?, ?, ?, ?, 0.00, ?, 1)`,
      [prodId, p.variantName, p.colorHex, `${p.sku}-V1`, p.stockQuantity]
    );
  }

  // Also update original seed product price to real value so it renders purchasable
  await query("UPDATE products SET price = 4999.00 WHERE price = 0.00");
  // Enable COD
  await query("UPDATE store_settings SET setting_value = '1' WHERE setting_key = 'cod_enabled'");

  console.log(`✅ ${sampleProducts.length} sample products created and verified in database.`);
  process.exit(0);
}

seedData().catch((err) => {
  console.error('[seed error]:', err);
  process.exit(1);
});

