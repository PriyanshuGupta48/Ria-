import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, UserCircle2, ShoppingCart, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import BrandLogo from './BrandLogo';

const GuestNavbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const userRole = user?.role || (user?.isAdmin ? 'admin' : 'user');

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
  };

  return (
    <nav className="navbar-shell sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex-shrink-0">
            <BrandLogo size="sm" />
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
            <Link to="/" className="nav-link inline-flex items-center gap-2">
              <ShoppingBag size={16} />
              Shop
            </Link>
            <a href="/#collections" className="nav-link">Collections</a>
            <a href="/#why-dhaaga" className="nav-link">Why Dhaaga</a>
            {user && userRole === 'user' && (
              <Link to="/my-orders" className="nav-link">
                My Orders
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 sm:gap-3">
            {user && userRole === 'user' && (
              <Link to="/cart" className="relative nav-link">
                <ShoppingCart size={24} />
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-rose-300 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                    {cartItemCount}
                  </span>
                )}
              </Link>
            )}

            {user ? (
              <>
                <span className="text-xs sm:text-sm text-slate-700 truncate max-w-[180px]">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="bg-white/80 text-slate-700 px-3 sm:px-4 py-1 rounded-xl hover:bg-white transition border border-white/90 shadow-sm text-xs sm:text-sm whitespace-nowrap"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl">
                  <UserCircle2 size={16} />
                  Login
                </Link>
                <Link to="/register" className="btn-primary inline-flex items-center justify-center rounded-xl px-4 sm:px-5 py-2">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center gap-3">
            {user && userRole === 'user' && (
              <Link to="/cart" className="relative nav-link">
                <ShoppingCart size={20} />
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-rose-300 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold shadow-sm">
                    {cartItemCount}
                  </span>
                )}
              </Link>
            )}

            {user ? (
              <button
                onClick={handleLogout}
                className="btn-secondary inline-flex items-center justify-center px-4 py-2 rounded-xl"
              >
                Logout
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl">
                  <UserCircle2 size={16} />
                  Login
                </Link>
                <Link to="/register" className="btn-primary inline-flex items-center justify-center rounded-xl px-4 sm:px-5 py-2">
                  Sign Up
                </Link>
              </>
            )}

            {user && userRole === 'user' && (
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 hover:bg-rose-50 rounded-lg transition"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            )}
          </div>
        </div>

        {user && userRole === 'user' && isMenuOpen && (
          <div className="md:hidden mt-3 pb-3 border-t border-rose-100 pt-3">
            <Link
              to="/"
              className="nav-link block py-2 px-2 rounded hover:bg-rose-50"
              onClick={() => setIsMenuOpen(false)}
            >
              Shop
            </Link>

            <Link
              to="/my-orders"
              className="nav-link block py-2 px-2 rounded hover:bg-rose-50"
              onClick={() => setIsMenuOpen(false)}
            >
              My Orders
            </Link>

            <div className="border-t border-rose-100 mt-3 pt-3">
              <div className="px-2 py-2 text-sm text-slate-700 break-all mb-2">
                {user.email}
              </div>
              <button
                onClick={handleLogout}
                className="btn-secondary w-full"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default GuestNavbar;