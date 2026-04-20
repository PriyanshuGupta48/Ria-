import React, { useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import GoogleAuthGateway from '../components/GoogleAuthGateway';

const Register = () => {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleGoogleCredential = useCallback(async (credential) => {
    const success = await googleLogin(credential, 'Registered successfully!');
    if (success) {
      navigate('/');
    }
    return success;
  }, [googleLogin, navigate]);

  return (
    <div className="auth-screen auth-screen-register">
      <div className="auth-card">
        <BrandLogo className="mb-5" />
        <div className="auth-badge">Join us</div>
        <h2 className="auth-title">Create your account</h2>
        <p className="auth-subtitle">
          Register on Dhaaga with your existing Google account. Or{' '}
          <Link to="/login" className="text-[#8b976c] font-semibold hover:text-[#6f7b57]">
            sign in to your account
          </Link>
        </p>
        <GoogleAuthGateway
          onCredential={handleGoogleCredential}
          actionLabel="create your account"
          helperText="Create your account with your existing Google account."
        />
      </div>
    </div>
  );
};

export default Register;