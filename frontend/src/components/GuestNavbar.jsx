import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, UserCircle2 } from 'lucide-react';

const GuestNavbar = () => {
  return (
    <nav className="navbar-shell sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Dhaaga
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
            <Link to="/" className="nav-link inline-flex items-center gap-2">
              <ShoppingBag size={16} />
              Shop
            </Link>
            <a href="/#collections" className="nav-link">Collections</a>
            <a href="/#why-dhaaga" className="nav-link">Why Dhaaga</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl">
              <UserCircle2 size={16} />
              Login
            </Link>
            <Link to="/register" className="btn-primary inline-flex items-center justify-center rounded-xl px-4 sm:px-5 py-2">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default GuestNavbar;