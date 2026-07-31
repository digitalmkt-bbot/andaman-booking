import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function boot() {
      try {
        const t = getToken();
        if (t) {
          const r = await api.get('/auth/me');
          setUser(r.data.user);
          return;
        }
        // No sign-in required: transparently obtain a shared guest session.
        const g = await api.post('/auth/guest');
        setToken(g.data.token);
        setUser(g.data.user);
      } catch {
        // Token invalid/expired — fall back to a fresh guest session.
        try {
          setToken(null);
          const g = await api.post('/auth/guest');
          setToken(g.data.token);
          setUser(g.data.user);
        } catch {
          setToken(null);
        }
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  async function login(email, password) {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.data.token);
    setUser(r.data.user);
    return r.data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
