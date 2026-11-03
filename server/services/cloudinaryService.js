import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

let configured = false;
function client() {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new HttpError(503, 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env.');
  }
  if (!configured) {
    cloudinary.config({ cloud_name: env.cloudinary.cloudName, api_key: env.cloudinary.apiKey, api_secret: env.cloudinary.apiSecret, secure: true });
    configured = true;
  }
  return cloudinary;
}

export async function uploadMedia(file, folder) {
  const c = client();
  const video = file.mimetype.startsWith('video/');
  try {
    const response = await new Promise((resolve, reject) => {
      const stream = c.uploader.upload_stream({ folder, resource_type: 'auto', transformation: video ? [{ quality: 'auto', fetch_format: 'auto' }] : [{ quality: 'auto', fetch_format: 'auto' }] }, (err, result) => err ? reject(err) : resolve(result));
      stream.end(file.buffer);
    });
    return { url: response.secure_url, public_id: response.public_id, resource_type: response.resource_type, width: response.width, height: response.height, format: response.format, bytes: response.bytes, ...(response.duration ? { duration: response.duration } : {}) };
  } catch (err) {
    throw cloudinaryError(err);
  }
}

export async function deleteCloudinaryAsset(publicId, resourceType = 'image') {
  if (!publicId || !String(publicId).startsWith('shop/')) return;
  try {
    const result = await client().uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
    return result.result;
  } catch (err) {
    console.error('[cloudinary] Asset cleanup failed:', publicId, err.message);
  }
}

export async function uploadLargeMedia(file, folder) {
  const c = client();
  try {
    const response = await new Promise((resolve, reject) => {
      const stream = c.uploader.upload_large_stream({ folder, resource_type: 'video', chunk_size: 6_000_000, eager: [{ quality: 'auto', fetch_format: 'auto' }] }, (err, result) => err ? reject(err) : resolve(result));
      stream.end(file.buffer);
    });
    return { url: response.secure_url, public_id: response.public_id, resource_type: response.resource_type, width: response.width, height: response.height, format: response.format, bytes: response.bytes, ...(response.duration ? { duration: response.duration } : {}) };
  } catch (err) {
    throw cloudinaryError(err);
  }
}

function cloudinaryError(err) {
  const networkCodes = new Set(['EACCES', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'ENOTFOUND']);
  if (networkCodes.has(err?.code) || err instanceof AggregateError) {
    return new HttpError(503, 'This server cannot reach Cloudinary. Check its internet or proxy access, then retry the upload.');
  }
  if (err?.http_code === 401 || err?.http_code === 403 || /invalid (signature|api key)|authentication/i.test(err?.message || '')) {
    return new HttpError(502, 'Cloudinary rejected the configured credentials. Check the cloud name, API key, and API secret in server/.env.');
  }
  console.error('[cloudinary] Upload failed:', err?.http_code || err?.code || err?.name || 'unknown error', err?.message || 'No provider message.');
  return new HttpError(502, 'Cloudinary could not complete the upload. Please retry; if it continues, check the server log.');
}

export function imageTransform(url, width) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
}

