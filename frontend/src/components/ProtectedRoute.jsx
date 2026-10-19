import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* Route guard mirroring Auth.requireLogin/requireAdmin/requireDeliveryBoy.
   The auth token itself is validated again by the backend on every request. */
export default function ProtectedRoute({ role = 'customer', children }) {
  const { isLoggedIn, isAdmin, isDeliveryBoy } = useAuth();
  const location = useLocation();
  const redirect = location.pathname + location.search;

  if (role === 'admin') {
    if (!isLoggedIn || !isAdmin) {
      return <Navigate replace to={'/login?role=admin&redirect=' + encodeURIComponent('/admin/dashboard')} />;
    }
    return children;
  }

  if (role === 'delivery') {
    if (!isLoggedIn) {
      return <Navigate replace to={'/login?role=delivery&redirect=' + encodeURIComponent('/delivery/dashboard')} />;
    }
    if (isAdmin) return <Navigate replace to="/admin/dashboard" />;
    if (!isDeliveryBoy) return <Navigate replace to="/" />;
    return children;
  }

  if (!isLoggedIn) {
    return <Navigate replace to={'/login?redirect=' + encodeURIComponent(redirect)} />;
  }
  return children;
}
