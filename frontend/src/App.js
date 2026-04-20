import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
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

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <AppShell />
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  const userRole = user?.role || (user?.isAdmin ? 'admin' : 'user');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const showPublicExtras = !isAdminRoute;
  const showUserNavbar = Boolean(user) && userRole === 'user' && !isAdminRoute;
  const showGuestNavbar = !isAdminRoute && !user;

  return (
    <div className="min-h-screen app-background">
      {showUserNavbar && <Navbar />}
      {showGuestNavbar && <GuestNavbar />}
      <main>
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