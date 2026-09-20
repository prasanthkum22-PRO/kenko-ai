import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { roleHome } from '../config/navigation';

/**
 * RoleGuard — Enforces strict role-based access control.
 * Compares authenticated Firebase user's Firestore role against allowedRoles.
 * Prevents manual URL typing bypass.
 */
export default function RoleGuard({ allowedRoles = [], children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullScreen message="Verifying role permissions..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = user?.role ? String(user.role).toLowerCase() : '';
  const normalizedAllowed = Array.isArray(allowedRoles)
    ? allowedRoles.map((r) => r.toLowerCase())
    : [allowedRoles.toLowerCase()];

  // Unknown role or lack of permission → redirect to the user's authorized
  // dashboard (which resolves to /unauthorized when the role is unassigned).
  if (!userRole || (normalizedAllowed.length > 0 && !normalizedAllowed.includes(userRole))) {
    return <Navigate to={roleHome(userRole)} replace />;
  }

  return children;
}
