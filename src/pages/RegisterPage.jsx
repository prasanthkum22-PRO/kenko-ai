import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { roleHome } from '../config/navigation';
import { isValidEmail, isStrongPassword, getApiError } from '../utils/helpers';
import { IconSun, IconMoon } from '../components/icons';

const UserSilhouetteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

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

const UserRegisterAvatar = () => (
  <div className="neu-avatar-outer">
    <div className="neu-avatar-inner">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  </div>
);

export default function RegisterPage() {
  const { register, isAuthenticated, user } = useAuth();
  const { success, error: toastError } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'PATIENT' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && user.role) {
      navigate(roleHome(user.role), { replace: true });
    } else if (isAuthenticated && user) {
      navigate('/unauthorized', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email) e.email = 'Email is required';
    else if (!isValidEmail(form.email)) e.email = 'Enter a valid email address';
    if (!form.password) e.password = 'Password is required';
    else if (!isStrongPassword(form.password))
      e.password = 'At least 8 characters with letters & numbers';
    if (!form.confirm) e.confirm = 'Please confirm password';
    else if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
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
      const user = await register({
        name: form.name.trim(),
        email: form.email,
        password: form.password,
        role: form.role,
      });
      success(`Account created successfully! Welcome, ${user.full_name}`, 'Registration Success');
      navigate(roleHome(user.role), { replace: true });
    } catch (err) {
      const errMsg = getApiError(err);
      setApiError(errMsg);
      toastError(errMsg, 'Registration Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neu-auth-wrapper" id="register-page">
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
        {/* Embossed Register Avatar */}
        <UserRegisterAvatar />

        {/* Header */}
        <div className="neu-auth-header">
          <h1 className="neu-auth-title">Register</h1>
          <p className="neu-auth-subtitle">Create your secure clinical identity</p>
        </div>

        {apiError && (
          <div className="neu-alert neu-alert-error" role="alert">
            <AlertIcon />
            <span>{apiError}</span>
          </div>
        )}

        <form className="neu-auth-form" onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="neu-form-group">
            <div className={`neu-input-pill ${errors.name ? 'neu-input-error' : ''}`}>
              <span className="neu-input-icon">
                <UserSilhouetteIcon />
              </span>
              <input
                id="reg-name"
                name="name"
                type="text"
                className="neu-input-field"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                disabled={loading}
                required
              />
            </div>
            {errors.name && <span className="neu-field-error">{errors.name}</span>}
          </div>

          {/* Email Address */}
          <div className="neu-form-group">
            <div className={`neu-input-pill ${errors.email ? 'neu-input-error' : ''}`}>
              <span className="neu-input-icon">
                <MailIcon />
              </span>
              <input
                id="reg-email"
                name="email"
                type="email"
                className="neu-input-field"
                placeholder="name@hospital.org"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={loading}
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
                id="reg-password"
                name="password"
                type={showPw ? 'text' : 'password'}
                className="neu-input-field"
                placeholder="Password (min 8 chars)"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                disabled={loading}
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

          {/* Confirm Password */}
          <div className="neu-form-group">
            <div className={`neu-input-pill ${errors.confirm ? 'neu-input-error' : ''}`}>
              <span className="neu-input-icon">
                <LockIcon />
              </span>
              <input
                id="reg-confirm"
                name="confirm"
                type={showConfirmPw ? 'text' : 'password'}
                className="neu-input-field"
                placeholder="Confirm password"
                value={form.confirm}
                onChange={handleChange}
                autoComplete="new-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="neu-eye-btn"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
              >
                <EyeIcon off={showConfirmPw} />
              </button>
            </div>
            {errors.confirm && <span className="neu-field-error">{errors.confirm}</span>}
          </div>

          {/* Role Pill Selector */}
          <div className="neu-role-picker">
            <label className="neu-picker-label">Account Role</label>
            <div className="neu-role-pills">
              {['PATIENT', 'DOCTOR', 'NURSE'].map((r) => (
                <button
                  type="button"
                  key={r}
                  className={`neu-role-pill ${form.role === r ? 'active' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, role: r }))}
                >
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="neu-btn-primary"
            disabled={loading}
            id="register-submit"
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <span className="neu-btn-loading">
                <span className="neu-mini-spinner" />
                <span>Creating Account...</span>
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="neu-card-footer">
          <span>Already have an account? </span>
          <Link to="/login" className="neu-brand-link" id="register-to-login">
            Sign In
          </Link>
        </div>
      </div>

      <p className="neu-compliance-note">
        Protected by HIPAA-compliant authentication &amp; AES-256 clinical encryption
      </p>
    </div>
  );
}