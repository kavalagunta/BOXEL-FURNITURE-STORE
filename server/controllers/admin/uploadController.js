import { uploadMedia, uploadLargeMedia } from '../../services/cloudinaryService.js';
import { HttpError } from '../../utils/httpError.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const IMAGE_FOLDERS = new Set(['products', 'categories', 'banners', 'site']);

export async function upload(req, res) {
  const file = req.file;
  if (!file) throw new HttpError(400, 'Choose an image or video to upload.');
  const video = VIDEO_TYPES.has(file.mimetype);
  if (!video && !IMAGE_TYPES.has(file.mimetype)) throw new HttpError(400, 'Only JPG, JPEG, PNG, WebP images or MP4 and WebM videos are allowed.');
  if (!video && file.size > 5 * 1024 * 1024) throw new HttpError(400, 'Images must be 5 MB or smaller.');
  const imageFolder = req.body?.folder || 'products';
  if (!video && !IMAGE_FOLDERS.has(imageFolder)) throw new HttpError(400, 'Unknown upload folder.');
  const folder = video ? 'shop/videos' : `shop/${imageFolder}`;
  const result = video && file.size > 20 * 1024 * 1024 ? await uploadLargeMedia(file, folder) : await uploadMedia(file, folder);
  res.status(201).json(result);
}
