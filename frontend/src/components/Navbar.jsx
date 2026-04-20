import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import BrandLogo from './BrandLogo';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
  };

  return (
    <nav className="navbar-shell sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex-shrink-0">
            <BrandLogo size="sm" />
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="nav-link">
              Shop
            </Link>

            <Link to="/my-orders" className="nav-link">
              My Orders
            </Link>
            
            <Link to="/cart" className="relative nav-link">
              <ShoppingCart size={24} />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-300 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-3 border-l border-rose-100 pl-4 sm:pl-6">
              <span className="text-xs sm:text-sm text-slate-700 truncate">{user.email}</span>
              <button
                onClick={logout}
                className="bg-white/80 text-slate-700 px-3 sm:px-4 py-1 rounded-xl hover:bg-white transition border border-white/90 shadow-sm text-xs sm:text-sm whitespace-nowrap"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile Menu Button & Icons */}
          <div className="md:hidden flex items-center gap-3">
            <Link to="/cart" className="relative nav-link">
              <ShoppingCart size={20} />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-300 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-rose-50 rounded-lg transition"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
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

export default Navbar;