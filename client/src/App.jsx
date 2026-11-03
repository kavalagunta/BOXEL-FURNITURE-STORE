import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { MotionConfig } from 'framer-motion';
import SiteLayout from './layouts/SiteLayout.jsx';
import { SiteProvider } from './context/SiteContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { PageLoader } from './components/ui/States.jsx';
import Home from './pages/Home.jsx';

// Route-level code splitting: only the homepage ships in the initial bundle.
const About = lazy(() => import('./pages/About.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const PolicyPage = lazy(() => import('./pages/PolicyPage.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Login = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.ResetPassword })));
const AccountLayout = lazy(() => import('./pages/account/Account.jsx').then((m) => ({ default: m.AccountLayout })));
const AccountProfile = lazy(() => import('./pages/account/Account.jsx').then((m) => ({ default: m.AccountProfile })));
const AccountOrders = lazy(() => import('./pages/account/Account.jsx').then((m) => ({ default: m.AccountOrders })));
const AccountOrderDetail = lazy(() => import('./pages/account/Account.jsx').then((m) => ({ default: m.AccountOrderDetail })));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <SiteProvider>
            <AuthProvider>
              <CartProvider>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/admin/*" element={<AdminApp />} />
                    <Route element={<SiteLayout />}>
                      <Route index element={<Home />} />
                      <Route path="about" element={<About />} />
                      <Route path="products" element={<Products />} />
                      <Route path="products/:slug" element={<ProductDetail />} />
                      <Route path="cart" element={<Cart />} />
                      <Route path="checkout" element={<Checkout />} />
                      <Route path="order-success/:orderNumber" element={<OrderSuccess />} />
                      <Route path="contact" element={<Contact />} />
                      <Route path="privacy-policy" element={<PolicyPage kind="privacy" />} />
                      <Route path="terms" element={<PolicyPage kind="terms" />} />
                      <Route path="shipping-returns" element={<PolicyPage kind="shipping" />} />
                      <Route path="login" element={<Login />} />
                      <Route path="register" element={<Register />} />
                      <Route path="forgot-password" element={<ForgotPassword />} />
                      <Route path="reset-password" element={<ResetPassword />} />
                      <Route path="account" element={<AccountLayout />}>
                        <Route index element={<AccountProfile />} />
                        <Route path="orders" element={<AccountOrders />} />
                        <Route path="orders/:orderNumber" element={<AccountOrderDetail />} />
                      </Route>
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Routes>
                </Suspense>
              </CartProvider>
            </AuthProvider>
          </SiteProvider>
        </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
