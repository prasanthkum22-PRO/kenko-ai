import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { IconGoogleMeet, IconCheck, IconAlert } from '../components/icons';

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
      if (envUrl && envUrl.startsWith('https://')) return envUrl;
      return window.location.origin;
    }
  }
  return envUrl || 'http://localhost:8000';
};

export default function GoogleOAuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: toastError, info } = useToast();

  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('Connecting your Google account...');

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error') || searchParams.get('error_msg');
      const googleAuthParam = searchParams.get('google_auth');

      // 1. Check for error returned directly from Google
      if (errorParam) {
        if (!active) return;
        setStatus('error');
        setStatusMessage(`Google authorization was cancelled or denied (${errorParam}).`);
        toastError('Google authorization was not completed.', 'OAuth Cancelled');
        setTimeout(() => {
          navigate('/consultations', { replace: true });
        }, 2000);
        return;
      }

      // 2. Check if already handled and redirected with success params
      if (googleAuthParam === 'success') {
        if (!active) return;
        setStatus('success');
        setStatusMessage('Google account connected successfully.');
        success('Google connected. You can now create Google Meet spaces.', 'Google Connected');
        const defaultTarget = '/consultations';
        setTimeout(() => {
          navigate(defaultTarget, { replace: true });
        }, 1500);
        return;
      }

      // 3. Authorization code present -> exchange via backend
      if (!code) {
        if (!active) return;
        setStatus('error');
        setStatusMessage('No authorization code was found in the callback URL.');
        setTimeout(() => {
          navigate('/consultations', { replace: true });
        }, 2000);
        return;
      }

      try {
        const baseUrl = getApiBaseUrl();
        const token = localStorage.getItem('medibridge_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await axios.post(
          `${baseUrl}/api/google/callback`,
          { code, state },
          { headers, timeout: 35000 }
        );

        if (!active) return;

        const data = res.data || {};
        const consultationId = data.consultation_id;
        const appointmentId = data.appointment_id;
        // Note: No meetingUri here — Meet is only created by explicit "Create Meeting" action by doctor
        const targetUrl = data.return_url
          || (consultationId ? `/consultations/video?id=${consultationId}` : '/consultations');

        setStatus('success');
        setStatusMessage('Google account connected. You can now create a Google Meet room.');
        success('Google connected successfully. Click Create Meeting to start the consultation.', 'Google Connected');

        setTimeout(() => {
          navigate(targetUrl, { replace: true });
        }, 1800);
      } catch (err) {
        if (!active) return;
        console.error('OAuth Callback exchange error:', err);
        const errData = err?.response?.data;
        const errCode = errData?.error || '';
        const errMsg = errData?.message || errData?.detail || err?.message || 'Could not complete Google authorization.';
        setStatus('error');
        setStatusMessage(errCode ? `[${errCode}] ${errMsg}` : errMsg);
        toastError(errMsg, 'OAuth Error');
        setTimeout(() => {
          navigate('/consultations', { replace: true });
        }, 4000);
      }
    }

    handleCallback();
    return () => {
      active = false;
    };
  }, [location, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-base)',
        padding: '24px',
      }}
    >
      <div
        className="glass-card animate-scale-up"
        style={{
          maxWidth: 440,
          width: '100%',
          padding: '36px 28px',
          textAlign: 'center',
          borderRadius: '20px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {status === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <span className="spinner" style={{ width: 44, height: 44 }} />
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <IconGoogleMeet size={24} />
              <span>Google Meet OAuth</span>
            </div>
            <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>
              {statusMessage}
            </p>
            <p className="text-xs text-muted">
              Exchanging authorization code with Google...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconCheck size={28} />
            </div>
            <div className="font-bold text-lg text-primary">Google Account Connected</div>
            <p className="text-sm text-secondary">{statusMessage}</p>
            <p className="text-xs text-muted">Redirecting you back to your consultation...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconAlert size={28} />
            </div>
            <div className="font-bold text-lg text-danger">Authorization Error</div>
            <p className="text-sm text-secondary">{statusMessage}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-2"
              onClick={() => navigate('/consultations', { replace: true })}
            >
              Return to Consultations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
