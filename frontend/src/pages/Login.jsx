import React, { useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import GoogleAuthGateway from '../components/GoogleAuthGateway';

const Login = () => {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleGoogleCredential = useCallback(async (credential) => {
    const success = await googleLogin(credential, 'Logged in successfully!');
    if (success) {
      navigate('/');
    }
    return success;
  }, [googleLogin, navigate]);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <BrandLogo className="mb-5" />
        <div className="auth-badge">Welcome back</div>
        <h2 className="auth-title">Sign in to your account</h2>
        <p className="auth-subtitle">
          Sign in with your registered Google account. Or{' '}
          <Link to="/register" className="text-[#8b976c] font-semibold hover:text-[#6f7b57]">
            create a new account
          </Link>
        </p>
        <GoogleAuthGateway
          onCredential={handleGoogleCredential}
          actionLabel="sign in"
          helperText="Continue with your registered Google account."
        />
      </div>
    </div>
  );
};

export default Login;