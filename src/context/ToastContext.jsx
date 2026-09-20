import React, { createContext, useContext, useState, useCallback } from 'react';
import { IconCheck, IconX, IconAlert, IconInfo } from '../components/icons';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', title = '', duration = 4000) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const newToast = { id, message, type, title };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((msg, title = 'Success') => addToast(msg, 'success', title), [addToast]);
  const error = useCallback((msg, title = 'Error') => addToast(msg, 'error', title, 5000), [addToast]);
  const warning = useCallback((msg, title = 'Warning') => addToast(msg, 'warning', title), [addToast]);
  const info = useCallback((msg, title = 'Info') => addToast(msg, 'info', title), [addToast]);

  const value = {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item toast-${toast.type} glass-card animate-slide-in`}
            role="alert"
          >
            <div className="toast-icon">
              {toast.type === 'success' && <IconCheck size={14} />}
              {toast.type === 'error' && <IconX size={14} />}
              {toast.type === 'warning' && <IconAlert size={14} />}
              {toast.type === 'info' && <IconInfo size={14} />}
            </div>
            <div className="toast-content">
              {toast.title && <p className="toast-title">{toast.title}</p>}
              <p className="toast-message">{toast.message}</p>
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export default ToastContext;
