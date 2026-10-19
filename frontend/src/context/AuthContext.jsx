import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AUTH_KEYS,
  roleForPath,
  setAuthRole,
  getUser,
  getToken,
  isLoggedIn as isLoggedInFor,
  saveAuth,
  clearAuth
} from '../lib/auth';

/* Section-aware auth context.
   The active role is derived from the URL (/admin/* => admin, /delivery/* =>
   delivery, everything else => customer), matching the module-level role the
   API client uses. Only that role's localStorage keys are read/written here,
   so the three sessions can coexist. */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const role = roleForPath(location.pathname) || 'customer';

  // Keep the API client's module role aligned with the section being rendered.
  setAuthRole(role);

  const [version, setVersion] = useState(0);

  const user = useMemo(
    () => (AUTH_KEYS[role] ? getUser(role) : null),
    [role, version]
  );
  const token = useMemo(
    () => (AUTH_KEYS[role] ? getToken(role) : null),
    [role, version]
  );

  const refresh = useCallback(() => setVersion(v => v + 1), []);

  // Another tab logging in/out should update the header without a reload.
  useEffect(() => {
    function onStorage() { refresh(); }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const value = useMemo(() => ({
    role,
    user,
    token,
    isLoggedIn: !!token,
    isAdmin: !!(user && (user.role === 'ADMIN' || user.role === 'ROLE_ADMIN' || String(user.role).toUpperCase() === 'ADMIN')),
    isDeliveryBoy: !!(user && (user.role === 'DELIVERY_BOY' || user.role === 'ROLE_DELIVERY_BOY' || String(user.role).toUpperCase() === 'DELIVERY_BOY')),
    /* Stores under the role implied by the server-returned user, then refreshes. */
    save: (tok, u) => { saveAuth(tok, u); refresh(); },
    logout: () => { clearAuth(role); refresh(); },
    /* Logout of the customer session specifically (profile page). */
    logoutRole: (r) => { clearAuth(r || role); refresh(); },
    refresh
  }), [role, user, token, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { isLoggedInFor };
