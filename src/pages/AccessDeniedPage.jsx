import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconShield, IconAlert, IconLogout } from '../components/icons';

/**
 * Access-pending / unauthorized landing page.
 * Shown when a session cannot be mapped to a provisioned clinical role.
 * Roles are NEVER silently defaulted — an unassigned user sees this instead.
 */
export default function AccessDeniedPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="auth-page" id="access-denied-page">
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              margin: '0 auto 16px',
              borderRadius: 14,
              background: 'var(--color-warning-subtle, #FFF4E5)',
              color: 'var(--color-warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconShield size={26} />
          </div>

          <div className="auth-header">
            <h1 className="auth-title">Role Access Pending</h1>
            <p className="auth-subtitle">
              You are signed in, but no clinical role is assigned to your account yet.
            </p>
          </div>

          <div className="alert alert-warning" role="alert" style={{ textAlign: 'left' }}>
            <IconAlert size={16} className="flex-shrink-0" style={{ marginTop: 2 }} />
            <span>
              <strong>Access is not granted automatically.</strong> An administrator must provision
              your role before protected clinical data can be opened. Patient-only self-service
              accounts are created for new users.
            </span>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/', { replace: true })}>
              Retry role verification
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
              <IconLogout size={15} /> Sign out
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/login', { replace: true })}>
              Switch account
            </button>
          </div>

          {user?.email && (
            <p className="text-xs text-muted mt-4" style={{ wordBreak: 'break-all' }}>
              Session: {user.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}