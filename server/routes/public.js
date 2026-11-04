import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireCustomer } from '../middleware/auth.js';
import * as L from '../middleware/rateLimits.js';
import * as site from '../controllers/siteController.js';
import * as catalog from '../controllers/catalogController.js';
import * as cart from '../controllers/cartController.js';
import * as orders from '../controllers/orderController.js';
import * as auth from '../controllers/authController.js';
import * as account from '../controllers/accountController.js';
import * as contact from '../controllers/contactController.js';
import { openCustomerOrderEventStream } from '../services/adminOrderEvents.js';

const r = Router();

r.get('/site', site.site);
r.get('/faqs', site.faqs);
r.get('/categories', catalog.categories);
r.get('/products', validate(catalog.productListQuery, 'query'), catalog.products);
r.get('/products/:slug', catalog.product);
r.get('/products/:slug/reviews', catalog.reviews);
r.post('/products/:slug/reviews', L.reviewLimiter, requireCustomer, validate(catalog.reviewSchema), catalog.submitReview);

r.post('/cart/quote', validate(cart.cartItemsSchema), cart.quote);
r.get('/cart', requireCustomer, cart.getCart);
r.put('/cart', requireCustomer, validate(cart.cartItemsSchema), cart.saveCart);

r.post('/orders', L.checkoutLimiter, requireCustomer, validate(orders.checkoutSchema), orders.placeOrder);
r.get('/orders/confirmation/:orderNumber', orders.confirmation);
r.get('/orders/:orderNumber/events', openCustomerOrderEventStream);

r.post('/enquiries', L.contactLimiter, validate(contact.enquirySchema), contact.createEnquiry);
r.post('/newsletter', L.newsletterLimiter, validate(contact.newsletterSchema), contact.subscribe);

r.post('/auth/register', L.registerLimiter, validate(auth.registerSchema), auth.register);
r.post('/auth/login', L.loginLimiter, validate(auth.loginSchema), auth.login);
r.post('/auth/logout', auth.logout);
r.get('/auth/me', auth.me);
r.patch('/auth/me', requireCustomer, validate(auth.profileSchema), auth.updateProfile);
r.post('/auth/change-password', L.loginLimiter, requireCustomer, validate(auth.changePasswordSchema), auth.changePassword);
r.post('/auth/forgot-password', L.passwordResetLimiter, validate(auth.forgotSchema), auth.forgotPassword);
r.post('/auth/reset-password', L.passwordResetLimiter, validate(auth.resetSchema), auth.resetPassword);

r.get('/account/orders', requireCustomer, account.orders);
r.get('/account/orders/:orderNumber', requireCustomer, account.order);
r.get('/account/addresses', requireCustomer, account.addresses);
r.post('/account/addresses', requireCustomer, validate(account.addressSchema), account.createAddress);
r.delete('/account/addresses/:id', requireCustomer, account.deleteAddress);

export default r;
