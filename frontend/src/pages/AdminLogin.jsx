import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    let success = false;

    try {
      success = await adminLogin(email.trim().toLowerCase(), password);
    } finally {
      setSubmitting(false);
    }

    if (success) {
      navigate('/admin');
    }
  };

  return (
    <div className="auth-screen auth-screen-admin">
      <div className="auth-card">
        <BrandLogo className="mb-5" />
        <div className="auth-badge auth-badge-admin">Admin access</div>
        <h2 className="auth-title">Admin sign in</h2>
        <p className="auth-subtitle">
          This area is reserved for store managers only.
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            className="input-field"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            className="input-field"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={submitting} className="btn-primary btn-primary-admin w-full disabled:opacity-70 disabled:cursor-not-allowed">
            Enter dashboard
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;