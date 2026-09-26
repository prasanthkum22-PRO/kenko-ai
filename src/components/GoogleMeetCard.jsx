/**
 * GoogleMeetCard — Google Meet Telehealth Integration
 *
 * Rules:
 *  - NO fake authStatus defaults (doctor@medibridge.ai)
 *  - Join button ONLY shown when a real googleMeetingUri exists
 *  - Uses window.open with noopener,noreferrer for join
 *  - Displays real meeting status from backend
 *  - Refresh button queries backend for current state
 *  - Error states shown clearly with Retry option
 *  - Stepper reflects REAL state only
 */
import React, { useState, useEffect } from 'react';
import {
  getGoogleAuthStatus,
  getGoogleAuthUrl,
  updateGoogleAccount,
  disconnectGoogleAuth,
  createGoogleMeet,
  getGoogleMeetStatus,
  endGoogleMeet,
  syncGoogleMeetTranscript,
  simulateGoogleMeetComplete,
} from '../services/api';
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
  IconSparkle,
  IconUsers,
  IconDoc,
} from './icons';

// Meet status → display label
const STATUS_DISPLAY = {
  scheduled: 'Scheduled',
  SCHEDULED: 'Scheduled',
  meet_creating: 'Creating Meet...',
  MEET_CREATING: 'Creating Meet...',
  waiting_for_participants: 'Meet Ready — Waiting for Participants',
  meet_ready: 'Meet Ready',
  MEET_READY: 'Meet Ready',
  meet_creation_failed: 'Meet Creation Failed',
  MEET_CREATION_FAILED: 'Meet Creation Failed',
  in_progress: 'In Progress',
  IN_PROGRESS: 'In Progress',
  meeting_ended: 'Meeting Ended',
  transcript_ready: 'Transcript Ready',
  completed: 'Completed',
  COMPLETED: 'Completed',
  doctor_reviewed: 'Doctor Reviewed',
  finalized: 'Finalized',
};

function getMeetStatusBadge(status) {
  if (['transcript_ready', 'completed', 'COMPLETED', 'doctor_reviewed', 'finalized'].includes(status)) return 'badge-success';
  if (['waiting_for_participants', 'meet_ready', 'MEET_READY', 'in_progress', 'IN_PROGRESS'].includes(status)) return 'badge-primary';
  if (['meeting_ended'].includes(status)) return 'badge-warning';
  if (['meet_creation_failed', 'MEET_CREATION_FAILED'].includes(status)) return 'badge-danger';
  return 'badge-secondary';
}

export default function GoogleMeetCard({
  consultation,
  appointment,
  onTranscriptReady,
  onConsultationUpdated,
  onStatusChange,
}) {
  const { success, error: toastError, info } = useToast();

  // Auth status — start as unknown, do NOT pre-fill fake email
  const [authStatus, setAuthStatus] = useState({ is_connected: false, email: null, is_mock: false, checked: false });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [meetCreationError, setMeetCreationError] = useState(null);

  // Meet metadata — ONLY from real backend data
  const [meetData, setMeetData] = useState({
    spaceName: consultation?.google_space_name || null,
    meetingUri: consultation?.google_meeting_uri || null,
    meetingCode: consultation?.google_meeting_code || null,
    meetingStatus: consultation?.meeting_status || 'scheduled',
    transcriptStatus: consultation?.transcript_status || 'pending',
  });

  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(Boolean(consultation?.has_consent));
  const [isEditingGoogleAccount, setIsEditingGoogleAccount] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Check OAuth status on mount — do NOT fake success on failure
  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await getGoogleAuthStatus();
        if (active && res) {
          setAuthStatus({
            is_connected: Boolean(res.is_connected),
            email: res.email || null,
            is_mock: Boolean(res.is_mock),
            checked: true,
          });
        }
      } catch {
        if (active) {
          setAuthStatus({ is_connected: false, email: null, is_mock: false, checked: true });
        }
      }
    }
    checkAuth();
    return () => { active = false; };
  }, []);

  // Sync meetData when consultation prop changes
  useEffect(() => {
    if (consultation) {
      setMeetData({
        spaceName: consultation.google_space_name || null,
        meetingUri: consultation.google_meeting_uri || null,
        meetingCode: consultation.google_meeting_code || null,
        meetingStatus: consultation.meeting_status || 'scheduled',
        transcriptStatus: consultation.transcript_status || 'pending',
      });
      if (consultation.has_consent !== undefined) {
        setConsentConfirmed(Boolean(consultation.has_consent));
      }
    }
  }, [consultation]);

  const handleConnectGoogle = async () => {
    try {
      setLoading(true);
      const res = await getGoogleAuthUrl();
      if (res?.auth_url && res.is_configured && res.auth_url.startsWith('https://accounts.google.com')) {
        window.location.href = res.auth_url;
      } else if (res?.is_mock) {
        setAuthStatus({ is_connected: true, email: res.email || 'sandbox@kenko.ai', is_mock: true, checked: true });
        info('Connected in sandbox/test mode. Real Google OAuth not configured.', 'Sandbox Mode');
      } else {
        toastError('Google OAuth is not configured. Please contact your administrator.', 'Not Configured');
      }
    } catch (err) {
      toastError('Could not initiate Google authentication.', 'Auth Error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoogleAccount = async (e) => {
    if (e) e.preventDefault();
    if (!customGoogleEmail || !customGoogleEmail.includes('@')) {
      toastError('Please enter a valid Google email address.', 'Invalid Email');
      return;
    }
    try {
      setSavingAccount(true);
      const res = await updateGoogleAccount(customGoogleEmail);
      if (res?.success) {
        setAuthStatus({
          is_connected: true,
          email: res.email,
          is_mock: false,
          checked: true,
        });
        setIsEditingGoogleAccount(false);
        success(`Google Meet account updated to ${res.email}`, 'Account Updated');
      }
    } catch (err) {
      toastError('Failed to update Google Meet account email.', 'Update Error');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await disconnectGoogleAuth();
      setAuthStatus({ is_connected: false, email: null, is_mock: false, checked: true });
      info('Google Meet account disconnected.', 'Disconnected');
    } catch {
      toastError('Failed to disconnect Google account.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeet = async () => {
    if (!consentConfirmed) { setConsentModalOpen(true); return; }
    if (!consultation?.id) { toastError('No consultation ID. Cannot create meeting.', 'Error'); return; }
    setMeetCreationError(null);
    try {
      setLoading(true);
      info('Creating secure Google Meet Space via official Google REST API v2...', 'Connecting');
      const res = await createGoogleMeet(consultation.id, consultation.patient_id);
      if (res?.success && res.meetingUri) {
        setMeetData((prev) => ({
          ...prev,
          spaceName: res.spaceName || prev.spaceName,
          meetingUri: res.meetingUri,
          meetingCode: res.meetingCode || null,
          meetingStatus: 'waiting_for_participants',
        }));
        success('Google Meet Space created successfully! Ready for Doctor & Patient to join.', 'Google Meet Active');
        if (onStatusChange) onStatusChange('waiting_for_participants');
        if (onConsultationUpdated) onConsultationUpdated();
      } else if (res?.meetingUri) {
        // Success without explicit success flag
        setMeetData((prev) => ({
          ...prev,
          spaceName: res.spaceName || prev.spaceName,
          meetingUri: res.meetingUri,
          meetingCode: res.meetingCode || null,
          meetingStatus: 'waiting_for_participants',
        }));
        success('Google Meet Space ready.', 'Meet Created');
        if (onConsultationUpdated) onConsultationUpdated();
      } else {
        setMeetCreationError('Google Meet space could not be created. Please retry.');
        setMeetData((prev) => ({ ...prev, meetingStatus: 'meet_creation_failed' }));
        toastError('Meet creation returned no meeting URI.', 'Creation Failed');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to initialize Google Meet Space.';
      setMeetCreationError(detail);
      setMeetData((prev) => ({ ...prev, meetingStatus: 'meet_creation_failed' }));
      toastError(detail, 'Creation Error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeet = () => {
    if (!meetData.meetingUri) return;
    window.open(meetData.meetingUri, '_blank', 'noopener,noreferrer');
  };

  const handleEndMeet = async () => {
    if (!consultation?.id) return;
    try {
      setLoading(true);
      await endGoogleMeet(consultation.id);
      setMeetData((prev) => ({ ...prev, meetingStatus: 'meeting_ended', transcriptStatus: 'processing' }));
      if (onStatusChange) onStatusChange('meeting_ended');
      info('Consultation concluded. Waiting for Google Meet transcript artifacts...', 'Meeting Ended');
      setTimeout(() => { handleSyncTranscript(); }, 2000);
    } catch (err) {
      toastError('Failed to mark meeting as ended.', 'Error');
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
        info('Status refreshed from backend.', 'Refreshed');
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
      info('Retrieving Google Meet transcript entries...', 'Syncing');
      const res = await syncGoogleMeetTranscript(consultation.id);
      if (res?.transcriptStatus === 'ready' && res.entries?.length > 0) {
        setMeetData((prev) => ({ ...prev, meetingStatus: 'transcript_ready', transcriptStatus: 'ready' }));
        success(`Retrieved ${res.entries.length} dialogue turns from Google Meet.`, 'Transcript Ready');
        if (onTranscriptReady) onTranscriptReady(res);
        if (onConsultationUpdated) onConsultationUpdated();
      } else {
        info(res?.message || 'Transcript is still being processed by Google Meet. Check again in a moment.', 'Processing');
      }
    } catch (err) {
      toastError(err.response?.data?.detail || 'Transcript not yet available.', 'Transcript Pending');
    } finally {
      setSyncing(false);
    }
  };

  const handleSimulateComplete = async () => {
    if (!consultation?.id) { toastError('No consultation ID.', 'Error'); return; }
    try {
      setSyncing(true);
      info('Simulating Google Meet completion...', 'Simulating');
      const res = await simulateGoogleMeetComplete(consultation.id);
      if (res?.success) {
        setMeetData((prev) => ({ ...prev, meetingStatus: 'transcript_ready', transcriptStatus: 'ready' }));
        success('Simulated transcript ready.', 'Transcript Ready');
        if (onTranscriptReady) onTranscriptReady(res.data);
        if (onConsultationUpdated) onConsultationUpdated();
      }
    } catch { toastError('Simulation failed.', 'Error'); }
    finally { setSyncing(false); }
  };

  const copyMeetLinkToClipboard = () => {
    if (meetData.meetingUri) {
      navigator.clipboard.writeText(meetData.meetingUri);
      setCopiedLink(true);
      success('Google Meet link copied.', 'Copied');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Stepper — reflects real state
  const getStepStatus = (stepIndex) => {
    const hasSpace = Boolean(meetData.spaceName || meetData.meetingUri);
    const isEnded = ['meeting_ended', 'transcript_ready', 'doctor_reviewed', 'finalized', 'completed'].includes(meetData.meetingStatus);
    const hasTranscript = meetData.transcriptStatus === 'ready' || ['transcript_ready', 'doctor_reviewed', 'finalized'].includes(meetData.meetingStatus);
    const isReviewed = ['doctor_reviewed', 'finalized'].includes(consultation?.status) || consultation?.is_approved;
    const isFollowup = consultation?.status === 'finalized' || consultation?.is_approved;
    switch (stepIndex) {
      case 1: return consultation?.id ? 'completed' : 'current';
      case 2: return hasSpace ? 'completed' : 'current';
      case 3: return hasSpace ? (isEnded ? 'completed' : 'current') : 'pending';
      case 4: return isEnded ? 'completed' : 'pending';
      case 5: return isEnded ? (hasTranscript ? 'completed' : 'current') : 'pending';
      case 6: return hasTranscript ? 'completed' : 'pending';
      case 7: return isReviewed ? 'completed' : (hasTranscript ? 'current' : 'pending');
      case 8: return isFollowup ? 'completed' : 'pending';
      default: return 'pending';
    }
  };

  const steps = [
    { label: 'Consultation Created', num: 1 },
    { label: 'Google Meet Created', num: 2 },
    { label: 'Participants Joined', num: 3 },
    { label: 'Consultation Ended', num: 4 },
    { label: 'Transcript Processing', num: 5 },
    { label: 'Transcript Ready', num: 6 },
    { label: 'Doctor Review', num: 7 },
    { label: 'Follow-up Created', num: 8 },
  ];

  const hasRealMeetUri = Boolean(meetData.meetingUri);
  const isMeetFailed = meetData.meetingStatus === 'meet_creation_failed' || meetData.meetingStatus === 'MEET_CREATION_FAILED';
  const isTranscriptReady = meetData.transcriptStatus === 'ready';
  const isTranscriptProcessing = meetData.transcriptStatus === 'processing';
  const isMeetEnded = ['meeting_ended', 'transcript_ready', 'completed', 'COMPLETED'].includes(meetData.meetingStatus);

  return (
    <div className="flex flex-col gap-5">
      {/* Main Google Meet Hub Card */}
      <div className="glass-card animate-fade-in" style={{ padding: 'var(--space-5)', border: '1px solid var(--color-border-subtle)' }}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, rgba(0,131,45,0.18), rgba(0,102,218,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,131,45,0.4)', boxShadow: '0 2px 10px rgba(0,131,45,0.2)' }}>
              <IconGoogleMeet size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold" style={{ margin: 0 }}>Google Meet Telehealth</h3>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Official REST API v2</span>
                {hasRealMeetUri && !isMeetEnded && (
                  <span className="badge badge-primary flex items-center gap-1" style={{ fontSize: '0.7rem' }}>
                    <span className="status-dot animate-pulse" /> Live Space Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted" style={{ margin: 0, marginTop: 2 }}>High-definition clinical video via official Google Meet REST API v2</p>
            </div>
          </div>

          {/* Auth Status & Edit Google ID */}
          <div className="flex items-center gap-2 flex-wrap">
            {!authStatus.checked ? (
              <span className="badge badge-secondary text-xs">Checking Google auth...</span>
            ) : authStatus.is_connected ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="badge badge-success flex items-center gap-1.5" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                  <IconCheck size={13} />
                  <span className="font-semibold">{authStatus.email || 'Google Connected'}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setCustomGoogleEmail(authStatus.email || '');
                    setIsEditingGoogleAccount(true);
                  }}
                  title="Edit Google Account for Google Meet"
                >
                  Edit Google ID
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-muted hover:text-danger"
                  onClick={handleDisconnect}
                  title="Disconnect Google Meet"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button type="button" className="btn btn-secondary btn-sm flex items-center gap-1.5" onClick={handleConnectGoogle} disabled={loading}>
                  <IconGoogle size={14} /> Connect Google Account
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-secondary"
                  onClick={() => {
                    setCustomGoogleEmail('');
                    setIsEditingGoogleAccount(true);
                  }}
                >
                  Set Google ID
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Consent Notice */}
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border-subtle)', marginBottom: 'var(--space-4)' }}>
          <div className="flex items-start gap-3">
            <IconShield size={20} style={{ color: 'var(--color-primary-400)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Clinical Documentation & Consent Notice</span>
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer hover:text-primary transition-colors">
                  <input type="checkbox" checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} style={{ accentColor: 'var(--color-primary-500)', width: 15, height: 15 }} />
                  <span className="font-medium text-primary">Patient Informed & Consent Verified</span>
                </label>
              </div>
              <p className="text-xs text-muted" style={{ margin: '4px 0 0 0', lineHeight: 1.5 }}>
                This consultation uses Google Meet and may generate a transcript for clinical documentation. All participants must be informed and have provided required consent.
              </p>
            </div>
          </div>
        </div>

        {/* Meet Details & Controls */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {/* Status & URI Box */}
          <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted font-bold tracking-wider">MEETING STATUS</span>
                <span className={`badge ${getMeetStatusBadge(meetData.meetingStatus)}`} style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
                  {STATUS_DISPLAY[meetData.meetingStatus] || meetData.meetingStatus?.replace(/_/g, ' ') || 'Scheduled'}
                </span>
              </div>

              {/* Meet URI — only shown when real URI exists */}
              {hasRealMeetUri ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-muted font-medium">Official Google Meet Link:</div>
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded text-xs font-mono"
                    style={{ background: 'var(--color-bg-base)', border: '1px solid rgba(56,189,248,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <span className="truncate font-semibold text-primary flex-1">{meetData.meetingUri}</span>
                    <button type="button" className="btn btn-ghost btn-xs flex-shrink-0" onClick={copyMeetLinkToClipboard}>
                      {copiedLink ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  {meetData.meetingCode && (
                    <div className="text-xs text-muted">
                      Meeting Code: <code className="text-secondary font-mono">{meetData.meetingCode}</code>
                    </div>
                  )}
                  {meetData.spaceName && (
                    <div className="text-xs text-muted">
                      Space Resource: <code className="text-secondary text-xs">{meetData.spaceName}</code>
                    </div>
                  )}
                </div>
              ) : isMeetFailed ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-danger">
                    <IconAlert size={16} />
                    <span>Google Meet could not be created.</span>
                  </div>
                  {meetCreationError && (
                    <div className="text-xs text-muted p-2 rounded" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <strong>Possible causes:</strong>
                      <ul style={{ margin: '4px 0 0 12px', padding: 0 }}>
                        <li>Google authorization unavailable</li>
                        <li>Insufficient Google Workspace permissions</li>
                        <li>Backend unavailable</li>
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted py-3">
                  No Google Meet Space created yet. Click <strong>Create Google Meet</strong> to initialize the secure video space.
                </div>
              )}
            </div>

            {/* Transcript status */}
            <div className="mt-3 pt-3 border-t border-subtle">
              <div className="text-xs text-muted font-bold tracking-wider mb-1">TRANSCRIPT STATUS</div>
              {isTranscriptReady ? (
                <span className="badge badge-success flex items-center gap-1 w-fit"><IconCheck size={12} /> Transcript Ready</span>
              ) : isTranscriptProcessing ? (
                <span className="badge badge-warning animate-pulse flex items-center gap-1 w-fit"><span className="spinner spinner-xs" style={{ width: 10, height: 10 }} /> Processing...</span>
              ) : meetData.transcriptStatus === 'failed' ? (
                <span className="badge badge-danger flex items-center gap-1 w-fit"><IconAlert size={12} /> Transcript failed</span>
              ) : meetData.transcriptStatus === 'unavailable' ? (
                <span className="badge badge-secondary w-fit">Transcript unavailable</span>
              ) : (
                <span className="badge badge-secondary w-fit">Waiting for transcript...</span>
              )}
            </div>
          </div>

          {/* Actions Box */}
          <div className="flex flex-col justify-between gap-3" style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <div>
              <div className="text-xs text-muted font-bold tracking-wider mb-3">ACTIONS</div>
              <div className="flex flex-wrap gap-2.5">
                {/* Create Meet — only shown when no real URI */}
                {!hasRealMeetUri && !isMeetFailed && (
                  <button id="create-google-meet-btn" type="button" className="btn btn-primary flex-1 flex items-center justify-center gap-2 py-2.5" onClick={handleCreateMeet} disabled={loading} style={{ fontSize: '0.9rem' }}>
                    <IconGoogleMeet size={18} /><span>{loading ? 'Creating...' : 'Create Google Meet'}</span>
                  </button>
                )}

                {/* Retry — only shown on failure */}
                {isMeetFailed && (
                  <button id="retry-google-meet-btn" type="button" className="btn btn-warning flex items-center justify-center gap-2 py-2.5" onClick={handleCreateMeet} disabled={loading}>
                    <IconRefresh size={16} /><span>Retry</span>
                  </button>
                )}

                {/* Join Meet — ONLY shown when real meetingUri exists */}
                {hasRealMeetUri && (
                  <button id="join-google-meet-btn" type="button" className="btn btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 shadow-md" onClick={handleJoinMeet}
                    style={{ fontSize: '0.9rem', background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}>
                    <IconExternalLink size={16} /><span className="font-bold">Join Google Meet</span>
                  </button>
                )}

                {/* End Meeting — only when meet is active */}
                {hasRealMeetUri && !isMeetEnded && (
                  <button id="end-google-meet-btn" type="button" className="btn btn-danger btn-sm flex items-center gap-1.5" onClick={handleEndMeet} disabled={loading}>
                    End Meeting
                  </button>
                )}
              </div>
            </div>

            {/* Refresh & Sync Row */}
            <div className="flex flex-wrap gap-2">
              <button id="refresh-meet-status-btn" type="button" className="btn btn-secondary btn-sm flex items-center gap-1.5" onClick={handleRefreshStatus} disabled={refreshing}>
                <IconRefresh size={14} className={refreshing ? 'animate-spin' : ''} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
              </button>
              {hasRealMeetUri && (
                <button id="sync-transcript-btn" type="button" className="btn btn-secondary btn-sm flex items-center gap-1.5" onClick={handleSyncTranscript} disabled={syncing}>
                  <IconRefresh size={14} className={syncing ? 'animate-spin' : ''} />
                  <span>{syncing ? 'Syncing...' : 'Sync Transcript'}</span>
                </button>
              )}
            </div>

            {/* Back to Appointment link */}
            {appointment?.id && (
              <div className="pt-2 border-t border-subtle">
                <a href={`/appointments/${appointment.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  Back to Appointment
                </a>
              </div>
            )}

            {/* Developer sandbox simulation */}
            {authStatus.is_mock && (
              <div className="pt-3 border-t border-subtle flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-muted">Developer Sandbox Mode:</span>
                <button type="button" className="btn btn-ghost btn-xs text-primary flex items-center gap-1" onClick={handleSimulateComplete} disabled={syncing}>
                  <IconSparkle size={13} /><span>1-Click Simulate Completed Meet</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Consultation Timeline Stepper */}
        <div className="mt-5 pt-4 border-t border-subtle">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Consultation Lifecycle</span>
            <span className="text-xs text-muted">Step {Math.min(steps.findIndex(s => getStepStatus(s.num) === 'current') + 1 || steps.length, steps.length)} of {steps.length}</span>
          </div>
          <div className="timeline-stepper grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {steps.map((s) => {
              const status = getStepStatus(s.num);
              return (
                <div key={s.num} className={`stepper-item ${status}`}
                  style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: status === 'completed' ? 'rgba(0,200,115,0.1)' : status === 'current' ? 'rgba(56,189,248,0.14)' : 'var(--color-bg-base)', border: `1px solid ${status === 'completed' ? 'var(--color-success)' : status === 'current' ? 'var(--color-primary-500)' : 'var(--color-border-subtle)'}`, display: 'flex', flexDirection: 'column', gap: 3, transition: 'all 0.2s ease' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: status === 'completed' ? 'var(--color-success)' : status === 'current' ? 'var(--color-primary-400)' : 'var(--color-text-muted)' }}>STEP {s.num}</span>
                    {status === 'completed' && <IconCheck size={12} style={{ color: 'var(--color-success)' }} />}
                    {status === 'current' && <span className="spinner spinner-xs" style={{ width: 10, height: 10 }} />}
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: status === 'pending' ? 'var(--color-text-muted)' : 'var(--color-text-primary)', lineHeight: 1.2 }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Consent Confirmation Modal */}
      {consentModalOpen && (
        <div className="modal-backdrop" onClick={() => setConsentModalOpen(false)}>
          <div className="modal-content animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="flex items-center gap-3 mb-3">
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-400)' }}>
                <IconShield size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ margin: 0 }}>Google Meet Clinical Consent</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Required prior to video consultation & transcription</p>
              </div>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', marginBottom: 'var(--space-4)' }}>
              <p className="text-sm text-secondary" style={{ lineHeight: 1.5, margin: 0 }}>
                This consultation uses Google Meet and may generate a transcript for clinical documentation. Ensure all participants are informed and have provided required consent.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setConsentModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => { setConsentConfirmed(true); setConsentModalOpen(false); handleCreateMeet(); }}>
                Confirm Consent & Create Space
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
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000 }}
        >
          <div
            className="modal-content animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <IconGoogle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ margin: 0 }}>Configure Google Meet ID</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Edit Google Account used exclusively for Google Meet telehealth.</p>
              </div>
            </div>

            <p className="text-xs text-secondary mb-4" style={{ lineHeight: 1.5 }}>
              This Google Account will be used exclusively for Google Meet video spaces. Your MediBridge AI login email remains separate and unchanged.
            </p>

            <form onSubmit={handleSaveGoogleAccount}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-secondary mb-1">
                  Google Account / Gmail Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. doctor.name@gmail.com or hospital workspace email"
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
                  <IconGoogle size={14} /> OAuth Connect
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
                    {savingAccount ? 'Saving...' : 'Save Google ID'}
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
