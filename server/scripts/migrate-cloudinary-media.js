import { query, pool } from '../config/db.js';
import { uploadMedia } from '../services/cloudinaryService.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

async function migrate() {
  const categories = await query("SELECT id, image_url FROM categories WHERE image_url LIKE '/uploads/%' OR image_url LIKE '/images/%'");
  for (const row of categories) {
    const localPath = row.image_url.startsWith('/uploads/') ? path.join(env.uploadsDir, row.image_url.slice('/uploads/'.length)) : path.join(env.clientDist, row.image_url.slice(1));
    try {
      const buffer = await readFile(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const media = await uploadMedia({ buffer, mimetype: type, originalname: path.basename(localPath) }, 'shop/banners');
      await query('UPDATE categories SET image_url = ?, cloudinary_public_id = ? WHERE id = ?', [media.url, media.public_id, row.id]);
      console.log(`[migrate] categories ${row.id} updated`);
    } catch (error) { console.error(`[migrate] categories ${row.id} skipped: ${error.message}`); }
  }
  const banners = await query("SELECT id, desktop_image_url, mobile_image_url FROM banners WHERE desktop_image_url LIKE '/uploads/%' OR desktop_image_url LIKE '/images/%' OR mobile_image_url LIKE '/uploads/%' OR mobile_image_url LIKE '/images/%'");
  for (const row of banners) for (const column of ['desktop_image_url', 'mobile_image_url']) {
    const url = row[column]; if (!url || !url.startsWith('/')) continue;
    const localPath = url.startsWith('/uploads/') ? path.join(env.uploadsDir, url.slice('/uploads/'.length)) : path.join(env.clientDist, url.slice(1));
    try {
      const buffer = await readFile(localPath); const ext = path.extname(localPath).toLowerCase();
      const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const media = await uploadMedia({ buffer, mimetype: type, originalname: path.basename(localPath) }, 'shop/banners');
      const pidColumn = column === 'desktop_image_url' ? 'desktop_image_public_id' : 'mobile_image_public_id';
      await query(`UPDATE banners SET ${column} = ?, ${pidColumn} = ? WHERE id = ?`, [media.url, media.public_id, row.id]);
      console.log(`[migrate] banner ${row.id} ${column} updated`);
    } catch (error) { console.error(`[migrate] banner ${row.id} ${column} skipped: ${error.message}`); }
  }
  const images = await query("SELECT id, image_url FROM product_images WHERE image_url LIKE '/uploads/%' OR image_url LIKE '/images/%'");
  for (const row of images) {
    const localPath = row.image_url.startsWith('/uploads/') ? path.join(env.uploadsDir, row.image_url.slice('/uploads/'.length)) : path.join(env.clientDist, row.image_url.slice(1));
    try {
      const buffer = await readFile(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const media = await uploadMedia({ buffer, mimetype: type, originalname: path.basename(localPath) }, 'shop/products');
      await query('UPDATE product_images SET image_url = ?, cloudinary_public_id = ? WHERE id = ?', [media.url, media.public_id, row.id]);
      console.log(`[migrate] product_images ${row.id} updated`);
    } catch (error) { console.error(`[migrate] product_images ${row.id} skipped: ${error.message}`); }
  }
}

migrate().catch((error) => { console.error('[migrate]', error.message); process.exitCode = 1; }).finally(() => pool.end());
