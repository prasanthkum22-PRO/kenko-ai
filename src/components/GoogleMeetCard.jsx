import React, { useState, useEffect } from 'react';
import {
  getGoogleAuthStatus,
  getGoogleAuthUrl,
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
  IconVideo,
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

export default function GoogleMeetCard({
  consultation,
  onTranscriptReady,
  onConsultationUpdated,
}) {
  const { success, error: toastError, info } = useToast();
  const [authStatus, setAuthStatus] = useState({
    is_connected: true,
    email: 'doctor@medibridge.ai',
    is_mock: true,
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [meetData, setMeetData] = useState({
    spaceName: consultation?.google_space_name || null,
    meetingUri: consultation?.google_meeting_uri || null,
    meetingCode: consultation?.google_meeting_code || null,
    meetingStatus: consultation?.meeting_status || 'scheduled',
    transcriptStatus: consultation?.transcript_status || 'pending',
  });
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(Boolean(consultation?.has_consent));

  // Check OAuth status on mount
  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await getGoogleAuthStatus();
        if (active && res) {
          setAuthStatus({
            ...res,
            email: res.email || 'doctor@medibridge.ai',
          });
        }
      } catch (err) {
        if (active) {
          setAuthStatus({
            is_connected: true,
            email: 'doctor@medibridge.ai',
            is_mock: true,
          });
        }
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, []);

  // Update local state when consultation prop updates
  useEffect(() => {
    if (consultation) {
      setMeetData({
        spaceName: consultation.google_space_name,
        meetingUri: consultation.google_meeting_uri,
        meetingCode: consultation.google_meeting_code,
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
      if (res?.auth_url) {
        if (res.is_configured && res.auth_url.startsWith('https://accounts.google.com')) {
          window.location.href = res.auth_url;
        } else {
          setAuthStatus({ is_connected: true, email: 'doctor@medibridge.ai', is_mock: true });
          success('Connected in simulated Google Meet test mode.', 'Google Meet Ready');
        }
      } else {
        setAuthStatus({ is_connected: true, email: 'doctor@medibridge.ai', is_mock: true });
        success('Connected in simulated Google Meet test mode.', 'Google Meet Ready');
      }
    } catch (err) {
      console.warn('Google Auth API note, connecting in local sandbox mode:', err);
      setAuthStatus({ is_connected: true, email: 'doctor@medibridge.ai', is_mock: true });
      success('Connected in simulated Google Meet test mode.', 'Google Meet Sandbox Ready');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeet = async () => {
    if (!consentConfirmed) {
      setConsentModalOpen(true);
      return;
    }

    try {
      setLoading(true);
      info('Creating secure Google Meet Space via official Google REST API v2...', 'Connecting');
      const res = await createGoogleMeet(consultation.id, consultation.patient_id);
      if (res?.success) {
        setMeetData((prev) => ({
          ...prev,
          spaceName: res.spaceName,
          meetingUri: res.meetingUri,
          meetingCode: res.meetingCode,
          meetingStatus: 'waiting_for_participants',
        }));
        success('Google Meet Space created successfully! Ready for Doctor & Patient to join.', 'Google Meet Active');
        if (onConsultationUpdated) onConsultationUpdated();
      }
    } catch (err) {
      console.error('Failed to create Google Meet:', err);
      toastError(
        err.response?.data?.detail || 'Failed to initialize Google Meet Space.',
        'Creation Error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEndMeet = async () => {
    try {
      setLoading(true);
      await endGoogleMeet(consultation.id);
      setMeetData((prev) => ({
        ...prev,
        meetingStatus: 'meeting_ended',
        transcriptStatus: 'processing',
      }));
      info('Consultation concluded. Querying Google Meet transcript artifacts...', 'Meeting Ended');
      
      setTimeout(() => {
        handleSyncTranscript();
      }, 1500);
    } catch (err) {
      toastError('Failed to end meeting status.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTranscript = async () => {
    try {
      setSyncing(true);
      info('Retrieving and mapping Google Meet transcript entries...', 'Syncing');
      const res = await syncGoogleMeetTranscript(consultation.id);
      if (res?.transcriptStatus === 'ready' && res.entries?.length > 0) {
        setMeetData((prev) => ({
          ...prev,
          meetingStatus: 'transcript_ready',
          transcriptStatus: 'ready',
        }));
        success(
          `Retrieved ${res.entries.length} structured dialogue turns from Google Meet.`,
          'Transcript Ready'
        );
        if (onTranscriptReady) onTranscriptReady(res);
        if (onConsultationUpdated) onConsultationUpdated();
      } else {
        info(
          res.message || 'Transcript is still being processed by Google Meet. Please check again in a moment.',
          'Processing Transcript'
        );
      }
    } catch (err) {
      console.error('Failed to sync transcript:', err);
      toastError(
        err.response?.data?.detail || 'Transcript artifact not yet ready on Google Meet.',
        'Transcript Pending'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSimulateComplete = async () => {
    try {
      setSyncing(true);
      info('Simulating Google Meet conclusion and generating clinical transcript...', 'Simulating');
      const res = await simulateGoogleMeetComplete(consultation.id);
      if (res?.success) {
        setMeetData((prev) => ({
          ...prev,
          meetingStatus: 'transcript_ready',
          transcriptStatus: 'ready',
        }));
        success('Simulated Google Meet consultation transcript retrieved!', 'Transcript Ready');
        if (onTranscriptReady) onTranscriptReady(res.data);
        if (onConsultationUpdated) onConsultationUpdated();
      }
    } catch (err) {
      toastError('Simulation failed.', 'Error');
    } finally {
      setSyncing(false);
    }
  };

  const copyMeetLinkToClipboard = () => {
    if (meetData.meetingUri) {
      navigator.clipboard.writeText(meetData.meetingUri);
      setCopiedLink(true);
      success('Google Meet link copied to clipboard.', 'Link Copied');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Stepper status calculation
  const getStepStatus = (stepIndex) => {
    const hasSpace = Boolean(meetData.spaceName || meetData.meetingUri);
    const isEnded = ['meeting_ended', 'transcript_ready', 'doctor_reviewed', 'finalized'].includes(meetData.meetingStatus);
    const hasTranscript = ['ready'].includes(meetData.transcriptStatus) || ['transcript_ready', 'summary_ready', 'doctor_reviewed', 'finalized'].includes(consultation?.status);
    const isReviewed = ['doctor_reviewed', 'finalized'].includes(consultation?.status) || consultation?.is_approved;
    const isFollowupCreated = consultation?.status === 'finalized' || consultation?.is_approved;

    switch (stepIndex) {
      case 1: return 'completed';
      case 2: return hasSpace ? 'completed' : 'current';
      case 3: return hasSpace ? (isEnded ? 'completed' : 'current') : 'pending';
      case 4: return isEnded ? 'completed' : 'pending';
      case 5: return isEnded ? (hasTranscript ? 'completed' : 'current') : 'pending';
      case 6: return hasTranscript ? 'completed' : 'pending';
      case 7: return isReviewed ? 'completed' : (hasTranscript ? 'current' : 'pending');
      case 8: return isFollowupCreated ? 'completed' : 'pending';
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

  return (
    <div className="flex flex-col gap-5">
      {/* ── Main Google Meet Hub Card ── */}
      <div className="glass-card animate-fade-in" style={{ padding: 'var(--space-5)', border: '1px solid var(--color-border-subtle)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, rgba(0, 131, 45, 0.18), rgba(0, 102, 218, 0.18))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(0, 131, 45, 0.4)',
                boxShadow: '0 2px 10px rgba(0, 131, 45, 0.2)',
              }}
            >
              <IconGoogleMeet size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold" style={{ margin: 0 }}>Google Meet Telehealth Integration</h3>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Official REST API v2</span>
                {meetData.meetingUri && (
                  <span className="badge badge-primary flex items-center gap-1" style={{ fontSize: '0.7rem' }}>
                    <span className="status-dot animate-pulse" /> Live Space Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted" style={{ margin: 0, marginTop: 2 }}>
                High-definition clinical video consultation with official Google Meet REST API v2 and transcript ingestion.
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            {authStatus.is_connected ? (
              <span className="badge badge-success flex items-center gap-1.5" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                <IconCheck size={13} /> {authStatus.email || 'Google Account Connected'}
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm flex items-center gap-1.5"
                onClick={handleConnectGoogle}
                disabled={loading}
              >
                <IconGoogle size={14} /> Connect Google Meet
              </button>
            )}
          </div>
        </div>

        {/* ── Consent Notice Alert ── */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-base)',
            border: '1px solid var(--color-border-subtle)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div className="flex items-start gap-3">
            <IconShield size={20} style={{ color: 'var(--color-primary-400)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Clinical Documentation & Consent Notice</span>
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer hover:text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={consentConfirmed}
                    onChange={(e) => setConsentConfirmed(e.target.checked)}
                    style={{ accentColor: 'var(--color-primary-500)', width: 15, height: 15 }}
                  />
                  <span className="font-medium text-primary">Patient Informed &amp; Consent Verified</span>
                </label>
              </div>
              <p className="text-xs text-muted" style={{ margin: '4px 0 0 0', lineHeight: 1.5 }}>
                &ldquo;This consultation uses Google Meet and may generate a transcript for clinical documentation. Please ensure all participants are informed and have provided the required consent according to the applicable policies and regulations.&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* ── Meet Details & Controls ── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {/* Status & URI Info Box */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted font-bold tracking-wider">CONFERENCE STATUS</span>
                <span
                  className={`badge ${
                    meetData.meetingStatus === 'transcript_ready'
                      ? 'badge-success'
                      : meetData.meetingStatus === 'waiting_for_participants'
                      ? 'badge-primary'
                      : meetData.meetingStatus === 'meeting_ended'
                      ? 'badge-warning'
                      : 'badge-secondary'
                  }`}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  {meetData.meetingStatus.replace(/_/g, ' ')}
                </span>
              </div>

              {meetData.meetingUri ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-muted font-medium">Official Google Meet Link:</div>
                  <div
                    className="flex items-center justify-between gap-2 p-2.5 rounded text-xs font-mono"
                    style={{
                      background: 'var(--color-bg-base)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    <a
                      href={meetData.meetingUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-semibold text-primary hover:underline flex items-center gap-1.5"
                      title="Open Google Meet in new tab"
                    >
                      <span>{meetData.meetingUri}</span>
                      <IconExternalLink size={12} />
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs flex-shrink-0"
                      onClick={copyMeetLinkToClipboard}
                      title="Copy Link to Clipboard"
                    >
                      {copiedLink ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  {meetData.spaceName && (
                    <div className="text-xs text-muted mt-1">
                      Durable Space Resource: <code className="text-secondary">{meetData.spaceName}</code>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted py-3">
                  No Google Meet Space created yet for this consultation. Click <strong>Create Google Meet</strong> to initialize the secure video space.
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons Box */}
          <div
            className="flex flex-col justify-between gap-3"
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div>
              <div className="text-xs text-muted font-bold tracking-wider mb-3">CLINICAL ACTIONS</div>
              
              <div className="flex flex-wrap gap-2.5">
                {!meetData.meetingUri ? (
                  <button
                    id="create-google-meet-btn"
                    type="button"
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2 py-2.5"
                    onClick={handleCreateMeet}
                    disabled={loading}
                    style={{ fontSize: '0.9rem' }}
                  >
                    <IconGoogleMeet size={18} />
                    <span>Create Google Meet</span>
                  </button>
                ) : (
                  <>
                    <a
                      id="join-google-meet-btn"
                      href={meetData.meetingUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 shadow-md"
                      style={{
                        fontSize: '0.9rem',
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                        textDecoration: 'none',
                      }}
                    >
                      <IconExternalLink size={16} />
                      <span className="font-bold">Join Google Meet ↗</span>
                    </a>

                    {meetData.meetingStatus !== 'meeting_ended' && meetData.meetingStatus !== 'transcript_ready' && (
                      <button
                        id="end-google-meet-btn"
                        type="button"
                        className="btn btn-danger btn-sm flex items-center gap-1.5"
                        onClick={handleEndMeet}
                        disabled={loading}
                      >
                        End Meeting
                      </button>
                    )}
                  </>
                )}

                {meetData.meetingUri && (
                  <button
                    id="sync-transcript-btn"
                    type="button"
                    className="btn btn-secondary flex items-center gap-1.5"
                    onClick={handleSyncTranscript}
                    disabled={syncing}
                  >
                    <IconRefresh size={14} className={syncing ? 'animate-spin' : ''} />
                    <span>{syncing ? 'Syncing...' : 'Sync Transcript'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sandbox Simulation Mode Helper */}
            <div className="pt-3 border-t border-subtle flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-muted">Developer Sandbox Mode:</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs text-primary flex items-center gap-1"
                onClick={handleSimulateComplete}
                disabled={syncing}
              >
                <IconSparkle size={13} />
                <span>1-Click Simulate Completed Meet</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Consultation Timeline Stepper ── */}
        <div className="mt-5 pt-4 border-t border-subtle">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              Consultation Lifecycle Stepper
            </span>
            <span className="text-xs text-muted">Step {steps.findIndex(s => getStepStatus(s.num) === 'current') + 1 || 8} of 8</span>
          </div>
          <div className="timeline-stepper grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {steps.map((s) => {
              const status = getStepStatus(s.num);
              return (
                <div
                  key={s.num}
                  className={`stepper-item ${status}`}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background:
                      status === 'completed'
                        ? 'rgba(0, 200, 115, 0.1)'
                        : status === 'current'
                        ? 'rgba(56, 189, 248, 0.14)'
                        : 'var(--color-bg-base)',
                    border: `1px solid ${
                      status === 'completed'
                        ? 'var(--color-success)'
                        : status === 'current'
                        ? 'var(--color-primary-500)'
                        : 'var(--color-border-subtle)'
                    }`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color:
                          status === 'completed'
                            ? 'var(--color-success)'
                            : status === 'current'
                            ? 'var(--color-primary-400)'
                            : 'var(--color-text-muted)',
                      }}
                    >
                      STEP {s.num}
                    </span>
                    {status === 'completed' && <IconCheck size={12} style={{ color: 'var(--color-success)' }} />}
                    {status === 'current' && <span className="spinner spinner-xs" style={{ width: 10, height: 10 }} />}
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: status === 'pending' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Consent Confirmation Modal ── */}
      {consentModalOpen && (
        <div className="modal-backdrop" onClick={() => setConsentModalOpen(false)}>
          <div className="modal-content animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="flex items-center gap-3 mb-3">
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary-400)',
                }}
              >
                <IconShield size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ margin: 0 }}>Google Meet Clinical Consent</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Required prior to video consultation &amp; transcription</p>
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <p className="text-sm text-secondary" style={{ lineHeight: 1.5, margin: 0 }}>
                &ldquo;This consultation uses Google Meet and may generate a transcript for clinical documentation. Please ensure all participants are informed and have provided the required consent according to the applicable policies and regulations.&rdquo;
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setConsentModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setConsentConfirmed(true);
                  setConsentModalOpen(false);
                  handleCreateMeet();
                }}
              >
                Confirm Consent &amp; Create Space
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
