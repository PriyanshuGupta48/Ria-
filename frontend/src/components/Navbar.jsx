import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();

  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  if (!user) {
    return null;
  }

  return (
    <nav className="navbar-shell sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-rose-500">
            Dhaaga
          </Link>
          
          <div className="flex items-center gap-6">
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
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-700">{user.email}</span>
              <button
                onClick={logout}
                className="bg-white/80 text-slate-700 px-4 py-1 rounded-xl hover:bg-white transition border border-white/90 shadow-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;