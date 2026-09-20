import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { isValidEmail } from '../../utils/helpers';
import { roleHome } from '../../config/navigation';
import { IconSun, IconMoon } from '../../components/icons';

const ROLE_CONFIGS = {
  admin: {
    role: 'admin',
    title: 'Admin Portal',
    subtitle: 'System infrastructure & compliance',
    badge: 'Admin Access',
    defaultEmail: 'admin@medibridge.ai',
    defaultPass: 'Admin123!',
    targetRoute: '/admin',
    disclaimer: 'Authorized KENKO-AI system administrators only.',
    icon: (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
      </svg>
    ),
  },
  doctor: {
    role: 'doctor',
    title: 'Doctor Portal',
    subtitle: 'Consultations, Telehealth & EHR',
    badge: 'Physician Access',
    defaultEmail: 'doctor@medibridge.ai',
    defaultPass: 'Doctor123!',
    targetRoute: '/doctor',
    disclaimer: 'Licensed healthcare practitioners only.',
    icon: (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
      </svg>
    ),
  },
  nurse: {
    role: 'nurse',
    title: 'Nursing Portal',
    subtitle: 'Vitals triage & patient care plans',
    badge: 'Nursing Access',
    defaultEmail: 'nurse@medibridge.ai',
    defaultPass: 'Nurse123!',
    targetRoute: '/nurse',
    disclaimer: 'Registered nursing staff only.',
    icon: (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    ),
  },
  lab: {
    role: 'lab',
    title: 'Pathology & Lab',
    subtitle: 'Diagnostic specimens & analytics',
    badge: 'Diagnostics Access',
    defaultEmail: 'lab@medibridge.ai',
    defaultPass: 'LabTech123!',
    targetRoute: '/lab',
    disclaimer: 'Certified laboratory technicians only.',
    icon: (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
      </svg>
    ),
  },
  pharmacist: {
    role: 'pharmacist',
    title: 'Pharmacy Portal',
    subtitle: 'Prescriptions & formulary control',
    badge: 'Pharmacy Access',
    defaultEmail: 'pharmacist@medibridge.ai',
    defaultPass: 'Pharmacy123!',
    targetRoute: '/pharmacy',
    disclaimer: 'Registered clinical pharmacists only.',
    icon: (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.5 10.5C3.67 10.5 3 11.17 3 12s.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-15zM12 4.5c-.83 0-1.5.67-1.5 1.5v12c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V6c0-.83-.67-1.5-1.5-1.5z"/>
      </svg>
    ),
  },
  patient: {
    role: 'patient',
    title: 'Patient Portal',
    subtitle: 'Telehealth, records & care plan',
    badge: 'Patient Access',
    defaultEmail: 'patient@medibridge.ai',
    defaultPass: 'Patient123!',
    targetRoute: '/patient',
    disclaimer: 'Secure patient portal for health records.',
    icon: (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-2c0-3.33-6.67-5-10-5z" />
      </svg>
    ),
  },
};

const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    ) : (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export default function RoleLoginPage({ roleKey = 'doctor' }) {
  const config = ROLE_CONFIGS[roleKey] || ROLE_CONFIGS.doctor;
  const { login, resetPassword, isAuthenticated, user } = useAuth();
  const { success, error: toastError, info } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: config.defaultEmail,
    password: config.defaultPass,
  });
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(roleHome(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email address is required';
    else if (!isValidEmail(form.email)) e.email = 'Enter a valid email address';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    setApiError('');
    try {
      const loggedUser = await login({ email: form.email, password: form.password });
      const loggedRole = loggedUser.role ? String(loggedUser.role).toLowerCase() : '';

      if (!loggedRole) {
        info('Your account is pending role provisioning. An administrator must assign your clinical role.', 'Access Pending');
        navigate('/unauthorized', { replace: true });
        return;
      }

      if (loggedRole !== config.role && loggedRole !== 'admin') {
        info(
          `Logged in as ${loggedRole.toUpperCase()}. Redirecting to your assigned dashboard.`,
          'Role Verification'
        );
      } else {
        success(`Welcome, ${loggedUser.name || loggedUser.email}!`, `${config.badge} Verified`);
      }

      const dest = roleHome(loggedRole);
      navigate(dest, { replace: true });
    } catch (err) {
      const errMsg = err.message || 'Invalid email or password for this portal.';
      setApiError(errMsg);
      toastError(errMsg, 'Authentication Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(forgotEmail)) {
      toastError('Please enter a valid email address.', 'Invalid Email');
      return;
    }
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail);
      info('Password reset link sent to your email.', 'Check Inbox');
      setForgotModalOpen(false);
    } catch (err) {
      toastError(err.message, 'Reset Failed');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="neu-auth-wrapper" id={`${config.role}-login-page`}>
      {/* Theme Switcher */}
      <div className="neu-theme-toggle-container">
        <button
          type="button"
          className="neu-theme-pill-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          <span className="neu-theme-icon-slot">
            {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
          </span>
          <span className="neu-theme-text">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="neu-phone-card">
        {/* Embossed Role Avatar */}
        <div className="neu-avatar-outer">
          <div className="neu-avatar-inner">
            {config.icon}
          </div>
        </div>

        {/* Header */}
        <div className="neu-auth-header">
          <h1 className="neu-auth-title">{config.title}</h1>
          <p className="neu-auth-subtitle">{config.subtitle}</p>
          <div style={{ marginTop: 8 }}>
            <span className="neu-badge-pill">{config.badge}</span>
          </div>
        </div>

        {apiError && (
          <div className="neu-alert neu-alert-error" role="alert">
            <AlertIcon />
            <span>{apiError}</span>
          </div>
        )}

        <form className="neu-auth-form" onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="neu-form-group">
            <div className={`neu-input-pill ${errors.email ? 'neu-input-error' : ''}`}>
              <span className="neu-input-icon">
                <MailIcon />
              </span>
              <input
                id={`${config.role}-email`}
                type="email"
                name="email"
                className="neu-input-field"
                placeholder="name@hospital.org"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
            {errors.email && <span className="neu-field-error">{errors.email}</span>}
          </div>

          {/* Password */}
          <div className="neu-form-group">
            <div className={`neu-input-pill ${errors.password ? 'neu-input-error' : ''}`}>
              <span className="neu-input-icon">
                <LockIcon />
              </span>
              <input
                id={`${config.role}-password`}
                type={showPw ? 'text' : 'password'}
                name="password"
                className="neu-input-field"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="neu-eye-btn"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <EyeIcon off={showPw} />
              </button>
            </div>
            {errors.password && <span className="neu-field-error">{errors.password}</span>}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="neu-form-row">
            <label className="neu-checkbox-label">
              <input
                type="checkbox"
                className="neu-checkbox-native"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="neu-checkbox-box">
                {rememberMe && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className="neu-checkbox-text">Remember me</span>
            </label>

            <button
              type="button"
              className="neu-forgot-link"
              onClick={() => {
                setForgotEmail(form.email);
                setForgotModalOpen(true);
              }}
            >
              Forgot Password?
            </button>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            className="neu-btn-primary"
            disabled={loading}
            id={`${config.role}-login-submit-btn`}
          >
            {loading ? (
              <span className="neu-btn-loading">
                <span className="neu-mini-spinner" />
                <span>Verifying credentials...</span>
              </span>
            ) : (
              `Sign In as ${config.role.charAt(0).toUpperCase() + config.role.slice(1)}`
            )}
          </button>
        </form>

        <p className="neu-disclaimer-text">{config.disclaimer}</p>

        {/* Footer */}
        <div className="neu-card-footer">
          <Link to="/login" className="neu-brand-link">
            &larr; Return to main portal
          </Link>
        </div>
      </div>

      <p className="neu-compliance-note">
        Protected by HIPAA-compliant authentication &amp; AES-256 clinical encryption
      </p>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="neu-modal-backdrop" onClick={() => setForgotModalOpen(false)}>
          <div className="neu-modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="neu-modal-title">Reset Password</h3>
            <p className="neu-modal-desc">
              Enter your registered clinical email to receive secure recovery instructions.
            </p>
            <form onSubmit={handleForgotPasswordSubmit}>
              <div className="neu-input-pill" style={{ marginBottom: 16 }}>
                <input
                  type="email"
                  className="neu-input-field"
                  placeholder="name@hospital.org"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="neu-modal-actions">
                <button type="button" className="neu-btn-secondary" onClick={() => setForgotModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="neu-btn-primary" disabled={forgotLoading}>
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}