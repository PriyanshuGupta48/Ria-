import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();
  const userRole = user?.role || (user?.isAdmin ? 'admin' : 'user');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={requireAdmin ? '/admin-login' : '/login'} />;
  }

  if (requireAdmin && userRole !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;