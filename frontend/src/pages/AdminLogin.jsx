import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await adminLogin(email, password);
    if (success) {
      navigate('/admin');
    }
  };

  return (
    <div className="auth-screen auth-screen-admin">
      <div className="auth-card">
        <div className="auth-badge auth-badge-admin">Admin access</div>
        <h2 className="auth-title">Admin sign in</h2>
        <p className="auth-subtitle">
          This area is reserved for store managers only.
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            className="input-field"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            className="input-field"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn-primary btn-primary-admin w-full">
            Enter dashboard
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;