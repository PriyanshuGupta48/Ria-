import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { apiUrl } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const shouldKeepLocalAuth = process.env.REACT_APP_KEEP_LOCAL_AUTH === 'true';
let backendWarmPromise = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (operation, { attempts = 3, delayMs = 1200 } = {}) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(delayMs * attempt);
      }
    }
  }

  throw lastError;
};

const warmBackend = () => {
  if (backendWarmPromise) {
    return backendWarmPromise;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  backendWarmPromise = fetch(apiUrl('/api/health'), {
    method: 'GET',
    cache: 'no-store',
    signal: controller.signal,
  })
    .catch(() => null)
    .finally(() => {
      clearTimeout(timeout);
      backendWarmPromise = null;
    });

  return backendWarmPromise;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!isLocalhost) {
      warmBackend();
    }

    if (isLocalhost && !shouldKeepLocalAuth) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setLoading(false);
      return;
    }

    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      await warmBackend();
      const response = await withRetry(() => axios.post(apiUrl('/api/auth/login'), {
        email: normalizeEmail(email),
        password,
      }), { attempts: 3, delayMs: 1500 });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Logged in successfully!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
      return false;
    }
  };

  const adminLogin = async (email, password) => {
    try {
      await warmBackend();
      const response = await withRetry(() => axios.post(apiUrl('/api/auth/admin-login'), {
        email: normalizeEmail(email),
        password,
      }), { attempts: 3, delayMs: 1500 });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Admin access granted!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Admin login failed');
      return false;
    }
  };

  const register = async (email, password) => {
    try {
      await warmBackend();
      const response = await withRetry(() => axios.post(apiUrl('/api/auth/register'), {
        email: normalizeEmail(email),
        password,
      }), { attempts: 3, delayMs: 1500 });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Registered successfully!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success('Logged out successfully!');
  };

  return (
    <AuthContext.Provider value={{ user, login, adminLogin, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};