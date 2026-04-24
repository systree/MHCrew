import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

/**
 * AdminRoute — wraps any route that requires admin role.
 * Unauthenticated users are sent to login (/), authenticated
 * non-admins are sent to /dashboard.
 */
export default function AdminRoute({ children }) {
  const user            = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
}
