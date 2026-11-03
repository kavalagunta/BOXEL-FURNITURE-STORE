import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, patch, refreshCsrf } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    get('/auth/me')
      .then((d) => setCustomer(d.customer))
      .catch(() => setCustomer(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await post('/auth/login', { email, password });
    await refreshCsrf();
    setCustomer(d.customer);
    return d.customer;
  }, []);

  const register = useCallback(async (payload) => {
    const d = await post('/auth/register', payload);
    await refreshCsrf();
    setCustomer(d.customer);
    return d.customer;
  }, []);

  const logout = useCallback(async () => {
    await post('/auth/logout');
    await refreshCsrf();
    setCustomer(null);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const d = await patch('/auth/me', payload);
    setCustomer(d.customer);
  }, []);

  const value = useMemo(() => ({ customer, ready, login, register, logout, updateProfile }), [customer, ready, login, register, logout, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
