import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAdmin, requireRole } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimits.js';
import { imageUpload } from '../middleware/upload.js';
import multer from 'multer';
import { HttpError } from '../utils/httpError.js';
import { upload } from '../controllers/admin/uploadController.js';
import { loginSchema } from '../controllers/authController.js';
import * as auth from '../controllers/admin/authController.js';
import * as dash from '../controllers/admin/dashboardController.js';
import * as products from '../controllers/admin/productController.js';
import * as categories from '../controllers/admin/categoryController.js';
import * as orders from '../controllers/admin/orderController.js';
import * as customers from '../controllers/admin/customerController.js';
import * as reviews from '../controllers/admin/reviewController.js';
import * as enquiries from '../controllers/admin/enquiryController.js';
import * as content from '../controllers/admin/contentController.js';
import * as system from '../controllers/admin/systemController.js';
import * as vendors from '../controllers/admin/vendorController.js';

const r = Router();

// There is deliberately no admin registration route. The first admin is created with `npm run create-admin`.
r.post('/auth/login', loginLimiter, validate(loginSchema), auth.login);
r.post('/auth/logout', auth.logout);

// Everything below requires a signed-in, active admin — checked on the server for every request.
r.use(requireAdmin);
r.get('/auth/me', auth.me);

// support, admin, super_admin
const staff = requireRole('support', 'admin');
r.get('/dashboard', staff, dash.stats);
r.get('/notifications', staff, dash.notifications);
r.get('/search', staff, dash.search);

r.get('/orders', staff, orders.list);
r.get('/orders/:id', staff, orders.get);
r.patch('/orders/:id/status', staff, validate(orders.statusSchema), orders.updateStatus);
r.post('/orders/:id/message', staff, validate(orders.messageSchema), orders.sendMessage);
r.post('/orders/:id/notes', staff, validate(orders.noteSchema), orders.addNote);
r.patch('/orders/:id/tracking', staff, validate(orders.trackingSchema), orders.updateTracking);
r.post('/orders/:id/resend-vendor', staff, orders.resendVendor);
r.post('/orders/:id/emails/:logId/retry', staff, orders.retryNotification);
r.patch('/orders/:id/payment', requireRole('admin'), validate(orders.paymentSchema), orders.updatePayment);

r.get('/customers', staff, customers.list);
r.get('/customers/:id', staff, customers.get);
r.patch('/customers/:id/status', requireRole('admin'), validate(customers.customerStatusSchema), customers.setStatus);

r.get('/reviews', staff, reviews.list);
r.patch('/reviews/:id', staff, validate(reviews.moderateSchema), reviews.moderate);
r.delete('/reviews/:id', requireRole('admin'), reviews.remove);

r.get('/enquiries', staff, enquiries.list);
r.get('/enquiries/:id', staff, enquiries.get);
r.patch('/enquiries/:id', staff, validate(enquiries.enquiryUpdateSchema), enquiries.update);
r.post('/enquiries/:id/reply', staff, validate(enquiries.replySchema), enquiries.reply);
r.get('/newsletter', staff, enquiries.newsletter);
r.delete('/newsletter/:id', requireRole('admin'), enquiries.removeSubscriber);

// admin, super_admin
const admin = requireRole('admin');
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
  if (!allowed.includes(file.mimetype)) return cb(new HttpError(400, 'Only JPG, JPEG, PNG, WebP images or MP4 and WebM videos are allowed.'));
  cb(null, true);
} });
const uploadAdminMedia = (req, res, next) => mediaUpload.single('file')(req, res, (err) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Upload exceeds the 50 MB maximum file size.' });
  next(err);
});
r.post('/upload', admin, uploadAdminMedia, upload);
r.post('/uploads', admin, imageUpload.array('images', 10), content.upload);

r.get('/products', admin, products.list);
r.get('/products/:id', admin, products.get);
r.post('/products', admin, validate(products.productSchema), products.create);
r.put('/products/:id', admin, validate(products.productSchema), products.update);
r.post('/products/:id/archive', admin, products.archive);
r.delete('/products/:id', admin, products.remove);

r.get('/categories', admin, categories.list);
r.post('/categories', admin, validate(categories.categorySchema), categories.create);
r.put('/categories/reorder', admin, validate(categories.reorderSchema), categories.reorder);
r.put('/categories/:id', admin, validate(categories.categorySchema), categories.update);
r.delete('/categories/:id', admin, validate(categories.deleteCategorySchema), categories.remove);

r.get('/vendors', admin, vendors.list);
r.get('/vendors/products', admin, vendors.getProducts);
r.get('/vendors/:id', admin, vendors.get);
r.post('/vendors', admin, validate(vendors.vendorSchema), vendors.create);
r.put('/vendors/:id', admin, validate(vendors.vendorSchema), vendors.update);
r.delete('/vendors/:id', admin, vendors.remove);
r.post('/vendors/:id/assign-products', admin, validate(vendors.assignProductsSchema), vendors.assignProducts);

r.get('/faqs', admin, content.listFaqs);
r.post('/faqs', admin, validate(content.faqSchema), content.createFaq);
r.put('/faqs/reorder', admin, validate(content.idsSchema), content.reorderFaqs);
r.put('/faqs/:id', admin, validate(content.faqSchema), content.updateFaq);
r.delete('/faqs/:id', admin, content.deleteFaq);

r.get('/banners', admin, content.listBanners);
r.post('/banners', admin, validate(content.bannerSchema), content.createBanner);
r.put('/banners/:id', admin, validate(content.bannerSchema), content.updateBanner);
r.delete('/banners/:id', admin, content.deleteBanner);

r.get('/social-links', admin, content.getSocial);
r.put('/social-links', admin, validate(content.socialSchema), content.updateSocial);

// Email notification settings are restricted to super admins; other groups to admins.
const settingsGuard = (req, res, next) => (req.params.group === 'email' ? requireRole()(req, res, next) : admin(req, res, next));
r.get('/settings/:group', settingsGuard, content.getSettingsGroup);
r.put('/settings/:group', settingsGuard, content.updateSettings);

r.get('/email/status', admin, system.emailStatus);
r.get('/email/logs', admin, system.emailLogs);
r.post('/email/logs/:id/retry', admin, system.retry);
r.post('/email/test', requireRole(), validate(system.testEmailSchema), system.testEmail);

r.get('/activity-logs', admin, system.activity);

// super_admin only
r.get('/users', requireRole(), system.listAdmins);
r.post('/users', requireRole(), validate(system.adminCreateSchema), system.createAdmin);
r.put('/users/:id', requireRole(), validate(system.adminUpdateSchema), system.updateAdmin);

export default r;
