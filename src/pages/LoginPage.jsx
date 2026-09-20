import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { roleHome } from '../config/navigation';
import { isValidEmail } from '../utils/helpers';
import { IconSun, IconMoon } from '../components/icons';

const UserSilhouetteIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const UserAvatarEmbossed = () => (
  <div className="neu-avatar-outer">
    <div className="neu-avatar-inner">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-2c0-3.33-6.67-5-10-5z" />
      </svg>
    </div>
  </div>
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

const GoogleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29A7.19 7.19 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
  </svg>
);

const AppleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.78 1.06-1.85.94-2.94-.93.04-2.09.63-2.75 1.4-.58.68-1.09 1.77-.95 2.83 1.04.08 2.13-.53 2.76-1.29z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export default function LoginPage() {
  const { login, resetPassword, signInWithGoogle, isAuthenticated, user } = useAuth();
  const { success, error: toastError, info } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const fromPath = location.state?.from?.pathname;
      const target = fromPath && fromPath !== '/login' ? fromPath : roleHome(user.role);
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Username or email is required';
    else if (form.email.includes('@') && !isValidEmail(form.email)) e.email = 'Enter a valid email address';
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
      if (!loggedUser.role) {
        info('Your account is pending role provisioning. An administrator must assign your clinical role.', 'Access Pending');
        navigate('/unauthorized', { replace: true });
        return;
      }
      success(`Welcome back, ${loggedUser.name || 'User'}!`, 'Verified Sign-In');
      const target = roleHome(loggedUser.role);
      navigate(target, { replace: true });
    } catch (err) {
      const errMsg = err.message || 'Invalid email or password';
      setApiError(errMsg);
      toastError(errMsg, 'Authentication Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setApiError('');
    try {
      const appUser = await signInWithGoogle();
      if (!appUser) return;
      if (!appUser.role) {
        info('Your account is pending role provisioning. An administrator must assign your clinical role.', 'Access Pending');
        navigate('/unauthorized', { replace: true });
        return;
      }
      success(`Welcome back, ${appUser.name || 'User'}!`, 'Google Verified');
      const target = roleHome(appUser.role);
      navigate(target, { replace: true });
    } catch (err) {
      const errMsg = err.message || 'Google sign-in failed. Please try again.';
      setApiError(errMsg);
      toastError(errMsg, 'Authentication Failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSocialClick = (provider) => {
    if (provider === 'google') {
      handleGoogleSignIn();
    } else {
      info(`${provider} sign-in is enabled for single sign-on. Use Google or email credentials for this workspace.`, `${provider} SSO`);
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
      info('Password reset instructions sent to your email.', 'Check Inbox');
      setForgotModalOpen(false);
    } catch (err) {
      toastError(err.message, 'Reset Failed');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="neu-auth-wrapper" id="gateway-login-page">
      {/* Top Floating Theme Switcher */}
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
        {/* Embossed Circular Avatar Badge */}
        <UserAvatarEmbossed />

        {/* Header */}
        <div className="neu-auth-header">
          <h1 className="neu-auth-title">Login</h1>
          <p className="neu-auth-subtitle">Welcome back! Please sign in</p>
        </div>

        {apiError && (
          <div className="neu-alert neu-alert-error" role="alert">
            <AlertIcon />
            <span>{apiError}</span>
          </div>
        )}

        {/* Login Form */}
        <form className="neu-auth-form" onSubmit={handleSubmit} noValidate>
          {/* Username / Email Field */}
          <div className="neu-form-group">
            <div className={`neu-input-pill ${errors.email ? 'neu-input-error' : ''}`}>
              <span className="neu-input-icon">
                <UserSilhouetteIcon />
              </span>
              <input
                id="signin-email"
                type="text"
                name="email"
                className="neu-input-field"
                placeholder="Username or email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
            {errors.email && <span className="neu-field-error">{errors.email}</span>}
          </div>

          {/* Password Field */}
          <div className="neu-form-group">
            <div className={`neu-input-pill ${errors.password ? 'neu-input-error' : ''}`}>
              <span className="neu-input-icon">
                <LockIcon />
              </span>
              <input
                id="signin-password"
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

          {/* Remember me & Forgot Password row */}
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

          {/* Neumorphic Sign In Button */}
          <button
            type="submit"
            className="neu-btn-primary"
            disabled={loading}
            id="signin-submit"
          >
            {loading ? (
              <span className="neu-btn-loading">
                <span className="neu-mini-spinner" />
                <span>Signing In...</span>
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="neu-divider">
          <span className="neu-divider-text">or continue with</span>
        </div>

        {/* 3 Circular Social Buttons */}
        <div className="neu-social-row">
          <button
            type="button"
            className="neu-social-btn"
            onClick={() => handleSocialClick('google')}
            disabled={googleLoading}
            title="Continue with Google"
            aria-label="Continue with Google"
          >
            {googleLoading ? <span className="neu-mini-spinner" /> : <GoogleIcon />}
          </button>

          <button
            type="button"
            className="neu-social-btn"
            onClick={() => handleSocialClick('Apple')}
            title="Continue with Apple"
            aria-label="Continue with Apple"
          >
            <AppleIcon />
          </button>

          <button
            type="button"
            className="neu-social-btn"
            onClick={() => handleSocialClick('Facebook')}
            title="Continue with Facebook"
            aria-label="Continue with Facebook"
          >
            <FacebookIcon />
          </button>
        </div>

        {/* Quick Clinical Portal Shortcuts */}
        <div className="neu-clinical-shortcuts">
          <span className="neu-shortcuts-label">Quick Persona Portals</span>
          <div className="neu-pills-wrap">
            <Link to="/login/doctor" className="neu-portal-pill">Doctor</Link>
            <Link to="/login/patient" className="neu-portal-pill">Patient</Link>
            <Link to="/login/admin" className="neu-portal-pill">Admin</Link>
            <Link to="/login/pharmacy" className="neu-portal-pill">Pharmacy</Link>
            <Link to="/login/lab" className="neu-portal-pill">Lab</Link>
            <Link to="/login/nurse" className="neu-portal-pill">Nurse</Link>
          </div>
        </div>

        {/* Footer */}
        <div className="neu-card-footer">
          <span>New to KENKO-AI? </span>
          <Link to="/register" className="neu-brand-link">
            Create an account
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