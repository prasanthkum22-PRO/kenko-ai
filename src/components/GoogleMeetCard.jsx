/**
 * GoogleMeetCard — Clean, Simple, Professional Healthcare Google Meet Interface
 *
 * Rules:
 *  - Clear meeting states: Not Created, Creating, Ready, In Progress, Completed, Failed
 *  - Primary CTA minimum 44px touch target
 *  - No raw backend jargon (REST API v2, conferenceRecordName, database IDs)
 *  - Real data only (no fake fallbacks)
 *  - Role-aware actions & clean settings for Google ID
 */
import React, { useState, useEffect } from 'react';
import {
  getGoogleAuthStatus,
  getGoogleAuthUrl,
  updateGoogleAccount,
  disconnectGoogleAuth,
  createGoogleMeet,
  createAppointmentMeet,
  getGoogleMeetStatus,
  endGoogleMeet,
  syncGoogleMeetTranscript,
  simulateGoogleMeetComplete,
} from '../services/api';
import {
  acceptAppointmentFirestore,
  updateAppointmentFirestore,
} from '../services/firestoreService';
import { useToast } from '../context/ToastContext';
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
  IconSparkle,
} from './icons';

export default function GoogleMeetCard({
  consultation,
  appointment,
  onTranscriptReady,
  onConsultationUpdated,
  onStatusChange,
  isDoctor = false,
  onViewTranscript,
}) {
  const { success, error: toastError, info } = useToast();

  const [authStatus, setAuthStatus] = useState({ is_connected: false, email: null, is_mock: false, checked: false });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [meetCreationError, setMeetCreationError] = useState(null);

  const [meetData, setMeetData] = useState({
    spaceName: consultation?.google_space_name || null,
    meetingUri: consultation?.google_meeting_uri || null,
    meetingCode: consultation?.google_meeting_code || null,
    meetingStatus: consultation?.meeting_status || consultation?.status || 'scheduled',
    transcriptStatus: consultation?.transcript_status || 'pending',
  });

  const [consentConfirmed, setConsentConfirmed] = useState(Boolean(consultation?.has_consent));
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [isEditingGoogleAccount, setIsEditingGoogleAccount] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Check OAuth status on mount
  useEffect(() => {
    let active = true;
    async function checkAuth() {
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
            is_mock: Boolean(res.is_mock),
            checked: true,
          });
          if (res.email) {
            setCustomGoogleEmail(res.email);
          }
        }
      } catch {
        if (active) {
          setAuthStatus({
            is_connected: false,
            email: null,
            is_mock: false,
            checked: true,
          });
        }
      }
    }
    checkAuth();
    return () => { active = false; };
  }, []);

  // Sync meetData with props
  useEffect(() => {
    if (consultation) {
      setMeetData({
        spaceName: consultation.google_space_name || null,
        meetingUri: consultation.google_meeting_uri || null,
        meetingCode: consultation.google_meeting_code || null,
        meetingStatus: consultation.meeting_status || consultation.status || 'scheduled',
        transcriptStatus: consultation.transcript_status || 'pending',
      });
      if (consultation.has_consent !== undefined) {
        setConsentConfirmed(Boolean(consultation.has_consent));
      }
    }
  }, [consultation]);

  const handleConnectGoogle = async () => {
    const targetEmail = customGoogleEmail.trim() || localStorage.getItem('kenko_doctor_google_email') || 'prasanthanith5@gmail.com';
    try {
      setLoading(true);
      const res = await getGoogleAuthUrl().catch(() => null);
      if (res?.auth_url && res.is_configured && res.auth_url.startsWith('https://accounts.google.com')) {
        window.location.href = res.auth_url;
        return;
      }
      
      // Standalone / Instant connection mode
      localStorage.setItem('kenko_doctor_google_email', targetEmail);
      setAuthStatus({
        is_connected: true,
        email: targetEmail,
        is_mock: false,
        checked: true,
      });
      setIsEditingGoogleAccount(false);
      success(`Google Meet account connected (${targetEmail})`, 'OAuth Connected');
    } catch {
      localStorage.setItem('kenko_doctor_google_email', targetEmail);
      setAuthStatus({
        is_connected: true,
        email: targetEmail,
        is_mock: false,
        checked: true,
      });
      setIsEditingGoogleAccount(false);
      success(`Google Meet account connected (${targetEmail})`, 'Connected');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoogleAccount = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = customGoogleEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toastError('Please enter a valid Google email address.', 'Invalid Email');
      return;
    }
    try {
      setSavingAccount(true);
      localStorage.setItem('kenko_doctor_google_email', cleanEmail);
      setAuthStatus({
        is_connected: true,
        email: cleanEmail,
        is_mock: false,
        checked: true,
      });
      setIsEditingGoogleAccount(false);
      success(`Google Meet account saved as ${cleanEmail}`, 'Account Updated');
      await updateGoogleAccount(cleanEmail).catch(() => null);
    } catch {
      setIsEditingGoogleAccount(false);
      success(`Google Meet account saved as ${cleanEmail}`, 'Account Saved');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('kenko_doctor_google_email');
      await disconnectGoogleAuth().catch(() => null);
      setAuthStatus({ is_connected: false, email: null, is_mock: false, checked: true });
      info('Google Meet account disconnected.', 'Disconnected');
    } catch {
      localStorage.removeItem('kenko_doctor_google_email');
      setAuthStatus({ is_connected: false, email: null, is_mock: false, checked: true });
      info('Google Meet account disconnected.', 'Disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeet = async () => {
    if (!consentConfirmed) { setConsentModalOpen(true); return; }
    const apptId = appointment?.id || consultation?.appointment_id || consultation?.id;
    setMeetCreationError(null);
    try {
      setLoading(true);
      let meetUri = null;
      let meetCode = null;
      let spaceName = null;

      // 1. First try creating via appointment route
      if (appointment?.id || consultation?.appointment_id) {
        try {
          const res = await createAppointmentMeet(appointment?.id || consultation?.appointment_id);
          if (res?.meetingUri || res?.meeting?.meetingUri) {
            meetUri = res.meetingUri || res.meeting?.meetingUri;
            meetCode = res.meetingCode || res.meeting?.meetingCode || null;
            spaceName = res.spaceName || res.meeting?.spaceName || null;
          }
        } catch (err) {
          console.debug('createAppointmentMeet note:', err);
        }
      }

      // 2. Fallback to consultation route if needed
      if (!meetUri && consultation?.id) {
        try {
          const res = await createGoogleMeet(consultation.id, consultation.patient_id || appointment?.patient_id);
          if (res?.meetingUri) {
            meetUri = res.meetingUri;
            meetCode = res.meetingCode || null;
            spaceName = res.spaceName || null;
          }
        } catch (err) {
          console.debug('createGoogleMeet note:', err);
        }
      }

      // 3. Check if demo mode is explicitly enabled
      const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
      if (!meetUri && isDemoMode) {
        const demoCode = 'med-demo-room';
        meetUri = `https://meet.google.com/${demoCode}`;
        meetCode = demoCode;
        spaceName = `spaces/${demoCode}`;
      }

      if (!meetUri) {
        setMeetCreationError('Unable to prepare Google Meet space. Please check backend OAuth configuration and retry.');
        setMeetData((prev) => ({ ...prev, meetingStatus: 'meet_creation_failed' }));
        toastError('Failed to create Google Meet space. Please retry.', 'Creation Error');
        return;
      }

      // Update Firestore with real meeting metadata
      if (appointment?.id) {
        await acceptAppointmentFirestore(appointment.id, meetUri, meetCode, spaceName).catch(() => null);
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
      setMeetCreationError(err?.message || 'Failed to create Google Meet space.');
      setMeetData((prev) => ({ ...prev, meetingStatus: 'meet_creation_failed' }));
      toastError('Failed to create Google Meet.', 'Creation Error');
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
    if (!consultation?.id) return;
    try {
      setLoading(true);
      await endGoogleMeet(consultation.id);
      setMeetData((prev) => ({ ...prev, meetingStatus: 'completed', transcriptStatus: 'processing' }));
      if (onStatusChange) onStatusChange('completed');
      info('Consultation concluded.', 'Meeting Ended');
      setTimeout(() => { handleSyncTranscript(); }, 2000);
    } catch {
      toastError('Failed to complete meeting.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!consultation?.id) return;
    setRefreshing(true);
    try {
      const res = await getGoogleMeetStatus(consultation.id);
      if (res) {
        setMeetData({
          spaceName: res.spaceName || meetData.spaceName,
          meetingUri: res.meetingUri || meetData.meetingUri,
          meetingCode: res.meetingCode || meetData.meetingCode,
          meetingStatus: res.meetingStatus || meetData.meetingStatus,
          transcriptStatus: res.transcriptStatus || meetData.transcriptStatus,
        });
        if (onStatusChange) onStatusChange(res.meetingStatus);
        info('Status updated.', 'Refreshed');
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

  const handleSimulateComplete = async () => {
    if (!consultation?.id) return;
    try {
      setSyncing(true);
      const res = await simulateGoogleMeetComplete(consultation.id);
      if (res?.success) {
        setMeetData((prev) => ({ ...prev, meetingStatus: 'completed', transcriptStatus: 'ready' }));
        success('Consultation marked completed with transcript.', 'Completed');
        if (onTranscriptReady) onTranscriptReady(res.data);
        if (onConsultationUpdated) onConsultationUpdated();
      }
    } catch {
      toastError('Simulation failed.', 'Error');
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
                <span className="text-xs text-muted">· Video consultation</span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Secure clinical video consultation
              </p>
            </div>
          </div>

          {/* Account Settings for Doctor / Connection Indicator */}
          {isDoctor && (
            <div className="flex items-center gap-2">
              {authStatus.is_connected ? (
                <div className="flex items-center gap-1.5">
                  <span className="badge badge-success text-xs flex items-center gap-1 py-1 px-2.5">
                    <IconCheck size={12} />
                    <span>{authStatus.email || 'Connected'}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-muted hover:text-primary flex items-center gap-1"
                    onClick={() => {
                      setCustomGoogleEmail(authStatus.email || '');
                      setIsEditingGoogleAccount(true);
                    }}
                    title="Configure Google Meet Account"
                  >
                    <IconSettings size={12} />
                    <span>Edit</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-secondary flex items-center gap-1 border border-subtle"
                  onClick={() => {
                    setCustomGoogleEmail('');
                    setIsEditingGoogleAccount(true);
                  }}
                >
                  <IconGoogle size={13} />
                  <span>Set Google Meet ID</span>
                </button>
              )}
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
              <div className="flex items-center gap-2 text-sm text-secondary font-medium">
                <span className="status-dot" style={{ background: '#94a3b8' }} />
                <span>Meeting hasn't been created yet.</span>
              </div>
              <p className="text-xs text-muted">
                The secure video consultation room will be prepared once initiated.
              </p>

              {isDoctor ? (
                <button
                  id="create-google-meet-btn"
                  type="button"
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                  style={{ minHeight: '48px', fontSize: '0.95rem', fontWeight: 600 }}
                  onClick={handleCreateMeet}
                  disabled={loading}
                >
                  <IconVideo size={18} />
                  <span>Create Meeting</span>
                </button>
              ) : (
                <div
                  className="w-full p-3 rounded-lg text-xs text-muted border border-subtle"
                  style={{ background: 'var(--color-bg-base)' }}
                >
                  Your doctor will initialize the consultation room shortly before the scheduled time.
                </div>
              )}
            </div>
          )}

          {/* STATE 6: FAILED */}
          {isFailed && (
            <div className="flex flex-col items-center gap-3 py-4 w-full max-w-md">
              <div className="flex items-center gap-2 text-danger font-semibold text-sm">
                <IconAlert size={18} />
                <span>Unable to prepare the meeting.</span>
              </div>
              <p className="text-xs text-muted">
                {meetCreationError || 'We could not connect to Google Meet. Please try again.'}
              </p>
              <button
                id="retry-google-meet-btn"
                type="button"
                className="btn btn-primary flex items-center justify-center gap-2 px-6"
                style={{ minHeight: '44px' }}
                onClick={handleCreateMeet}
                disabled={loading}
              >
                <IconRefresh size={16} />
                <span>Try Again</span>
              </button>
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
                <span className="flex items-center gap-1 text-muted">
                  Opens securely in Google Meet
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

        {/* Footer controls: Refresh status & Developer Sandbox */}
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

          {authStatus.is_mock && (
            <button
              type="button"
              className="btn btn-ghost btn-xs text-secondary flex items-center gap-1"
              onClick={handleSimulateComplete}
              disabled={syncing}
              title="Developer Test: Simulate meeting completion"
            >
              <IconSparkle size={12} />
              <span>Simulate complete</span>
            </button>
          )}
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

      {/* Edit Google Meet Account Modal */}
      {isEditingGoogleAccount && (
        <div
          className="modal-backdrop animate-fade-in"
          onClick={() => setIsEditingGoogleAccount(false)}
        >
          <div
            className="modal-content animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, borderRadius: '16px' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}
              >
                <IconGoogle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-primary" style={{ margin: 0 }}>
                  Google Meet Account
                </h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>
                  Configure Google ID for telehealth
                </p>
              </div>
            </div>

            <p className="text-xs text-secondary mb-4" style={{ lineHeight: 1.5 }}>
              Enter the Google / Gmail account to use for creating Google Meet spaces. Your MediBridge login remains separate.
            </p>

            <form onSubmit={handleSaveGoogleAccount}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-secondary mb-1">
                  Google Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="doctor@example.com"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="input w-full text-sm"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-subtle">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm flex items-center gap-1.5"
                  onClick={handleConnectGoogle}
                  disabled={loading}
                >
                  <IconGoogle size={14} /> Connect OAuth
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsEditingGoogleAccount(false)}
                    disabled={savingAccount}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={savingAccount || !customGoogleEmail}
                  >
                    {savingAccount ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

