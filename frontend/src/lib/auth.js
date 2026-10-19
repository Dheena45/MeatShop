/* Per-role localStorage keys. Customer keeps the original keys untouched.
   Admin and Delivery Boy tokens/users are stored under their own keys so the
   three sessions can coexist in the same browser without overwriting each
   other. These keys deliberately match the original FreshMeat application so
   existing sessions keep working. */

export const AUTH_KEYS = {
  customer: { token: 'fm_token', user: 'fm_user' },
  admin: { token: 'freshmeat_admin_token', user: 'freshmeat_admin_user' },
  delivery: { token: 'freshmeat_delivery_token', user: 'freshmeat_delivery_user' }
};

/* Server role -> storage bucket. Unknown roles (e.g. customers) -> customer. */
const ROLE_BY_USER_ROLE = {
  ADMIN: 'admin',
  ROLE_ADMIN: 'admin',
  DELIVERY_BOY: 'delivery',
  ROLE_DELIVERY_BOY: 'delivery'
};

/* Which role the CURRENT section of the SPA belongs to. */
let currentRole = 'customer';

export function setAuthRole(role) {
  if (AUTH_KEYS[role]) currentRole = role;
  return currentRole;
}

export function getAuthRole() {
  return currentRole;
}

/* In a single-page app the active role is best derived from the URL, so a
   request made from /admin/* always sends the admin token and one from
   /delivery/* the delivery token — regardless of React effect ordering or of
   another role's session living in the same browser. Pages that need to
   override this (e.g. the admin invoice view at /invoice?admin=1) call
   setAuthRole() explicitly and the path lookup defers to it. */
export function roleForPath(pathname) {
  const p = (pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '').toLowerCase();
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/delivery')) return 'delivery';
  return null;
}

function activeRole(role) {
  return role || roleForPath() || currentRole;
}

export function roleKeyForUser(user) {
  return ROLE_BY_USER_ROLE[user && user.role] || 'customer';
}

function keys(role) {
  return AUTH_KEYS[activeRole(role)] || AUTH_KEYS.customer;
}

export function getToken(role) {
  try { return localStorage.getItem(keys(role).token); } catch (e) { return null; }
}

export function getUser(role) {
  try { return JSON.parse(localStorage.getItem(keys(role).user)); } catch (e) { return null; }
}

export function isLoggedIn(role) {
  return !!getToken(role);
}

/* Saves ONLY the role's own keys. The storage role is taken from the user's
   server-returned role, so an admin or delivery boy logging in through the
   shared login page lands in their own keys without touching another role. */
export function saveAuth(token, user) {
  const k = keys(roleKeyForUser(user));
  if (token) localStorage.setItem(k.token, token);
  localStorage.setItem(k.user, JSON.stringify(user || {}));
}

/* Clears ONLY the given role (or the page role). */
export function clearAuth(role) {
  const k = keys(role);
  localStorage.removeItem(k.token);
  localStorage.removeItem(k.user);
}
