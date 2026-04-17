import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, UserCircle2, Menu, X } from 'lucide-react';

const GuestNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

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

          <div className="hidden md:flex items-center gap-2 sm:gap-3 ml-auto">
            <Link to="/login" className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl">
              <UserCircle2 size={16} />
              Login
            </Link>
            <Link to="/register" className="btn-primary inline-flex items-center justify-center rounded-xl px-4 sm:px-5 py-2">
              Sign Up
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden p-2 rounded-lg hover:bg-rose-50 transition"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-rose-100">
            <div className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
              <Link to="/" className="nav-link inline-flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-rose-50" onClick={closeMenu}>
                <ShoppingBag size={16} />
                Shop
              </Link>
              <a href="/#collections" className="nav-link px-2 py-2 rounded-lg hover:bg-rose-50" onClick={closeMenu}>Collections</a>
              <a href="/#why-dhaaga" className="nav-link px-2 py-2 rounded-lg hover:bg-rose-50" onClick={closeMenu}>Why Dhaaga</a>
            </div>

            <div className="border-t border-rose-100 mt-3 pt-3 grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="btn-secondary inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl"
                onClick={closeMenu}
              >
                <UserCircle2 size={16} />
                Login
              </Link>
              <Link
                to="/register"
                className="btn-primary inline-flex items-center justify-center rounded-xl px-3 py-2"
                onClick={closeMenu}
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default GuestNavbar;