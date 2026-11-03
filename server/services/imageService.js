import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const FOLDERS = new Set(['products', 'categories', 'banners', 'site']);

/**
 * Decodes the uploaded bytes, strips metadata, resizes and re-encodes to WebP.
 * Anything that is not a decodable image is rejected here.
 */
export async function saveImage(file, folder, { maxSize = 2000 } = {}) {
  if (!FOLDERS.has(folder)) throw new Error(`Unknown upload folder ${folder}`);
  if (!file?.buffer?.length) throw new HttpError(400, 'No image received.');

  let pipeline;
  try {
    pipeline = sharp(file.buffer, { limitInputPixels: 50_000_000, failOn: 'error' });
    const meta = await pipeline.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error('format');
  } catch {
    throw new HttpError(400, 'That file is not a valid JPEG, PNG or WebP image.');
  }

  const dir = path.join(env.uploadsDir, folder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.webp`;
  const info = await pipeline
    .rotate()
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(dir, name));

  return { url: `/uploads/${folder}/${name}`, width: info.width, height: info.height };
}

/** Deletes a previously uploaded file. Bundled /images/* assets are never touched. */
export async function deleteUploadedImage(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const resolved = path.resolve(env.uploadsDir, url.replace(/^\/uploads\//, ''));
  if (!resolved.startsWith(env.uploadsDir + path.sep)) return;
  try { await fs.unlink(resolved); } catch { /* already gone */ }
}
