import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../context/RoleContext';
import { getRoleNavigation } from '../config/navigation';
import { IconLogout } from './icons';

/**
 * Role-aware sidebar navigation with grouped sections.
 */
export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { roleConfig } = useRole();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  const userRole = String(user?.role || '').toLowerCase();
  const groups = getRoleNavigation(userRole);
  const RoleIcon = roleConfig.icon;

  const homepageIds = ['admin', 'doctor', 'nurse', 'lab', 'pharmacist', 'patient'];
  const isHome = (to) =>
    homepageIds.some((r) => to === `/${r}`);

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} id="app-sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">K</span>
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-title">KENKO AI</span>
            <span className="sidebar-brand-subtitle">Clinical Intelligence</span>
          </span>
        </div>

        <div className="sidebar-role-card">
          <span className="sidebar-role-icon">
            <RoleIcon size={18} />
          </span>
          <span className="sidebar-role-info">
            <span className="sidebar-role-name">
              {user?.name || user?.full_name || roleConfig.name}
            </span>
            <span className="sidebar-role-dept">{roleConfig.label}</span>
          </span>
        </div>

        {groups.map((group, gi) => (
          <div className="sidebar-section" key={gi}>
            <span className="sidebar-section-title">{group.label}</span>
            <nav className="sidebar-nav">
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    id={item.id}
                    to={item.to}
                    end={item.end ?? isHome(item.to)}
                    title={item.label}
                    className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <span className="sidebar-nav-icon">
                      <ItemIcon />
                    </span>
                    <span className="sidebar-nav-label">{item.label}</span>
                    {item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-nav-item sidebar-logout-btn"
            onClick={handleLogout}
            id="sidebar-logout-btn"
            title="Sign out"
          >
            <span className="sidebar-nav-icon">
              <IconLogout />
            </span>
            <span className="sidebar-nav-label">Secure Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}