import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <BrandLogo className="mb-5" />
        <div className="auth-badge">Welcome back</div>
        <h2 className="auth-title">Sign in to your account</h2>
        <p className="auth-subtitle">
          Or{' '}
          <Link to="/register" className="text-[#8b976c] font-semibold hover:text-[#6f7b57]">
            create a new account
          </Link>
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
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            className="input-field"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn-primary w-full">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;