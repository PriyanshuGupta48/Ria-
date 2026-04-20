import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    const success = await register(email, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="auth-screen auth-screen-register">
      <div className="auth-card">
        <BrandLogo className="mb-5" />
        <div className="auth-badge">Join us</div>
        <h2 className="auth-title">Create your account</h2>
        <p className="auth-subtitle">
          Or{' '}
          <Link to="/login" className="text-[#8b976c] font-semibold hover:text-[#6f7b57]">
            sign in to your account
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
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            required
            className="input-field"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button type="submit" className="btn-primary w-full">
            Sign up
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;