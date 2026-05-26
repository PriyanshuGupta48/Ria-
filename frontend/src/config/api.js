const legacyApiUrl = process.env.REACT_APP_API_URL || '';
const normalizedLegacyBase = legacyApiUrl.replace(/\/api\/?$/, '');
const isLocalApiBase = (value) => /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(value || '').trim());
const defaultApiBaseUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3500'
  : 'https://dhaaga-backend.onrender.com';

const envApiBase = process.env.REACT_APP_API_BASE_URL || normalizedLegacyBase;

const API_BASE_URL = (
  process.env.NODE_ENV === 'production' && isLocalApiBase(envApiBase)
    ? defaultApiBaseUrl
    : (envApiBase || defaultApiBaseUrl)
).replace(/\/+$/, '');

export const apiUrl = (path = '') => {
  if (!path) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const assetUrl = (path = '') => {
  if (!path) {
    return API_BASE_URL;
  }

  if (/^https?:\/\//i.test(path)) {
    // If the asset is a Cloudinary URL, inject a default transformation
    try {
      const cloudinaryTransform = process.env.REACT_APP_CLOUDINARY_TRANSFORM || 'c_pad,ar_4:3,b_white,q_auto,f_auto,w_800';
      if (path.includes('res.cloudinary.com') && path.includes('/upload/')) {
        return path.replace('/upload/', `/upload/${cloudinaryTransform}/`);
      }
    } catch (e) {
      // ignore and fall back to original path
    }

    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export { API_BASE_URL };
