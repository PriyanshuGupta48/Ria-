import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import GuestNavbar from './components/GuestNavbar';
import Home from './pages/Home';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Register from './pages/Register';
import Admin from './pages/Admin';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import SiteFooter from './components/SiteFooter';
import WhatsAppFloat from './components/WhatsAppFloat';
import { siteInfo } from './config/siteInfo';

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search, location.hash]);

  return null;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <ScrollToTop />
          <AppShell />
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

const AppShell = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const showPublicExtras = !isAdminRoute;

  return (
    <div className="min-h-screen app-background">
      {showPublicExtras && (
        <div className="site-announcement">
          <div className="container mx-auto px-4 sm:px-6 py-2 flex items-center justify-center">
            <span className="site-announcement-pill site-announcement-moving" aria-label={siteInfo.deliveryBannerText}>
              {siteInfo.deliveryBannerText}
            </span>
          </div>
        </div>
      )}
      {!isAdminRoute && <GuestNavbar />}
      <main className="pb-44 sm:pb-48 lg:pb-40">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-orders/:orderId"
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <Admin />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {showPublicExtras && <SiteFooter />}
      {showPublicExtras && <WhatsAppFloat />}
      <Toaster position="bottom-right" />
    </div>
  );
};

export default App;