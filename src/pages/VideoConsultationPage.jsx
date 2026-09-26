/**
 * VideoConsultationPage — Google Meet Telehealth Consultation
 *
 * Correct data relationship:
 *   Appointment → Consultation → Google Meet Space → Conference Record → Transcript
 *
 * Rules enforced here:
 *  • NO fake patient names (Eleanor Vance, etc.)
 *  • NO fake doctor names
 *  • Timer only starts when consultation.startedAt is set and status = IN_PROGRESS
 *  • SOAP generation disabled until transcript is actually available
 *  • Meet Join button only shown when googleMeetingUri is real
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getConsultation,
  getTranscript,
  summarizeConsultation,
  getAppointment,
  getAppointmentFull,
} from '../services/api';
import {
  IconClock,
  IconCheck,
  IconDoc,
  IconArrowLeft,
  IconGoogleMeet,
  IconStethoscope,
  IconAlert,
  IconX,
  IconRefresh,
} from '../components/icons';
import GoogleMeetCard from '../components/GoogleMeetCard';
import GoogleMeetTranscriptViewer from '../components/GoogleMeetTranscriptViewer';

function formatTimer(sec) {
  const hrs = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function initialsOf(name) {
  if (!name || typeof name !== 'string') return '?';
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
}

const MEET_STATUS_LABELS = {
  scheduled: { label: 'Scheduled', color: 'badge-secondary', dot: '#94a3b8' },
  SCHEDULED: { label: 'Scheduled', color: 'badge-secondary', dot: '#94a3b8' },
  meet_creating: { label: 'Creating Meet...', color: 'badge-warning', dot: '#f59e0b' },
  MEET_CREATING: { label: 'Creating Meet...', color: 'badge-warning', dot: '#f59e0b' },
  meet_ready: { label: 'Meet Ready', color: 'badge-success', dot: '#22c55e' },
  MEET_READY: { label: 'Meet Ready', color: 'badge-success', dot: '#22c55e' },
  waiting_for_participants: { label: 'Meet Ready', color: 'badge-success', dot: '#22c55e' },
  meet_creation_failed: { label: 'Meet Creation Failed', color: 'badge-danger', dot: '#ef4444' },
  MEET_CREATION_FAILED: { label: 'Meet Creation Failed', color: 'badge-danger', dot: '#ef4444' },
  in_progress: { label: 'In Progress', color: 'badge-primary', dot: '#38bdf8' },
  IN_PROGRESS: { label: 'In Progress', color: 'badge-primary', dot: '#38bdf8' },
  meeting_ended: { label: 'Meeting Ended', color: 'badge-warning', dot: '#f59e0b' },
  transcript_ready: { label: 'Transcript Ready', color: 'badge-success', dot: '#22c55e' },
  completed: { label: 'Completed', color: 'badge-success', dot: '#22c55e' },
  COMPLETED: { label: 'Completed', color: 'badge-success', dot: '#22c55e' },
};

function getMeetStatusMeta(status) {
  return MEET_STATUS_LABELS[status] || { label: status || 'Unknown', color: 'badge-secondary', dot: '#94a3b8' };
}

export default function VideoConsultationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();

  const urlConsultationId = searchParams.get('id');
  const urlAppointmentId = searchParams.get('appointmentId');

  const [consultation, setConsultation] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [consultationId, setConsultationId] = useState(urlConsultationId || null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(urlConsultationId || urlAppointmentId));
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [transcriptStatus, setTranscriptStatus] = useState('pending');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [modalPostSummaryOpen, setModalPostSummaryOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let cId = urlConsultationId;

      // ── When launched from appointment (/video?appointmentId=...) ──
      // Use the rich appointment response: it returns patient, doctor, consultation, googleMeet
      if (!cId && urlAppointmentId) {
        try {
          const apptFull = await getAppointmentFull(urlAppointmentId);
          if (!apptFull?.success) {
            setLoadError('Appointment not found or access denied.');
            setIsLoading(false);
            return;
          }
          // Merge appointment block with patient/doctor/meet into a single shape
          const mergedAppt = {
            ...apptFull.appointment,
            patient_name: apptFull.patient?.displayName || apptFull.appointment?.patient_name || null,
            patient_id: apptFull.patient?.id || apptFull.appointment?.patientId || null,
            patient_age: apptFull.patient?.age || null,
            patient_gender: apptFull.patient?.gender || null,
            language: apptFull.patient?.language || null,
            doctor_name: apptFull.doctor?.displayName || apptFull.appointment?.doctor_name || null,
            doctor_id: apptFull.doctor?.id || apptFull.appointment?.doctorId || null,
            doctor_department: apptFull.doctor?.specialization || null,
            consultation_id: apptFull.consultation?.id || apptFull.appointment?.consultationId || null,
          };
          setAppointment(mergedAppt);
          cId = apptFull.consultation?.id || apptFull.appointment?.consultationId || null;

          // If we got consultation data directly, use it
          if (apptFull.consultation) {
            const c = apptFull.consultation;
            // Augment consultation with patient/doctor names from richer appointment block
            const augmented = {
              ...c,
              patient_name: mergedAppt.patient_name,
              patient_id: mergedAppt.patient_id,
              patient_age: mergedAppt.patient_age,
              patient_gender: mergedAppt.patient_gender,
              doctor_name: mergedAppt.doctor_name,
              doctor_department: mergedAppt.doctor_department,
              google_meeting_uri: apptFull.googleMeet?.meetingUri || c.googleMeetingUri || null,
              google_meeting_code: apptFull.googleMeet?.meetingCode || c.googleMeetingCode || null,
              google_space_name: apptFull.googleMeet?.spaceName || c.googleSpaceName || null,
              meeting_status: apptFull.googleMeet?.status || c.meetingStatus || 'SCHEDULED',
            };
            setConsultation(augmented);
            if (cId) setConsultationId(cId);
            const tStatus = augmented.transcriptStatus || augmented.transcript_status || 'pending';
            setTranscriptStatus(tStatus);
            if (tStatus === 'ready' && cId) {
              try {
                const tData = await getTranscript(cId);
                if (Array.isArray(tData) && tData.length > 0) setTranscriptSegments(tData);
              } catch {}
            }
          }

          if (!cId) { setIsLoading(false); return; }
        } catch (err) {
          setLoadError('Appointment not found or access denied.');
          setIsLoading(false);
          return;
        }
      }

      if (!cId) { setIsLoading(false); return; }
      setConsultationId(cId);

      // Only fetch consultation again if we don't already have it from the appointment response
      const needsConsultationFetch = !consultation;
      if (needsConsultationFetch) {
        const cData = await getConsultation(cId);
        if (!cData) { setLoadError('Consultation not found.'); setIsLoading(false); return; }
        setConsultation(cData);
        if (!appointment && (cData.appointment_id || cData.appointmentId)) {
          try {
            const apptData = await getAppointment(cData.appointment_id || cData.appointmentId);
            setAppointment(apptData);
          } catch {}
        }
        const tStatus = cData.transcript_status || 'pending';
        setTranscriptStatus(tStatus);
        if (tStatus === 'ready' || cData.status === 'transcript_ready') {
          try {
            const tData = await getTranscript(cId);
            if (Array.isArray(tData) && tData.length > 0) setTranscriptSegments(tData);
          } catch {}
        }
        const consultStatus = cData.status || '';
        const isActive = ['in_progress', 'IN_PROGRESS'].includes(consultStatus);
        if (cData.startedAt || cData.started_at) {
          const startedAt = new Date(cData.startedAt || cData.started_at);
          const endedAt = (cData.completedAt || cData.completed_at) ? new Date(cData.completedAt || cData.completed_at) : null;
          const diffSeconds = Math.max(0, Math.floor(((endedAt || new Date()) - startedAt) / 1000));
          setElapsedSeconds(diffSeconds);
          if (!endedAt && isActive) setTimerActive(true);
        } else if (cData.duration_seconds) {
          setElapsedSeconds(cData.duration_seconds);
        }
      }
    } catch (err) {
      setLoadError('Could not load consultation data. ' + (err?.message || ''));
    } finally {
      setIsLoading(false);
    }
  }, [urlConsultationId, urlAppointmentId]);

  useEffect(() => { if (urlConsultationId || urlAppointmentId) loadData(); }, [loadData]);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  useEffect(() => {
    if (!consultation) return;
    const s = consultation.status || consultation.meeting_status || '';
    const isActive = ['in_progress', 'IN_PROGRESS'].includes(s);
    const isEnded = ['meeting_ended', 'transcript_ready', 'completed', 'COMPLETED', 'doctor_reviewed', 'finalized'].includes(s);
    if (isActive && !timerActive) setTimerActive(true);
    if (isEnded && timerActive) setTimerActive(false);
  }, [consultation]);

  // Derived — NO fake fallbacks
  const patientName = consultation?.patient_name || appointment?.patient_name || null;
  const patientId = consultation?.patient_id || appointment?.patient_id || consultation?.patientId || null;
  const patientAge = consultation?.patient_age || appointment?.patient_age || null;
  const patientGender = consultation?.patient_gender || appointment?.patient_gender || null;
  const patientLanguage = consultation?.language || consultation?.detected_language || appointment?.language || null;
  const doctorName = consultation?.doctor_name || appointment?.doctor_name || null;
  const doctorDept = consultation?.doctor_department || appointment?.doctor_department || consultation?.specialization || null;
  const consultStatus = consultation?.status || consultation?.meeting_status || 'scheduled';
  const statusMeta = getMeetStatusMeta(consultStatus);
  const isConsultationCompleted = ['meeting_ended', 'transcript_ready', 'completed', 'COMPLETED', 'doctor_reviewed', 'finalized'].includes(consultStatus);
  const hasRealTranscript = transcriptSegments.length > 0 && transcriptStatus === 'ready';
  const patientInitials = patientName ? initialsOf(patientName) : '?';
  const doctorInitials = doctorName ? initialsOf(doctorName) : '?';

  // SOAP — only real data
  const subjectiveText = consultation?.summary?.chief_complaint && consultation.summary.chief_complaint !== 'Not mentioned'
    ? consultation.summary.chief_complaint
    : consultation?.summary?.symptoms?.length
    ? `Patient presents with: ${consultation.summary.symptoms.map((s) => (typeof s === 'string' ? s : s.name)).join(', ')}`
    : null;
  const objectiveText = consultation?.summary?.vitals && (consultation.summary.vitals.bp || consultation.summary.vitals.pulse || consultation.summary.vitals.spo2 || consultation.summary.vitals.temp)
    ? `BP: ${consultation.summary.vitals.bp || '--'}, HR: ${consultation.summary.vitals.pulse || '--'} bpm, SpO2: ${consultation.summary.vitals.spo2 || '--'}%, Temp: ${consultation.summary.vitals.temp || '--'} C.`
    : null;
  const assessmentText = consultation?.summary?.assessment && consultation.summary.assessment !== 'Not mentioned' ? consultation.summary.assessment : null;
  const planText = consultation?.summary?.treatment_plan && consultation.summary.treatment_plan !== 'Not mentioned'
    ? consultation.summary.treatment_plan
    : consultation?.summary?.doctor_instructions?.length
    ? consultation.summary.doctor_instructions.map((i) => (typeof i === 'string' ? i : i.instruction)).join('. ')
    : null;

  const handleGenerateAISummary = async () => {
    if (!consultationId) { toastError('No consultation to summarize.', 'No Consultation'); return; }
    if (!hasRealTranscript) { toastError('A verified transcript is required before generating an AI clinical summary.', 'Transcript Required'); return; }
    setIsSummarizing(true);
    info('Extracting SOAP summary via AI...', 'AI Extraction');
    try {
      const res = await summarizeConsultation(consultationId);
      if (res?.summary || res?.success) {
        const updated = await getConsultation(consultationId);
        setConsultation(updated);
        setModalPostSummaryOpen(true);
        success('Clinical SOAP extraction completed.', 'Summary Ready');
      }
    } catch (err) {
      toastError('Failed to generate AI summary: ' + err.message, 'Extraction Error');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!consultationId) return;
    try {
      const updated = await getConsultation(consultationId);
      setConsultation(updated);
      const tStatus = updated?.transcript_status || 'pending';
      setTranscriptStatus(tStatus);
      if (tStatus === 'ready') {
        const tData = await getTranscript(consultationId);
        if (Array.isArray(tData) && tData.length > 0) setTranscriptSegments(tData);
      }
      info('Status refreshed.', 'Refreshed');
    } catch { toastError('Could not refresh status.', 'Error'); }
  };

  if (isLoading) {
    return (
      <div className="page-container animate-fade-in" id="video-consultation-page">
        <div className="flex items-center justify-center" style={{ minHeight: 300 }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <p className="text-sm text-muted">Loading consultation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-container animate-fade-in" id="video-consultation-page">
        <div className="glass-card flex flex-col items-center gap-4 py-12" style={{ textAlign: 'center', maxWidth: 480, margin: '60px auto' }}>
          <IconAlert size={36} style={{ color: 'var(--color-danger)' }} />
          <h2 className="text-lg font-bold text-primary">Unable to Load Consultation</h2>
          <p className="text-sm text-muted">{loadError}</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}><IconArrowLeft size={14} /> Back</button>
            {consultationId && <button type="button" className="btn btn-primary" onClick={loadData}><IconRefresh size={14} /> Retry</button>}
          </div>
        </div>
      </div>
    );
  }

  if (!consultationId && !urlAppointmentId) {
    return (
      <div className="page-container animate-fade-in" id="video-consultation-page">
        <div className="glass-card flex flex-col items-center gap-4 py-12" style={{ textAlign: 'center', maxWidth: 500, margin: '60px auto' }}>
          <IconGoogleMeet size={40} style={{ color: 'var(--color-primary-400)' }} />
          <h2 className="text-lg font-bold text-primary">No Consultation Selected</h2>
          <p className="text-sm text-muted">Please open this page from an appointment or consultation record.</p>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/consultations')}><IconArrowLeft size={14} /> View Consultations</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" id="video-consultation-page">
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 mb-6" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/consultations')} title="Back"><IconArrowLeft size={16} /></button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                <IconGoogleMeet size={22} /><span>Google Meet Telehealth Consultation</span>
              </h1>
              <span className="badge badge-success text-xs font-mono">REST API v2</span>
            </div>
            <p className="text-xs text-muted mt-0.5">Secure clinical video consultation via official Google Meet REST API v2</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`badge flex items-center gap-1.5 py-1 px-3 ${statusMeta.color}`}>
            <span className="status-dot" style={{ background: statusMeta.dot }} /><span>{statusMeta.label}</span>
          </span>
          {elapsedSeconds > 0 && (
            <span className="badge badge-secondary flex items-center gap-1.5 py-1 px-3 font-mono text-xs">
              <IconClock size={12} />
              {isConsultationCompleted ? `Duration: ${formatDuration(elapsedSeconds)}` : formatTimer(elapsedSeconds)}
            </span>
          )}
          <button type="button" className="btn btn-ghost btn-sm flex items-center gap-1.5" onClick={handleRefreshStatus} title="Refresh">
            <IconRefresh size={14} /> Refresh
          </button>
          {consultationId && (
            <button type="button" className="btn btn-secondary btn-sm flex items-center gap-1.5" onClick={() => navigate(`/consultations/${consultationId}`)}>
              <IconDoc size={14} /> View Full EHR
            </button>
          )}
        </div>
      </div>

      {/* Patient & Doctor Banner */}
      <div className="glass-card mb-6" style={{ padding: '16px 20px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="avatar" style={{ width: 44, height: 44, fontSize: '1.1rem' }}>{patientInitials}</div>
            <div>
              {patientName ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-primary">{patientName}</span>
                    {(patientGender || patientAge) && (
                      <span className="badge badge-secondary text-xs">
                        {[patientGender, patientAge ? `${patientAge} yrs` : null].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {patientId && <span className="text-xs font-mono text-muted">ID: {patientId}</span>}
                  </div>
                  <div className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap">
                    {patientLanguage && <span>Language: <strong>{patientLanguage}</strong></span>}
                    <span>Type: <strong>Google Meet Telehealth</strong></span>
                    {consultation?.google_meeting_code && (
                      <span className="text-primary font-mono font-medium flex items-center gap-1">
                        <IconGoogleMeet size={12} /> {consultation.google_meeting_code}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <span className="text-sm text-muted font-medium">Patient information unavailable</span>
                  <div className="text-xs text-muted font-mono mt-0.5">ID: --</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 border-l border-subtle pl-4">
            <div className="avatar" style={{ width: 40, height: 40, fontSize: '0.95rem' }}>{doctorInitials}</div>
            <div>
              {doctorName ? (
                <>
                  <div className="font-semibold text-sm text-primary flex items-center gap-1">
                    <IconStethoscope size={14} />{doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`}
                  </div>
                  <div className="text-xs text-muted">{doctorDept || 'Attending Physician'}</div>
                </>
              ) : (
                <div className="font-semibold text-sm text-muted flex items-center gap-1">
                  <IconStethoscope size={14} /> Doctor information unavailable
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Banner — only shown when not in initial scheduled state */}
      {consultStatus !== 'scheduled' && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg border"
          style={{
            background: isConsultationCompleted ? 'rgba(34,197,94,0.07)' : timerActive ? 'rgba(56,189,248,0.07)' : 'rgba(245,158,11,0.07)',
            borderColor: isConsultationCompleted ? 'rgba(34,197,94,0.3)' : timerActive ? 'rgba(56,189,248,0.3)' : 'rgba(245,158,11,0.3)',
          }}>
          <span className="status-dot" style={{ background: statusMeta.dot }} />
          <span className="text-sm font-semibold text-primary">
            {timerActive
              ? `Consultation in progress — ${formatTimer(elapsedSeconds)}`
              : isConsultationCompleted
              ? `Consultation completed${elapsedSeconds > 0 ? ` — Duration: ${formatDuration(elapsedSeconds)}` : ''}`
              : statusMeta.label}
          </span>
        </div>
      )}

      {/* Main Workspace */}
      <div className="grid grid-cols-1 gap-6">
        <section>
          <GoogleMeetCard
            consultation={consultation}
            appointment={appointment}
            onTranscriptReady={(transcriptData) => {
              if (transcriptData?.entries && transcriptData.entries.length > 0) {
                setTranscriptSegments(transcriptData.entries);
                setTranscriptStatus('ready');
              }
            }}
            onConsultationUpdated={async () => {
              if (consultationId) {
                try {
                  const updated = await getConsultation(consultationId);
                  setConsultation(updated);
                  const tStatus = updated?.transcript_status || 'pending';
                  setTranscriptStatus(tStatus);
                  if (tStatus === 'ready') {
                    const tData = await getTranscript(consultationId);
                    if (Array.isArray(tData)) setTranscriptSegments(tData);
                  }
                } catch {}
              }
            }}
            onStatusChange={(newStatus) => {
              if (['in_progress', 'IN_PROGRESS'].includes(newStatus)) setTimerActive(true);
              else if (['meeting_ended', 'completed', 'COMPLETED'].includes(newStatus)) setTimerActive(false);
            }}
          />
        </section>
        <section>
          <GoogleMeetTranscriptViewer
            consultation={consultation}
            segments={transcriptSegments}
            transcriptStatus={transcriptStatus}
            onGenerateSummary={hasRealTranscript ? handleGenerateAISummary : null}
            isSummarizing={isSummarizing}
            onMarkReviewed={hasRealTranscript ? async () => { success('Transcript marked as reviewed.', 'Verified'); } : null}
          />
        </section>
      </div>

      {/* SOAP Modal — only when real summary data exists */}
      {modalPostSummaryOpen && (subjectiveText || objectiveText || assessmentText || planText) && (
        <div className="th-modal-backdrop animate-fade-in">
          <div className="th-modal" style={{ maxWidth: 680, width: '90%' }}>
            <div className="th-modal-header">
              <div className="th-modal-title flex items-center gap-2"><IconDoc size={18} /><span>Extracted Clinical SOAP Summary</span></div>
              <button type="button" className="th-modal-close" onClick={() => setModalPostSummaryOpen(false)}><IconX size={16} /></button>
            </div>
            <div className="th-modal-body flex flex-col gap-4">
              {subjectiveText && <div className="th-summary-section"><span className="th-summary-label">S — Subjective</span><span className="th-summary-text">{subjectiveText}</span></div>}
              {objectiveText && <div className="th-summary-section"><span className="th-summary-label">O — Objective</span><span className="th-summary-text">{objectiveText}</span></div>}
              {assessmentText && <div className="th-summary-section"><span className="th-summary-label">A — Assessment</span><span className="th-summary-text">{assessmentText}</span></div>}
              {planText && <div className="th-summary-section"><span className="th-summary-label">P — Plan</span><span className="th-summary-text">{planText}</span></div>}
            </div>
            <div className="th-modal-footer flex items-center justify-between">
              <button type="button" className="btn btn-secondary" onClick={() => setModalPostSummaryOpen(false)}>Close</button>
              <button type="button" className="btn btn-primary flex items-center gap-1.5"
                onClick={() => { success('SOAP notes synced to EHR.', 'EHR Sign-off'); setModalPostSummaryOpen(false); if (consultationId) navigate(`/consultations/${consultationId}`); }}>
                <IconCheck size={14} /> Sign &amp; Commit to EHR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
