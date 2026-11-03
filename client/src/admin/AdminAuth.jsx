import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, refreshCsrf } from '../services/api.js';

const AdminAuthContext = createContext(null);

// Mirrors the server's role rules so the UI hides what the API would refuse anyway.
// The server checks every request; this is only for a tidier interface.
export const can = (admin, area) => {
  if (!admin) return false;
  if (admin.role === 'super_admin') return true;
  const support = ['dashboard', 'orders', 'customers', 'reviews', 'enquiries'];
  if (admin.role === 'support') return support.includes(area);
  return area !== 'users' && area !== 'email-config';
};

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await get('/admin/auth/me');
      setAdmin(d.admin);
    } catch {
      setAdmin(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onSignedOut = () => setAdmin(null);
    window.addEventListener('boxel:admin-signed-out', onSignedOut);
    return () => window.removeEventListener('boxel:admin-signed-out', onSignedOut);
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const d = await post('/admin/auth/login', { email, password });
    await refreshCsrf();
    setAdmin(d.admin);
  }, []);

  const logout = useCallback(async () => {
    await post('/admin/auth/logout');
    await refreshCsrf();
    setAdmin(null);
  }, []);

  const value = useMemo(() => ({ admin, ready, login, logout, refresh }), [admin, ready, login, logout, refresh]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export const useAdmin = () => useContext(AdminAuthContext);
