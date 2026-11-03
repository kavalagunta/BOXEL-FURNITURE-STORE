import multer from 'multer';
import { HttpError } from '../utils/httpError.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Images are held in memory, then decoded and re-encoded by sharp (services/imageService.js),
 * which rejects anything that is not a real image regardless of its declared type.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new HttpError(400, 'Only JPEG, PNG or WebP images are allowed.'));
    cb(null, true);
  },
});
