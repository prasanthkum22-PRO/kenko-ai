import { useNavigate } from 'react-router-dom';
import { useRole, ROLES } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { roleHome } from '../config/navigation';

/**
 * Demo role switcher for System Admins.
 * Switches the active session role and routes to that role's workspace.
 */
export default function RoleSwitcher() {
  const { activeRole } = useRole();
  const { loginAsDemoRole } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();

  const handleRoleChange = async (roleKey, roleLabel) => {
    const key = roleKey.toLowerCase();
    info(`Switching session to ${roleLabel} workspace...`, 'Role context');
    try {
      await loginAsDemoRole(key);
      navigate(roleHome(key));
    } catch (e) {
      console.warn('Role switch note:', e.message);
    }
  };

  return (
    <div className="role-switcher" role="tablist" aria-label="Clinical role switcher">
      {Object.values(ROLES)
        .filter((role) => role.id !== 'unknown')
        .map((role) => {
        const isActive = (activeRole || '').toLowerCase() === (role.id || '').toLowerCase();
        const RoleIcon = role.icon;
        return (
          <button
            key={role.id}
            id={`role-btn-${role.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`role-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => handleRoleChange(role.id, role.label)}
            title={`Switch to ${role.label} (${role.name})`}
          >
            <span className="role-icon">
              <RoleIcon size={14} />
            </span>
            <span className="role-label-text">{role.label}</span>
          </button>
        );
      })}
    </div>
  );
}