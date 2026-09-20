import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../context/RoleContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import RoleSwitcher from './RoleSwitcher';
import { getFirstName } from '../utils/helpers';
import { roleHome } from '../config/navigation';
import {
  IconMenu,
  IconDashboard,
  IconVideo,
  IconRx,
  IconSun,
  IconMoon,
  IconChevronDown,
  IconLogout,
} from './icons';

/**
 * Top navigation bar — brand, identity, theme toggle and profile menu.
 */
export default function Navbar({ onMenuToggle, sidebarOpen }) {
  const { user, logout } = useAuth();
  const { roleConfig } = useRole();
  const { info } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const userRoleDashboard = roleHome(user?.role);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setProfileOpen(false);
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          id="navbar-menu-toggle"
          className="navbar-menu-btn"
          onClick={onMenuToggle}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={sidebarOpen}
        >
          <IconMenu size={20} />
        </button>

        <Link to={userRoleDashboard} className="navbar-brand">
          <span className="navbar-brand-icon">K</span>
          <span>KENKO&nbsp;AI</span>
        </Link>

        <span className="hide-mobile text-label">Clinical Intelligence Platform</span>
      </div>

      <div className="navbar-right">
        <button
          type="button"
          id="theme-toggle-btn"
          className="navbar-icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme mode"
        >
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>

        {user?.role === 'admin' && <RoleSwitcher />}

        <div className="navbar-profile" ref={profileRef}>
          <button
            id="navbar-profile-btn"
            className="navbar-avatar-btn"
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={profileOpen}
          >
            <span className="avatar">
              {getFirstName(user?.name || user?.full_name || 'User').charAt(0).toUpperCase()}
            </span>
            <span className="navbar-username hide-mobile">
              {getFirstName(user?.name || user?.full_name || 'User')}
            </span>
            <IconChevronDown size={14} className={`chevron ${profileOpen ? 'chevron-up' : ''}`} />
          </button>

          {profileOpen && (
            <>
              <div className="dropdown-overlay" onClick={() => setProfileOpen(false)} />
              <div className="dropdown-menu animate-fade-in">
                <div className="dropdown-header">
                  <span className="avatar avatar-lg">
                    {getFirstName(user?.name || user?.full_name || 'User').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {user?.name || user?.full_name || roleConfig.name}
                    </p>
                    <p className="text-xs text-muted truncate">{roleConfig.label}</p>
                    {user?.email && <p className="text-xs text-muted truncate">{user.email}</p>}
                  </div>
                </div>
                <div className="dropdown-divider" />
                <Link to={userRoleDashboard} className="dropdown-item" onClick={() => setProfileOpen(false)}>
                  <IconDashboard size={17} />
                  My Workspace
                </Link>
                <Link to="/consultations/video" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                  <IconVideo size={17} />
                  Telehealth Room
                </Link>
                {(user?.role === 'doctor' || user?.role === 'pharmacist' || user?.role === 'admin') && (
                  <Link to="/prescriptions" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                    <IconRx size={17} />
                    Prescription Studio
                  </Link>
                )}
                <div className="dropdown-divider" />
                <button id="navbar-logout-btn" className="dropdown-item dropdown-item-danger" onClick={async () => {
                  setProfileOpen(false);
                  info('You have been signed out safely.', 'Session Closed');
                  await logout();
                  navigate('/login');
                }}>
                  <IconLogout size={16} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}