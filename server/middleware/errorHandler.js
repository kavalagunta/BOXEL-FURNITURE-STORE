import multer from 'multer';
import { env } from '../config/env.js';

export function notFoundApi(_req, res) {
  res.status(404).json({ error: 'Not found.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? (req.originalUrl?.endsWith('/upload') ? 'File is too large. Images are limited to 5 MB and videos to 50 MB.' : 'Image is too large. The maximum size is 5 MB.') : 'Upload failed. Check the file and try again.';
    return res.status(400).json({ error: msg });
  }
  if (err.message?.includes('Only JPG, JPEG')) return res.status(400).json({ error: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed request.' });

  if (err.expose && err.status) {
    const body = { error: err.message };
    if (err.fields) body.fields = err.fields;
    if (err.code) body.code = err.code;
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // Unexpected error: log it, never leak internals in production.
  console.error(`[error] ${req.method} ${req.originalUrl}:`, env.isProduction ? err.message : err);
  res.status(500).json({
    error: 'Something went wrong on our side. Please try again.',
    ...(env.isProduction ? {} : { debug: err.message || err.name || 'Unknown server error.' }),
  });
}
