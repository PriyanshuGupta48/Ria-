import React from 'react';
import { Link } from 'react-router-dom';

const GuestNavbar = () => {
  return (
    <nav className="navbar-shell sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/login" className="text-2xl font-bold text-rose-500">
            Dhaaga
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/login" className="btn-secondary inline-flex items-center justify-center">
              User Login
            </Link>
            <Link to="/register" className="btn-primary inline-flex items-center justify-center">
              Register
            </Link>
            <Link to="/admin-login" className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2">
              Admin Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default GuestNavbar;