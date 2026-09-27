import React, { useState, useEffect } from 'react';
import {
  getGoogleAuthStatus,
  getGoogleAuthUrl,
  disconnectGoogleAuth,
  createGoogleMeet,
  createAppointmentMeet,
  createConsultationGoogleMeet,
  getGoogleMeetStatus,
  getConsultationMeeting,
  endGoogleMeet,
  syncGoogleMeetTranscript,
} from '../services/api';
import {
  acceptAppointmentFirestore,
  getAppointmentFirestore,
  getConsultationFirestore,
  updateAppointmentFirestore,
} from '../services/firestoreService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  IconGoogleMeet,
  IconGoogle,
  IconCheck,
  IconClock,
  IconRefresh,
  IconExternalLink,
  IconShield,
  IconAlert,
  IconVideo,
  IconSettings,
} from './icons';

const extractMeetInfo = (cons, appt) => {
  const uri =
    cons?.google_meeting_uri ||
    cons?.googleMeetingUri ||
    cons?.meetingUri ||
    cons?.meeting?.meetingUrl ||
    cons?.meeting?.meetingUri ||
    appt?.googleMeet?.meetingUri ||
    appt?.google_meeting_uri ||
    appt?.googleMeetingUri ||
    appt?.meeting?.meetingUrl ||
    null;
  const code =
    cons?.google_meeting_code ||
    cons?.googleMeetingCode ||
    cons?.meetingCode ||
    cons?.meeting?.meetingCode ||
    appt?.googleMeet?.meetingCode ||
    appt?.google_meeting_code ||
    appt?.googleMeetingCode ||
    (uri ? uri.split('/').pop() : null);
  const space =
    cons?.google_space_name ||
    cons?.googleSpaceName ||
    cons?.spaceName ||
    cons?.meeting?.spaceName ||
    appt?.googleMeet?.spaceName ||
    appt?.google_space_name ||
    appt?.googleSpaceName ||
    null;
  const status = uri
    ? 'meet_ready'
    : cons?.meeting_status || cons?.meetingStatus || cons?.status || appt?.status || 'scheduled';
  const transcript = cons?.transcript_status || cons?.transcriptStatus || 'pending';
  const createdAt =
    cons?.meeting?.createdAt ||
    cons?.created_at ||
    appt?.googleMeet?.createdAt ||
    appt?.created_at ||
    null;
  return { uri, code, space, status, transcript, createdAt };
};

export default function GoogleMeetCard({
  consultation,
  appointment,
  onTranscriptReady,
  onConsultationUpdated,
  onStatusChange,
  isDoctor = false,
  onViewTranscript,
}) {
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [authStatus, setAuthStatus] = useState({ is_connected: false, email: null, checked: false });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [meetCreationError, setMeetCreationError] = useState(null);

  const initialInfo = extractMeetInfo(consultation, appointment);
  const [meetData, setMeetData] = useState({
    spaceName: initialInfo.space,
    meetingUri: initialInfo.uri,
    meetingCode: initialInfo.code,
    meetingStatus: initialInfo.status,
    transcriptStatus: initialInfo.transcript,
    createdAt: initialInfo.createdAt,
  });

  const [consentConfirmed, setConsentConfirmed] = useState(Boolean(consultation?.has_consent));
  const [consentModalOpen, setConsentModalOpen] = useState(false);

  // Check OAuth status on mount
  useEffect(() => {
    let active = true;
    async function checkAuth() {
      const params = new URLSearchParams(window.location.search);
      const googleAuthParam = params.get('google_auth');
      const googleAuthEmail = params.get('email');
      const meetCreatedParam = params.get('meet_created');
      const meetingUriParam = params.get('meeting_uri');
      const meetingCodeParam = params.get('meeting_code');

      if (googleAuthParam === 'success' && active) {
        success(`Google account connected${googleAuthEmail ? ` (${googleAuthEmail})` : ''}.`, 'OAuth Connected');
        setAuthStatus((prev) => ({
          ...prev,
          is_connected: true,
          email: googleAuthEmail || prev.email,
        }));
        // Clean URL params
        try {
          const url = new URL(window.location.href);
          ['google_auth', 'email', 'error_code', 'error_msg'].forEach((k) => url.searchParams.delete(k));
          window.history.replaceState({}, '', url.pathname + (url.search || ''));
        } catch {}
      } else if (googleAuthParam === 'failed' && active) {
        const errCode = params.get('error_code') || '';
        const errMsg = params.get('error_msg') || 'Google authorization failed.';
        toastError(`${errCode ? `[${errCode}] ` : ''}${errMsg}`, 'OAuth Error');
        // Clean URL params
        try {
          const url = new URL(window.location.href);
          ['google_auth', 'email', 'error_code', 'error_msg'].forEach((k) => url.searchParams.delete(k));
          window.history.replaceState({}, '', url.pathname + (url.search || ''));
        } catch {}
      } else if (googleAuthParam === 'error' && active) {
        toastError('Google authorization was cancelled or denied.', 'OAuth Error');
      }

      const cachedEmail = localStorage.getItem('kenko_doctor_google_email');
      if (cachedEmail && active) {
        setCustomGoogleEmail(cachedEmail);
      }

      try {
        const res = await getGoogleAuthStatus();
        if (active && res) {
          setAuthStatus({
            is_connected: Boolean(res.is_connected),
            email: res.email || null,
            checked: true,
          });
        }
      } catch (err) {
        const errCode = err?.response?.data?.error || '';
        if (active) {
          setAuthStatus({ is_connected: false, email: null, checked: true });
          if (errCode === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
            // Silently set disconnected â€” server is not configured
          }
        }
      }

      // Immediate meeting check on mount
      const consultId = consultation?.id || consultation?.consultation_id || appointment?.consultation_id;
      const apptId = appointment?.id || consultation?.appointment_id;
      if (consultId || apptId) {
        try {
          if (consultId) {
            const mRes = await getConsultationMeeting(consultId).catch(() => null);
            if (active && (mRes?.meeting?.meetingUrl || mRes?.meetingUri || mRes?.meetingUrl)) {
              const uri = mRes.meeting?.meetingUrl || mRes.meetingUri || mRes.meetingUrl;
              const code = mRes.meeting?.meetingCode || mRes.meetingCode || (uri ? uri.split('/').pop() : null);
              const space = mRes.meeting?.spaceName || mRes.spaceName;
              setMeetData((prev) => ({
                ...prev,
                meetingUri: uri,
                meetingCode: code || prev.meetingCode,
                spaceName: space || prev.spaceName,
                meetingStatus: 'meet_ready',
              }));
              if (onStatusChange) onStatusChange('meet_ready');
              if (onConsultationUpdated) onConsultationUpdated();
            }
          }
          if (apptId && active) {
            const aptFs = await getAppointmentFirestore(apptId).catch(() => null);
            const mUri = aptFs?.googleMeetingUri || aptFs?.googleMeet?.meetingUri || aptFs?.meeting?.meetingUrl;
            if (mUri) {
              setMeetData((prev) => ({
                ...prev,
                meetingUri: mUri,
                meetingCode: aptFs?.googleMeetingCode || aptFs?.googleMeet?.meetingCode || aptFs?.meeting?.meetingCode || mUri.split('/').pop(),
                spaceName: aptFs?.googleSpaceName || aptFs?.googleMeet?.spaceName || prev.spaceName,
                meetingStatus: 'meet_ready',
              }));
              if (onStatusChange) onStatusChange('meet_ready');
              if (onConsultationUpdated) onConsultationUpdated();
            }
          }
        } catch {}
      }
    }
    checkAuth();
    return () => { active = false; };
  }, [consultation?.id, appointment?.id]);

  // Sync meetData with props
  useEffect(() => {
    const info = extractMeetInfo(consultation, appointment);
    if (info.uri || info.space || info.code || consultation) {
      setMeetData((prev) => ({
        spaceName: info.space || prev.spaceName,
        meetingUri: info.uri || prev.meetingUri,
        meetingCode: info.code || prev.meetingCode,
        meetingStatus: info.uri ? 'meet_ready' : (info.status || prev.meetingStatus),
        transcriptStatus: info.transcript || prev.transcriptStatus,
        createdAt: info.createdAt || prev.createdAt,
      }));
      if (consultation?.has_consent !== undefined) {
        setConsentConfirmed(Boolean(consultation.has_consent));
      }
    }
  }, [consultation, appointment]);

  // Short-interval polling after mount if meeting not ready yet (2s, 4s, 6s, 8s)
  useEffect(() => {
    if (meetData.meetingUri) return;
    const targetConsultId = consultation?.id || consultation?.consultation_id || appointment?.consultation_id;
    const targetApptId = appointment?.id || consultation?.appointment_id;
    if (!targetConsultId && !targetApptId) return;

    let cancelled = false;
    const delays = [2000, 4000, 6000, 8000];
    const timers = [];

    delays.forEach((delay) => {
      const t = setTimeout(async () => {
        if (cancelled) return;
        try {
          if (targetConsultId) {
            const mRes = await getConsultationMeeting(targetConsultId).catch(() => null);
            if (mRes?.meeting?.meetingUrl || mRes?.meetingUri || mRes?.meetingUrl) {
              const uri = mRes.meeting?.meetingUrl || mRes.meetingUri || mRes.meetingUrl;
              const code = mRes.meeting?.meetingCode || mRes.meetingCode;
              const space = mRes.meeting?.spaceName || mRes.spaceName;
              setMeetData((prev) => ({
                ...prev,
                meetingUri: uri,
                meetingCode: code || (uri ? uri.split('/').pop() : prev.meetingCode),
                spaceName: space || prev.spaceName,
                meetingStatus: 'meet_ready',
              }));
              if (onStatusChange) onStatusChange('meet_ready');
              if (onConsultationUpdated) onConsultationUpdated();
              return;
            }
          }
          if (targetApptId) {
            const aptFs = await getAppointmentFirestore(targetApptId).catch(() => null);
            const mUri = aptFs?.googleMeetingUri || aptFs?.googleMeet?.meetingUri || aptFs?.meeting?.meetingUrl;
            if (mUri) {
              setMeetData((prev) => ({
                ...prev,
                meetingUri: mUri,
                meetingCode: aptFs?.googleMeetingCode || aptFs?.googleMeet?.meetingCode || aptFs?.meeting?.meetingCode || mUri.split('/').pop(),
                spaceName: aptFs?.googleSpaceName || aptFs?.googleMeet?.spaceName || prev.spaceName,
                meetingStatus: 'meet_ready',
              }));
              if (onStatusChange) onStatusChange('meet_ready');
              if (onConsultationUpdated) onConsultationUpdated();
            }
          }
        } catch {}
      }, delay);
      timers.push(t);
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [consultation?.id, appointment?.id, Boolean(meetData.meetingUri)]);

  const handleConnectGoogle = async () => {
    const currentUrl = window.location.href;
    const consultId = consultation?.id || consultation?.consultation_id || appointment?.consultation_id || null;
    const apptId = appointment?.id || consultation?.appointment_id || null;

    try {
      setLoading(true);
      const res = await getGoogleAuthUrl(currentUrl, consultId, apptId);
      if (res?.auth_url) {
        window.location.href = res.auth_url;
        return;
      }
      if (res?.error) {
        toastError(res.message || 'Google OAuth is not configured on the backend.', 'Configuration Required');
      }
    } catch (err) {
      const errDetail = err?.response?.data;
      const errCode = errDetail?.error || '';
      const errMsg = errDetail?.message || err?.message || 'Could not initiate Google authorization.';
      if (errCode === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
        toastError(
          'Google OAuth credentials are not configured on the server. Contact your administrator.',
          'Configuration Error'
        );
      } else {
        toastError(errMsg, 'OAuth Error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await disconnectGoogleAuth();
      setAuthStatus({ is_connected: false, email: null, checked: true });
      info('Google account disconnected.', 'Disconnected');
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to disconnect Google account.';
      toastError(errMsg, 'Disconnect Error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeet = async () => {
    if (!consentConfirmed) { setConsentModalOpen(true); return; }
    setMeetCreationError(null);
    const consultId = consultation?.id || consultation?.consultation_id || appointment?.consultation_id || appointment?.id;
    if (!consultId) {
      toastError('No consultation identifier found.', 'Error');
      return;
    }

    try {
      setLoading(true);
      const res = await createGoogleMeet(consultId, consultation?.patient_id || appointment?.patient_id);
      const meetUri = res?.meetingUri || res?.meetingUrl;
      const meetCode = res?.meetingCode || (meetUri ? meetUri.split('/').pop() : null);
      const spaceName = res?.spaceName || null;

      if (!meetUri) {
        throw new Error(res?.message || 'Google Meet URL was not returned by server.');
      }

      // Update Firestore with real meeting metadata
      const apptId = appointment?.id || consultation?.appointment_id || consultId;
      if (apptId) {
        await acceptAppointmentFirestore(apptId, meetUri, meetCode, spaceName).catch(() => null);
      }

      setMeetData((prev) => ({
        ...prev,
        spaceName: spaceName || prev.spaceName,
        meetingUri: meetUri,
        meetingCode: meetCode || null,
        meetingStatus: 'meet_ready',
      }));
      success('Google Meet Space is ready for consultation.', 'Meeting Ready');
      if (onStatusChange) onStatusChange('meet_ready');
      if (onConsultationUpdated) onConsultationUpdated();
    } catch (err) {
      const errData = err?.response?.data;
      const errObj = errData?.error;
      const errCode = (typeof errObj === 'object' ? errObj?.code : errObj) || errData?.detail?.error || '';
      const errMsg = (typeof errObj === 'object' ? errObj?.message : errData?.message) || errData?.detail?.message || errData?.detail || err?.message || 'Failed to create Google Meet space.';

      if (errCode === 'GOOGLE_TOKEN_REFRESH_FAILED' || (err?.response?.status === 401 && errMsg.includes('refresh'))) {
        toastError('Your Google OAuth token expired and could not be refreshed. Please reconnect Google.', 'Reconnect Required');
        setAuthStatus((prev) => ({ ...prev, is_connected: false }));
        setMeetCreationError('Google token expired. Please reconnect your Google account and try again.');
        setMeetData((prev) => ({ ...prev, meetingStatus: 'meet_creation_failed' }));
      } else if (errCode === 'GOOGLE_AUTH_REQUIRED' || errCode === 'GOOGLE_TOKEN_EXPIRED' || err?.response?.status === 401) {
        toastError('Google authorization is required. Please connect your Google account.', 'Google Account Required');
        setAuthStatus((prev) => ({ ...prev, is_connected: false }));
        setMeetCreationError('Google connection required to generate video rooms.');
      } else if (errCode === 'FIREBASE_SYNC_FAILED') {
        toastError('Meet was created but could not sync to Firestore. Please retry.', 'Sync Failed');
        setMeetCreationError(`FIREBASE_SYNC_FAILED: ${errMsg}`);
      } else {
        const displayErr = errCode ? `[${errCode}] ${errMsg}` : errMsg;
        setMeetCreationError(displayErr);
        setMeetData((prev) => ({ ...prev, meetingStatus: 'meet_creation_failed' }));
        toastError(displayErr, 'Creation Error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeet = () => {
    if (!meetData.meetingUri) {
      toastError('Google Meet link is not ready yet.', 'Cannot Join');
      return;
    }
    window.open(meetData.meetingUri, '_blank', 'noopener,noreferrer');
  };

  const handleEndMeet = async () => {
    const targetConsultId = consultation?.id || consultation?.consultation_id || appointment?.consultation_id;
    if (!targetConsultId) return;
    try {
      setLoading(true);
      await endGoogleMeet(targetConsultId);
      setMeetData((prev) => ({ ...prev, meetingStatus: 'completed', transcriptStatus: 'processing' }));
      if (onStatusChange) onStatusChange('completed');
      info('Consultation concluded. Synchronizing conversation transcript...', 'Meeting Ended');
      setTimeout(async () => {
        try {
          const res = await syncGoogleMeetTranscript(targetConsultId);
          if (res?.transcriptStatus === 'ready' && res.entries?.length > 0) {
            setMeetData((prev) => ({ ...prev, meetingStatus: 'completed', transcriptStatus: 'ready' }));
            success('Transcript retrieved from Google Meet and ready for clinical review.', 'Transcript Ready');
            if (onTranscriptReady) onTranscriptReady(res);
            if (onViewTranscript) onViewTranscript();
            if (onConsultationUpdated) onConsultationUpdated();
          } else {
            handleSyncTranscript();
          }
        } catch {
          handleSyncTranscript();
        }
      }, 1500);
    } catch {
      toastError('Failed to complete meeting.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    const targetConsultId = consultation?.id || consultation?.consultation_id || appointment?.consultation_id;
    const targetApptId = appointment?.id || consultation?.appointment_id;
    setRefreshing(true);
    try {
      let foundUri = null;
      let foundCode = null;
      let foundSpace = null;
      let foundStatus = null;

      // 1. Backend consultation meeting endpoint
      if (targetConsultId) {
        const res = await getConsultationMeeting(targetConsultId).catch(() => null);
        if (res?.meeting?.meetingUrl || res?.meetingUri) {
          foundUri = res.meeting?.meetingUrl || res.meetingUri;
          foundCode = res.meeting?.meetingCode || res.meetingCode;
          foundSpace = res.meeting?.spaceName || res.spaceName;
          foundStatus = res.meeting?.status || 'meet_ready';
        }
      }

      // 2. Meet status endpoint
      if (!foundUri && targetConsultId) {
        const res = await getGoogleMeetStatus(targetConsultId).catch(() => null);
        if (res?.meetingUri) {
          foundUri = res.meetingUri;
          foundCode = res.meetingCode;
          foundSpace = res.spaceName;
          foundStatus = res.meetingStatus || 'meet_ready';
        }
      }

      // 3. Firestore consultation & appointment
      if (!foundUri && targetConsultId) {
        const cFs = await getConsultationFirestore(targetConsultId).catch(() => null);
        if (cFs?.meeting?.meetingUrl || cFs?.googleMeetingUri) {
          foundUri = cFs.meeting?.meetingUrl || cFs.googleMeetingUri;
          foundCode = cFs.meeting?.meetingCode || cFs.googleMeetingCode;
          foundSpace = cFs.meeting?.spaceName || cFs.googleSpaceName;
          foundStatus = 'meet_ready';
        }
      }

      if (!foundUri && targetApptId) {
        const aFs = await getAppointmentFirestore(targetApptId).catch(() => null);
        if (aFs?.googleMeetingUri || aFs?.googleMeet?.meetingUri) {
          foundUri = aFs.googleMeetingUri || aFs.googleMeet?.meetingUri;
          foundCode = aFs.googleMeetingCode || aFs.googleMeet?.meetingCode;
          foundSpace = aFs.googleSpaceName || aFs.googleMeet?.spaceName;
          foundStatus = 'meet_ready';
        }
      }

      if (foundUri) {
        setMeetData((prev) => ({
          ...prev,
          meetingUri: foundUri,
          meetingCode: foundCode || foundUri.split('/').pop(),
          spaceName: foundSpace || prev.spaceName,
          meetingStatus: foundStatus || 'meet_ready',
        }));
        if (onStatusChange) onStatusChange(foundStatus || 'meet_ready');
        if (onConsultationUpdated) onConsultationUpdated();
        info('Google Meet is ready.', 'Status Updated');
      } else {
        info('Checked meeting status â€” no active space found yet.', 'Refreshed');
      }
    } catch {
      toastError('Could not refresh meeting status.', 'Refresh Failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncTranscript = async () => {
    if (!consultation?.id) return;
    try {
      setSyncing(true);
      const res = await syncGoogleMeetTranscript(consultation.id);
      if (res?.transcriptStatus === 'ready' && res.entries?.length > 0) {
        setMeetData((prev) => ({ ...prev, meetingStatus: 'completed', transcriptStatus: 'ready' }));
        success('Transcript ready for review.', 'Transcript Ready');
        if (onTranscriptReady) onTranscriptReady(res);
        if (onConsultationUpdated) onConsultationUpdated();
      } else {
        info('Transcript is being processed. It will be available shortly.', 'Processing');
      }
    } catch {
      info('Transcript not yet available. Please check again after the call ends.', 'Pending');
    } finally {
      setSyncing(false);
    }
  };

  const copyMeetLink = () => {
    if (meetData.meetingUri) {
      navigator.clipboard.writeText(meetData.meetingUri);
      setCopiedLink(true);
      success('Meeting link copied.', 'Copied');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // State calculations
  const rawStatus = (meetData.meetingStatus || '').toLowerCase();
  const hasRealUri = Boolean(meetData.meetingUri);
  const isCreating = loading && !hasRealUri;
  const isFailed = rawStatus.includes('failed');
  const isCompleted = ['completed', 'meeting_ended', 'transcript_ready', 'doctor_reviewed', 'finalized'].includes(rawStatus);
  const isInProgress = ['in_progress'].includes(rawStatus);
  const isReady = hasRealUri && !isCompleted && !isInProgress;
  const isNotCreated = !hasRealUri && !isCreating && !isFailed && !isCompleted;

  const doctorName = consultation?.doctor_name || appointment?.doctor_name || null;
  const patientName = consultation?.patient_name || appointment?.patient_name || null;

  return (
    <div className="flex flex-col gap-4">
      {/* Main Google Meet Card */}
      <div
        className="glass-card animate-fade-in"
        style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 mb-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <IconGoogleMeet size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary" style={{ margin: 0 }}>
                  Google Meet
                </h2>
                <span className="text-xs text-muted">Â· Video consultation</span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Secure clinical video consultation
              </p>
            </div>
          </div>

          {/* Google Connection Status Indicator for Doctor */}
          {isDoctor && (
            <div className="flex items-center gap-2">
              {authStatus.is_connected ? (
                <div className="flex items-center gap-1.5">
                  <span className="badge badge-success text-xs flex items-center gap-1 py-1 px-2.5">
                    <IconCheck size={12} />
                    <span>{authStatus.email || 'Google Connected'}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-muted hover:text-danger flex items-center gap-1"
                    onClick={handleDisconnect}
                    disabled={loading}
                    title="Disconnect Google Account"
                  >
                    <span style={{ fontSize: '0.75rem' }}>âœ•</span>
                    <span>Disconnect</span>
                  </button>
                </div>
              ) : authStatus.checked ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-secondary flex items-center gap-1 border border-subtle"
                  onClick={handleConnectGoogle}
                  disabled={loading}
                >
                  <IconGoogle size={13} />
                  <span>Connect Google</span>
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* Dynamic State Area */}
        <div className="flex flex-col items-center text-center py-4">
          {/* STATE 2: CREATING */}
          {isCreating && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="spinner" style={{ width: 36, height: 36 }} />
              <div className="font-semibold text-base text-primary">
                Preparing your secure consultation...
              </div>
              <p className="text-xs text-muted max-w-sm">
                Setting up the Google Meet consultation space.
              </p>
            </div>
          )}

          {/* STATE 1: NOT CREATED */}
          {isNotCreated && (
            <div className="flex flex-col items-center gap-4 py-4 w-full max-w-md">
              {isDoctor ? (
                !authStatus.is_connected ? (
                  /* CASE 1: Google not connected */
                  <div className="flex flex-col items-center gap-3 w-full animate-fade-in">
                    <div className="flex items-center gap-2 text-sm text-amber-500 font-semibold">
                      <span className="status-dot" style={{ background: '#f59e0b' }} />
                      <span>Google account required</span>
                    </div>
                    <p className="text-xs text-muted max-w-xs">
                      Connect your Google account to create and manage official Google Meet telehealth spaces.
                    </p>
                    <button
                      id="connect-google-meet-btn"
                      type="button"
                      className="btn btn-primary w-full flex items-center justify-center gap-2 mt-1"
                      style={{ minHeight: '48px', fontSize: '0.95rem', fontWeight: 600 }}
                      onClick={handleConnectGoogle}
                      disabled={loading}
                    >
                      <IconGoogle size={18} />
                      <span>Connect Google</span>
                    </button>
                  </div>
                ) : (
                  /* CASE 2: Google connected */
                  <div className="flex flex-col items-center gap-3 w-full animate-fade-in">
                    <div className="flex items-center gap-2 text-sm text-emerald-500 font-semibold">
                      <span className="status-dot" style={{ background: '#10b981' }} />
                      <span>Google connected ({authStatus.email || 'Ready'})</span>
                    </div>
                    <p className="text-xs text-muted max-w-xs">
                      Ready to launch a secure Google Meet video room for this consultation.
                    </p>
                    <button
                      id="start-telehealth-btn"
                      type="button"
                      className="btn btn-primary w-full flex items-center justify-center gap-2 mt-1 shadow-md"
                      style={{ minHeight: '48px', fontSize: '0.95rem', fontWeight: 600 }}
                      onClick={handleCreateMeet}
                      disabled={loading}
                    >
                      <IconVideo size={18} />
                      <span>Start Telehealth Session</span>
                    </button>
                  </div>
                )
              ) : (
                /* Patient view */
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="flex items-center gap-2 text-sm text-secondary font-medium">
                    <span className="status-dot" style={{ background: '#94a3b8' }} />
                    <span>Waiting for doctor to initialize meeting...</span>
                  </div>
                  <div
                    className="w-full p-3 rounded-lg text-xs text-muted border border-subtle mt-1"
                    style={{ background: 'var(--color-bg-base)' }}
                  >
                    Your doctor will initialize the consultation room shortly before the scheduled time. This page will update automatically.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE 6: FAILED */}
          {isFailed && (
            <div className="flex flex-col items-center gap-3 py-4 w-full max-w-md">
              <div className="flex items-center gap-2 text-danger font-semibold text-sm">
                <IconAlert size={18} />
                <span>Unable to create Google Meet</span>
              </div>
              <p className="text-xs text-muted">
                {meetCreationError || 'We could not connect to Google Meet. Please reconnect your Google account or try again.'}
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center mt-2">
                <button
                  type="button"
                  className="btn btn-primary flex items-center justify-center gap-2 px-4"
                  style={{ minHeight: '40px', fontWeight: 600 }}
                  onClick={handleConnectGoogle}
                  disabled={loading}
                >
                  <IconGoogle size={16} />
                  <span>Reconnect Google</span>
                </button>
                <button
                  id="retry-google-meet-btn"
                  type="button"
                  className="btn btn-secondary flex items-center justify-center gap-1.5 px-3"
                  style={{ minHeight: '40px' }}
                  onClick={handleCreateMeet}
                  disabled={loading}
                >
                  <IconRefresh size={14} />
                  <span>Try Again</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: READY */}
          {isReady && (
            <div className="flex flex-col items-center gap-4 w-full max-w-lg">
              {/* Pre-join card */}
              <div
                className="w-full text-left p-4 rounded-xl border border-subtle"
                style={{ background: 'var(--color-bg-base)' }}
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-success mb-2">
                  <span className="status-dot" style={{ background: 'var(--color-success)' }} />
                  <span>Consultation ready</span>
                </div>
                <p className="text-xs text-secondary mb-3">
                  You're about to join your secure video consultation.
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {doctorName && (
                    <div>
                      <span className="text-muted block">Doctor</span>
                      <span className="font-semibold text-primary">{doctorName}</span>
                    </div>
                  )}
                  {patientName && (
                    <div>
                      <span className="text-muted block">Patient</span>
                      <span className="font-semibold text-primary">{patientName}</span>
                    </div>
                  )}
                  {appointment?.appointment_date && (
                    <div>
                      <span className="text-muted block">Date</span>
                      <span className="font-semibold text-primary">{appointment.appointment_date}</span>
                    </div>
                  )}
                  {appointment?.appointment_time && (
                    <div>
                      <span className="text-muted block">Time</span>
                      <span className="font-semibold text-primary">{appointment.appointment_time}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary CTA: Join Google Meet */}
              <button
                id="join-google-meet-btn"
                type="button"
                className="btn btn-primary w-full flex items-center justify-center gap-2 shadow-md"
                style={{
                  minHeight: '48px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                }}
                onClick={handleJoinMeet}
              >
                <IconVideo size={20} />
                <span>Join Google Meet</span>
                <IconExternalLink size={15} style={{ opacity: 0.8 }} />
              </button>

              <div className="flex items-center justify-between w-full flex-wrap gap-2 text-xs text-muted pt-1">
                {meetData.meetingCode && (
                  <span className="font-mono">
                    Meeting code: <strong className="text-secondary">{meetData.meetingCode}</strong>
                  </span>
                )}
                {meetData.createdAt && (
                  <span>
                    Created: <strong className="text-secondary">{typeof meetData.createdAt === 'string' ? meetData.createdAt.split('T')[0] : (meetData.createdAt.toDate ? meetData.createdAt.toDate().toLocaleDateString() : 'Active')}</strong>
                  </span>
                )}
                <span className="flex items-center gap-1 text-muted">
                  Provider: <strong className="text-secondary">Google Meet</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-secondary ml-auto"
                  onClick={copyMeetLink}
                >
                  {copiedLink ? 'Copied Link!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: IN PROGRESS */}
          {isInProgress && (
            <div className="flex flex-col items-center gap-4 w-full max-w-lg">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <span className="status-dot animate-pulse" style={{ background: '#38bdf8' }} />
                <span>Consultation in progress</span>
              </div>

              <button
                id="join-google-meet-btn"
                type="button"
                className="btn btn-primary w-full flex items-center justify-center gap-2 shadow-md"
                style={{
                  minHeight: '48px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                }}
                onClick={handleJoinMeet}
              >
                <IconVideo size={20} />
                <span>Continue Google Meet</span>
                <IconExternalLink size={15} style={{ opacity: 0.8 }} />
              </button>

              <div className="flex items-center justify-between w-full flex-wrap gap-2 pt-1">
                {meetData.meetingCode && (
                  <span className="text-xs text-muted font-mono">
                    Code: <strong className="text-secondary">{meetData.meetingCode}</strong>
                  </span>
                )}
                {isDoctor && (
                  <button
                    id="end-google-meet-btn"
                    type="button"
                    className="btn btn-danger btn-sm ml-auto"
                    onClick={handleEndMeet}
                    disabled={loading}
                  >
                    End Consultation
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STATE 5: COMPLETED */}
          {isCompleted && (
            <div className="flex flex-col items-center gap-3 w-full max-w-md">
              <div className="flex items-center gap-2 text-success font-semibold text-sm">
                <IconCheck size={18} />
                <span>Consultation completed</span>
              </div>
              <p className="text-xs text-muted">
                The video session has concluded. The consultation record and transcript are available below.
              </p>

              <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
                {onViewTranscript && (
                  <button
                    type="button"
                    className="btn btn-primary flex items-center gap-1.5 px-5"
                    style={{ minHeight: '44px' }}
                    onClick={onViewTranscript}
                  >
                    <IconClock size={16} />
                    <span>View Transcript</span>
                  </button>
                )}
                {hasRealUri && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm flex items-center gap-1.5"
                    onClick={handleSyncTranscript}
                    disabled={syncing}
                  >
                    <IconRefresh size={14} className={syncing ? 'animate-spin' : ''} />
                    <span>{syncing ? 'Checking...' : 'Check Transcript'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer controls: Refresh status */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-3 mt-3 border-t border-subtle text-xs">
          <button
            type="button"
            className="btn btn-ghost btn-xs text-muted hover:text-primary flex items-center gap-1"
            onClick={handleRefreshStatus}
            disabled={refreshing}
          >
            <IconRefresh size={12} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh status'}</span>
          </button>
        </div>
      </div>

      {/* Clinical Consent Modal */}
      {consentModalOpen && (
        <div className="modal-backdrop" onClick={() => setConsentModalOpen(false)}>
          <div
            className="modal-content animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, borderRadius: '16px' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}
              >
                <IconShield size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-primary" style={{ margin: 0 }}>
                  Telehealth Consent
                </h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>
                  Informed consultation verification
                </p>
              </div>
            </div>

            <p className="text-xs text-secondary mb-4" style={{ lineHeight: 1.6 }}>
              This telehealth consultation will be conducted via Google Meet. A dialogue transcript may be generated for clinical record-keeping. Confirm that participant consent has been obtained.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConsentModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setConsentConfirmed(true);
                  setConsentModalOpen(false);
                  handleCreateMeet();
                }}
              >
                Confirm &amp; Create Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
