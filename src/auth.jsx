import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('itsm:logout', onLogout);
    return () => window.removeEventListener('itsm:logout', onLogout);
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    setUser(user);
    return user;
  };

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* session already gone */ }
    clearToken();
    setUser(null);
  };

  const isIT = user && ['AGENT', 'TEAM_LEAD', 'ADMIN'].includes(user.role);

  return (
    <AuthCtx.Provider value={{ user, setUser, login, logout, booting, isIT }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
