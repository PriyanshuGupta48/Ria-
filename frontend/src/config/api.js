const legacyApiUrl = process.env.REACT_APP_API_URL || '';
const normalizedLegacyBase = legacyApiUrl.replace(/\/api\/?$/, '');
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || normalizedLegacyBase || 'http://localhost:3500').replace(/\/+$/, '');

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
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export { API_BASE_URL };
