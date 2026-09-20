/**
 * KENKO-AI Utility Helpers
 * Note: Auth token management is handled by Firebase SDK.
 * No manual localStorage token logic needed.
 */

// ─── String Helpers ──────────────────────────────────────────

/**
 * Get first name from a full name string
 */
export const getFirstName = (name = '') => {
  if (!name) return 'there';
  return name.split(' ')[0];
};

/**
 * Get initials from a name (up to 2 chars)
 */
export const getInitials = (name = '') => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
};

// ─── Date / Time Helpers ─────────────────────────────────────

/**
 * Get greeting based on current hour
 */
export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Format a date string to "MMM D, YYYY"
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr));
};

/**
 * Format a date to relative time (e.g. "2 hours ago")
 */
export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  const intervals = [
    { label: 'year',   secs: 31536000 },
    { label: 'month',  secs: 2592000  },
    { label: 'week',   secs: 604800   },
    { label: 'day',    secs: 86400    },
    { label: 'hour',   secs: 3600     },
    { label: 'minute', secs: 60       },
  ];
  for (const { label, secs } of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count} ${label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};

// ─── Number Helpers ──────────────────────────────────────────

/**
 * Format a number with commas (e.g. 10000 → "10,000")
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Calculate percentage safely
 */
export const calcPercent = (value, total) => {
  if (!total || total === 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
};

// ─── Validation Helpers ──────────────────────────────────────

export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isStrongPassword = (pw) => {
  if (!pw || pw.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  return hasLetter && hasNumber;
};


/**
 * Extract a user-friendly error message from a Firebase or Axios error
 */
export const getApiError = (error) => {
  // Firebase Auth errors
  const firebaseMessages = {
    'auth/user-not-found':        'No account found with this email.',
    'auth/wrong-password':        'Incorrect password. Please try again.',
    'auth/invalid-credential':    'Invalid email or password.',
    'auth/email-already-in-use':  'An account with this email already exists.',
    'auth/weak-password':         'Password should be at least 6 characters.',
    'auth/too-many-requests':     'Too many failed attempts. Please try again later.',
    'auth/network-request-failed':'Network error. Please check your connection.',
    'auth/popup-closed-by-user':  'Sign-in was cancelled.',
    'auth/invalid-email':         'Invalid email address format.',
    'auth/user-disabled':         'This account has been disabled.',
  };

  const code = error?.code;
  if (code && firebaseMessages[code]) return firebaseMessages[code];

  // Axios / backend errors
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
};
