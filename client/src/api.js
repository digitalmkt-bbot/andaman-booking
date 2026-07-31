import axios from 'axios';

const TOKEN_KEY = 'andaman.token';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export function setToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401 && getToken()) {
      // No login screen: drop the stale token and reload to get a fresh guest session.
      setToken(null);
      location.reload();
    }
    return Promise.reject(e);
  }
);

export function apiError(e) {
  return e?.response?.data || { error: 'NETWORK_ERROR' };
}
