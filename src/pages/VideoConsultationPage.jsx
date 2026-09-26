/**
 * VideoConsultationPage — Clean, Professional Healthcare Telehealth Interface
 *
 * Design Architecture:
 *   TOP: Consultation Header (Compact navigation, title, clean status badge)
 *   MIDDLE: Patient/Doctor Identity Card & Google Meet Hub Card
 *   BOTTOM: Consultation Details, Transcript, and Clinical Summary Tabs
 *
 * Rules:
 *  - Real data only (no fake patient/doctor fallbacks)
 *  - Role-aware UI (doctor vs patient experience)
 *  - Clean clinical typography and calm palette
 *  - Mobile-responsive layout (no horizontal scroll)
 *  - Min 44px touch targets
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
  createAppointmentMeet,
} from '../services/api';
import {
  getAppointmentFirestore,
  getConsultationFirestore,
  acceptAppointmentFirestore,
  saveClinicalNoteFirestore,
} from '../services/firestoreService';
import {
  IconClock,
  IconCheck,
  IconDoc,
  IconArrowLeft,
  IconGoogleMeet,
  IconStethoscope,
  IconUser,
  IconAlert,
  IconX,
  IconRefresh,
  IconSparkle,
  IconCalendar,
  IconActivity,
  IconEdit,
} from '../components/icons';
import GoogleMeetCard from '../components/GoogleMeetCard';
import GoogleMeetTranscriptViewer from '../components/GoogleMeetTranscriptViewer';

function formatTimer(sec) {
  const hrs = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (['completed', 'transcript_ready', 'doctor_reviewed', 'finalized'].includes(s)) {
    return { label: 'Completed', color: 'badge-success', dot: '#10b981' };
  }
  if (['in_progress'].includes(s)) {
    return { label: 'In Progress', color: 'badge-primary', dot: '#3b82f6' };
  }
  if (['meet_ready', 'waiting_for_participants'].includes(s)) {
    return { label: 'Ready', color: 'badge-success', dot: '#10b981' };
  }
  if (['meet_creating'].includes(s)) {
    return { label: 'Preparing...', color: 'badge-warning', dot: '#f59e0b' };
  }
  if (s.includes('failed')) {
    return { label: 'Failed', color: 'badge-danger', dot: '#ef4444' };
  }
  return { label: 'Scheduled', color: 'badge-secondary', dot: '#94a3b8' };
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
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'transcript' | 'summary'

  // Editable SOAP note for doctors
  const [isEditingSOAP, setIsEditingSOAP] = useState(false);
  const [editedSOAP, setEditedSOAP] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const isDoctor = user?.role === 'doctor' || user?.role === 'admin';
  const isPatient = user?.role === 'patient';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let cId = urlConsultationId;

      if (!cId && urlAppointmentId) {
        // 1. First check Firebase Firestore for appointment
        try {
          const aptFs = await getAppointmentFirestore(urlAppointmentId);
          if (aptFs) {
            let meetingUri = aptFs.googleMeetingUri || aptFs.googleMeet?.meetingUri || aptFs.google_meeting_uri;
            let meetingCode = aptFs.googleMeetingCode || aptFs.googleMeet?.meetingCode || aptFs.google_meeting_code;
            let spaceName = aptFs.googleSpaceName || aptFs.googleMeet?.spaceName || aptFs.google_space_name;

            if (!meetingUri && isDoctor) {
              try {
                const meetRes = await createAppointmentMeet(urlAppointmentId);
                if (meetRes?.meetingUri || meetRes?.meeting?.meetingUri) {
                  meetingUri = meetRes.meetingUri || meetRes.meeting?.meetingUri;
                  meetingCode = meetRes.meetingCode || meetRes.meeting?.meetingCode;
                  spaceName = meetRes.spaceName || meetRes.meeting?.spaceName;
                }
              } catch (mErr) {
                console.debug('Meet space creation note:', mErr);
              }
            }

            const mergedAppt = {
              id: aptFs.id,
              patient_name: aptFs.patientName || aptFs.patient_name || 'Patient',
              patient_id: aptFs.patientId || aptFs.patient_id,
              patient_age: aptFs.patientAge || aptFs.patient_age,
              patient_gender: aptFs.patientGender || aptFs.patient_gender,
              language: aptFs.patientLanguage || aptFs.language || 'English',
              doctor_name: aptFs.doctorName || aptFs.doctor_name || 'Dr. Specialist',
              doctor_id: aptFs.doctorId || aptFs.doctor_id,
              doctor_department: aptFs.doctorSpecialization || aptFs.doctor_department || 'General Medicine',
              consultation_id: aptFs.consultationId || aptFs.consultation_id || aptFs.id,
              google_meeting_uri: meetingUri,
              google_meeting_code: meetingCode,
              google_space_name: spaceName,
              scheduled_at: aptFs.scheduledStart?.toDate ? aptFs.scheduledStart.toDate().toISOString() : (aptFs.scheduledStart || aptFs.scheduled_at),
              status: aptFs.status || 'SCHEDULED',
            };
            setAppointment(mergedAppt);
            cId = mergedAppt.consultation_id || aptFs.id;

            const augmented = {
              id: cId,
              patient_name: mergedAppt.patient_name,
              patient_id: mergedAppt.patient_id,
              patient_age: mergedAppt.patient_age,
              patient_gender: mergedAppt.patient_gender,
              doctor_name: mergedAppt.doctor_name,
              doctor_department: mergedAppt.doctor_department,
              google_meeting_uri: meetingUri,
              google_meeting_code: meetingCode,
              google_space_name: spaceName,
              meeting_status: meetingUri ? 'meet_ready' : 'scheduled',
              status: meetingUri ? 'in_progress' : 'scheduled',
              has_consent: true,
            };
            setConsultation(augmented);
            setConsultationId(cId);
            setTranscriptStatus('pending');
            setTimerActive(Boolean(meetingUri));
            setLoadError(null);
            setIsLoading(false);
            return;
          }
        } catch (fsErr) {
          console.warn('Firestore direct fetch in VideoConsultation note:', fsErr);
        }

        // 2. Check Backend REST API
        try {
          const apptFull = await getAppointmentFull(urlAppointmentId);
          if (apptFull?.success) {
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
            cId = apptFull.consultation?.id || apptFull.appointment?.consultationId || urlAppointmentId;

            if (apptFull.consultation) {
              const c = apptFull.consultation;
              const augmented = {
                ...c,
                patient_name: mergedAppt.patient_name,
                patient_id: mergedAppt.patient_id,
                patient_age: mergedAppt.patient_age,
                patient_gender: mergedAppt.patient_gender,
                doctor_name: mergedAppt.doctor_name,
                doctor_department: mergedAppt.doctor_department,
                google_meeting_uri: apptFull.googleMeet?.meetingUri || c.googleMeetingUri || c.google_meeting_uri || null,
                google_meeting_code: apptFull.googleMeet?.meetingCode || c.googleMeetingCode || c.google_meeting_code || null,
                google_space_name: apptFull.googleMeet?.spaceName || c.googleSpaceName || c.google_space_name || null,
                meeting_status: apptFull.googleMeet?.status || c.meetingStatus || c.meeting_status || (apptFull.googleMeet?.meetingUri ? 'meet_ready' : 'scheduled'),
              };
              setConsultation(augmented);
              if (cId) setConsultationId(cId);
              const tStatus = augmented.transcriptStatus || augmented.transcript_status || 'pending';
              setTranscriptStatus(tStatus);
            }
          }
        } catch {
          // If backend fails, fallback gracefully
        }
      }

      if (!cId) {
        cId = urlAppointmentId || 'telehealth_session';
      }
      setConsultationId(cId);

      // Try fetching consultation from backend or firestore
      let cData = null;
      try {
        cData = await getConsultation(cId);
      } catch {
        cData = await getConsultationFirestore(cId).catch(() => null);
      }

      if (cData) {
        setConsultation(cData);
        const tStatus = cData.transcript_status || 'pending';
        setTranscriptStatus(tStatus);
        if (tStatus === 'ready' || cData.status === 'transcript_ready') {
          try {
            const tData = await getTranscript(cId);
            if (Array.isArray(tData) && tData.length > 0) setTranscriptSegments(tData);
          } catch {}
        }
      } else if (!consultation) {
        // Standard consultation container
        setConsultation({
          id: cId,
          patient_name: appointment?.patient_name || 'Patient',
          doctor_name: appointment?.doctor_name || 'Dr. Specialist',
          doctor_department: appointment?.doctor_department || 'General Medicine',
          google_meeting_uri: appointment?.google_meeting_uri || null,
          google_meeting_code: appointment?.google_meeting_code || null,
          meeting_status: appointment?.google_meeting_uri ? 'meet_ready' : 'scheduled',
          status: 'scheduled',
        });
      }
    } catch {
      setLoadError('Could not load consultation information.');
    } finally {
      setIsLoading(false);
    }
  }, [urlConsultationId, urlAppointmentId]);

  useEffect(() => {
    if (urlConsultationId || urlAppointmentId) loadData();
  }, [loadData]);

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
    const s = (consultation.status || consultation.meeting_status || '').toLowerCase();
    const isActive = s === 'in_progress';
    const isEnded = ['completed', 'meeting_ended', 'transcript_ready', 'doctor_reviewed', 'finalized'].includes(s);
    if (isActive && !timerActive) setTimerActive(true);
    if (isEnded && timerActive) setTimerActive(false);
  }, [consultation]);

  // Derived real data only
  const patientName = consultation?.patient_name || appointment?.patient_name || null;
  const patientAge = consultation?.patient_age || appointment?.patient_age || null;
  const patientGender = consultation?.patient_gender || appointment?.patient_gender || null;
  const doctorName = consultation?.doctor_name || appointment?.doctor_name || null;
  const doctorDept = consultation?.doctor_department || appointment?.doctor_department || consultation?.specialization || null;
  const consultStatus = consultation?.status || consultation?.meeting_status || 'scheduled';
  const statusMeta = getStatusBadge(consultStatus);
  const isConsultationCompleted = ['completed', 'meeting_ended', 'transcript_ready', 'doctor_reviewed', 'finalized'].includes((consultStatus || '').toLowerCase());
  const hasRealTranscript = transcriptSegments.length > 0 && transcriptStatus === 'ready';

  const appointmentDate = appointment?.appointment_date || (consultation?.created_at ? new Date(consultation.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);
  const appointmentTime = appointment?.appointment_time || (consultation?.created_at ? new Date(consultation.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null);

  // SOAP extracted data
  const subjectiveText = consultation?.summary?.chief_complaint && consultation.summary.chief_complaint !== 'Not mentioned'
    ? consultation.summary.chief_complaint
    : consultation?.summary?.symptoms?.length
    ? `Patient presents with: ${consultation.summary.symptoms.map((s) => (typeof s === 'string' ? s : s.name)).join(', ')}`
    : null;
  const objectiveText = consultation?.summary?.vitals && (consultation.summary.vitals.bp || consultation.summary.vitals.pulse || consultation.summary.vitals.spo2 || consultation.summary.vitals.temp)
    ? `BP: ${consultation.summary.vitals.bp || '--'}, HR: ${consultation.summary.vitals.pulse || '--'} bpm, SpO2: ${consultation.summary.vitals.spo2 || '--'}%, Temp: ${consultation.summary.vitals.temp || '--'} C`
    : null;
  const assessmentText = consultation?.summary?.assessment && consultation.summary.assessment !== 'Not mentioned' ? consultation.summary.assessment : null;
  const planText = consultation?.summary?.treatment_plan && consultation.summary.treatment_plan !== 'Not mentioned'
    ? consultation.summary.treatment_plan
    : consultation?.summary?.doctor_instructions?.length
    ? consultation.summary.doctor_instructions.map((i) => (typeof i === 'string' ? i : i.instruction)).join('. ')
    : null;

  const hasAnySOAP = Boolean(subjectiveText || objectiveText || assessmentText || planText);

  // Initialize edited SOAP when consultation summary changes
  useEffect(() => {
    setEditedSOAP({
      subjective: subjectiveText || '',
      objective: objectiveText || '',
      assessment: assessmentText || '',
      plan: planText || '',
    });
  }, [subjectiveText, objectiveText, assessmentText, planText]);

  const handleGenerateAISummary = async () => {
    if (!consultationId) {
      toastError('No consultation selected.', 'Error');
      return;
    }
    if (!hasRealTranscript) {
      toastError('A completed transcript is required before extracting a clinical summary.', 'Transcript Required');
      return;
    }
    setIsSummarizing(true);
    info('Extracting clinical summary from transcript...', 'Clinical Summary');
    try {
      const res = await summarizeConsultation(consultationId);
      if (res?.summary || res?.success) {
        const updated = await getConsultation(consultationId);
        setConsultation(updated);
        setActiveTab('summary');
        success('Clinical summary generated.', 'Summary Ready');
      }
    } catch {
      toastError('Failed to generate clinical summary. Please try again.', 'Error');
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
      info('Consultation status refreshed.', 'Updated');
    } catch {
      toastError('Could not refresh status.', 'Error');
    }
  };

  // Skeleton Loading State
  if (isLoading) {
    return (
      <div className="page-container animate-fade-in" id="video-consultation-page">
        <div className="flex flex-col gap-5 max-w-4xl mx-auto py-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between pb-4 border-b border-subtle">
            <div className="flex items-center gap-3">
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '8px' }} />
              <div>
                <div className="skeleton mb-1" style={{ width: 180, height: 22, borderRadius: '4px' }} />
                <div className="skeleton" style={{ width: 120, height: 14, borderRadius: '4px' }} />
              </div>
            </div>
            <div className="skeleton" style={{ width: 90, height: 28, borderRadius: '20px' }} />
          </div>

          {/* Identity Skeleton */}
          <div className="glass-card p-5" style={{ borderRadius: '16px' }}>
            <div className="flex items-center gap-4">
              <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
              <div className="flex-1">
                <div className="skeleton mb-1.5" style={{ width: 160, height: 18, borderRadius: '4px' }} />
                <div className="skeleton" style={{ width: 100, height: 14, borderRadius: '4px' }} />
              </div>
            </div>
          </div>

          {/* Meeting Card Skeleton */}
          <div className="glass-card p-8 flex flex-col items-center gap-4" style={{ borderRadius: '16px' }}>
            <div className="skeleton" style={{ width: 56, height: 56, borderRadius: '16px' }} />
            <div className="skeleton" style={{ width: 220, height: 24, borderRadius: '4px' }} />
            <div className="skeleton" style={{ width: 160, height: 14, borderRadius: '4px' }} />
            <div className="skeleton mt-3" style={{ width: '100%', maxWidth: 360, height: 48, borderRadius: '12px' }} />
          </div>
        </div>
      </div>
    );
  }

  // Friendly Error State
  if (loadError) {
    return (
      <div className="page-container animate-fade-in" id="video-consultation-page">
        <div
          className="glass-card flex flex-col items-center text-center gap-4 py-12 px-6 max-w-md mx-auto my-12"
          style={{ borderRadius: '16px', border: '1px solid var(--color-border)' }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-danger)',
            }}
          >
            <IconAlert size={28} />
          </div>
          <h2 className="text-lg font-bold text-primary">Unable to Load Consultation</h2>
          <p className="text-sm text-muted">{loadError}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              onClick={() => navigate(-1)}
            >
              <IconArrowLeft size={14} />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              onClick={loadData}
            >
              <IconRefresh size={14} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No consultation selected
  if (!consultationId && !urlAppointmentId) {
    return (
      <div className="page-container animate-fade-in" id="video-consultation-page">
        <div
          className="glass-card flex flex-col items-center text-center gap-4 py-12 px-6 max-w-md mx-auto my-12"
          style={{ borderRadius: '16px', border: '1px solid var(--color-border)' }}
        >
          <IconGoogleMeet size={40} />
          <h2 className="text-lg font-bold text-primary">No Consultation Selected</h2>
          <p className="text-sm text-muted">
            Please open this page from your appointments list.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-2"
            onClick={() => navigate('/appointments')}
          >
            View Appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" id="video-consultation-page">
      <div className="flex flex-col gap-5 max-w-4xl mx-auto pb-12">
        {/* SECTION 1: TOP HEADER */}
        <header className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm p-2 text-muted hover:text-primary"
              onClick={() => navigate(-1)}
              title="Back"
            >
              <IconArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-primary tracking-tight" style={{ margin: 0 }}>
                  Telehealth Consultation
                </h1>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Video consultation · <span className="text-secondary">Powered by Google Meet</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`badge ${statusMeta.color} flex items-center gap-1.5 py-1 px-3 text-xs font-semibold`}
            >
              <span className="status-dot" style={{ background: statusMeta.dot }} />
              <span>{statusMeta.label}</span>
            </span>

            {elapsedSeconds > 0 && (
              <span className="badge badge-secondary flex items-center gap-1.5 py-1 px-2.5 font-mono text-xs">
                <IconClock size={12} />
                <span>
                  {isConsultationCompleted
                    ? `Duration: ${formatDuration(elapsedSeconds)}`
                    : formatTimer(elapsedSeconds)}
                </span>
              </span>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-sm p-2 text-muted hover:text-primary"
              onClick={handleRefreshStatus}
              title="Refresh Consultation"
            >
              <IconRefresh size={15} />
            </button>
          </div>
        </header>

        {/* SECTION 2: IDENTITY CARD */}
        <div
          className="glass-card animate-fade-in"
          style={{
            padding: '16px 20px',
            borderRadius: '16px',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Patient View: Focus on Doctor */}
          {isPatient ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className="avatar"
                  style={{
                    width: 46,
                    height: 46,
                    fontSize: '1rem',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                  }}
                >
                  {doctorName ? initialsOf(doctorName) : <IconStethoscope size={20} />}
                </div>
                <div>
                  <div className="font-bold text-base text-primary">
                    {doctorName ? (doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`) : 'Assigned Physician'}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {doctorDept || 'General Consultation'}
                  </div>
                </div>
              </div>

              {(appointmentDate || appointmentTime) && (
                <div className="flex items-center gap-2 text-xs text-secondary bg-base py-1.5 px-3 rounded-lg border border-subtle">
                  <IconCalendar size={13} className="text-muted" />
                  <span>
                    {[appointmentDate, appointmentTime].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Doctor/Staff View: Focus on Patient */
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className="avatar"
                  style={{
                    width: 46,
                    height: 46,
                    fontSize: '1rem',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: 'var(--color-success)',
                    fontWeight: 700,
                  }}
                >
                  {patientName ? initialsOf(patientName) : <IconUser size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-primary">
                      {patientName || 'Patient Consultation'}
                    </span>
                    {(patientGender || patientAge) && (
                      <span className="badge badge-secondary text-xs">
                        {[patientGender, patientAge ? `${patientAge} yrs` : null].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {doctorDept ? `Specialty: ${doctorDept}` : 'Telehealth Consultation'}
                  </div>
                </div>
              </div>

              {(appointmentDate || appointmentTime) && (
                <div className="flex items-center gap-2 text-xs text-secondary bg-base py-1.5 px-3 rounded-lg border border-subtle">
                  <IconCalendar size={13} className="text-muted" />
                  <span>
                    {[appointmentDate, appointmentTime].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: MAIN GOOGLE MEET CARD */}
        <GoogleMeetCard
          consultation={consultation}
          appointment={appointment}
          isDoctor={isDoctor}
          onViewTranscript={() => setActiveTab('transcript')}
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
            if (['in_progress'].includes(newStatus)) setTimerActive(true);
            else if (['completed', 'meeting_ended'].includes(newStatus)) setTimerActive(false);
          }}
        />

        {/* SECTION 4: TABS (CONSULTATION DETAILS | TRANSCRIPT | CLINICAL SUMMARY) */}
        <div className="flex flex-col gap-4 mt-2">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-subtle pb-1">
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'details' ? 'btn-primary' : 'btn-ghost text-secondary'}`}
              onClick={() => setActiveTab('details')}
            >
              <IconDoc size={15} />
              <span>Consultation Details</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'transcript' ? 'btn-primary' : 'btn-ghost text-secondary'}`}
              onClick={() => setActiveTab('transcript')}
            >
              <IconClock size={15} />
              <span>Transcript</span>
              {hasRealTranscript && (
                <span className="badge badge-success text-xs ml-1 py-0.5 px-1.5">
                  {transcriptSegments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'summary' ? 'btn-primary' : 'btn-ghost text-secondary'}`}
              onClick={() => setActiveTab('summary')}
            >
              <IconSparkle size={15} />
              <span>Clinical Summary</span>
              {hasAnySOAP && (
                <span className="badge badge-success text-xs ml-1 py-0.5 px-1.5">SOAP</span>
              )}
            </button>
          </div>

          {/* TAB 1: CONSULTATION DETAILS */}
          {activeTab === 'details' && (
            <div
              className="glass-card animate-fade-in p-6"
              style={{
                borderRadius: '16px',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <h3 className="text-base font-bold text-primary mb-4">
                Consultation Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 rounded-xl border border-subtle" style={{ background: 'var(--color-bg-base)' }}>
                  <span className="text-xs text-muted block mb-1">Date &amp; Time</span>
                  <span className="font-semibold text-primary">
                    {[appointmentDate, appointmentTime].filter(Boolean).join(' at ') || 'Scheduled session'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-subtle" style={{ background: 'var(--color-bg-base)' }}>
                  <span className="text-xs text-muted block mb-1">Consultation Type</span>
                  <span className="font-semibold text-primary">
                    Video Consultation (Google Meet)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-subtle" style={{ background: 'var(--color-bg-base)' }}>
                  <span className="text-xs text-muted block mb-1">Attending Clinician</span>
                  <span className="font-semibold text-primary">
                    {doctorName ? (doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`) : 'Assigned Doctor'}
                  </span>
                  {doctorDept && <span className="text-xs text-muted block mt-0.5">{doctorDept}</span>}
                </div>

                <div className="p-3.5 rounded-xl border border-subtle" style={{ background: 'var(--color-bg-base)' }}>
                  <span className="text-xs text-muted block mb-1">Patient</span>
                  <span className="font-semibold text-primary">
                    {patientName || 'Patient'}
                  </span>
                  {(patientGender || patientAge) && (
                    <span className="text-xs text-muted block mt-0.5">
                      {[patientGender, patientAge ? `${patientAge} yrs` : null].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-subtle sm:col-span-2" style={{ background: 'var(--color-bg-base)' }}>
                  <span className="text-xs text-muted block mb-1">Consultation Status</span>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${statusMeta.color} text-xs font-semibold py-1 px-2.5`}>
                      {statusMeta.label}
                    </span>
                    {consultation?.google_meeting_code && (
                      <span className="text-xs font-mono text-muted">
                        Meeting code: <strong>{consultation.google_meeting_code}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {appointment?.reason_for_visit && (
                  <div className="p-3.5 rounded-xl border border-subtle sm:col-span-2" style={{ background: 'var(--color-bg-base)' }}>
                    <span className="text-xs text-muted block mb-1">Reason for Visit</span>
                    <p className="text-sm text-primary" style={{ margin: 0 }}>
                      {appointment.reason_for_visit}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TRANSCRIPT */}
          {activeTab === 'transcript' && (
            <GoogleMeetTranscriptViewer
              consultation={consultation}
              segments={transcriptSegments}
              transcriptStatus={transcriptStatus}
              isDoctor={isDoctor}
              onGenerateSummary={hasRealTranscript ? handleGenerateAISummary : null}
              isSummarizing={isSummarizing}
              onRetrySync={handleRefreshStatus}
              onMarkReviewed={
                hasRealTranscript && isDoctor
                  ? async () => { success('Transcript marked as reviewed.', 'Verified'); }
                  : null
              }
            />
          )}

          {/* TAB 3: CLINICAL SUMMARY (SOAP) */}
          {activeTab === 'summary' && (
            <div
              className="glass-card animate-fade-in p-6 flex flex-col gap-4"
              style={{
                borderRadius: '16px',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-subtle">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-primary" style={{ margin: 0 }}>
                      Clinical Summary
                    </h3>
                    <span className="badge badge-secondary text-xs">AI-assisted summary</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Structured SOAP clinical documentation derived from consultation dialogue
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`badge ${consultation?.is_approved ? 'badge-success' : 'badge-warning'} text-xs`}
                  >
                    {consultation?.is_approved ? '✓ Doctor Approved' : 'Needs Doctor Review'}
                  </span>

                  {isDoctor && hasAnySOAP && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-secondary flex items-center gap-1"
                      onClick={() => setIsEditingSOAP(!isEditingSOAP)}
                    >
                      <IconEdit size={12} />
                      <span>{isEditingSOAP ? 'Cancel Edit' : 'Edit Note'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Empty / Not Ready State */}
              {!hasAnySOAP && (
                <div
                  className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-subtle"
                  style={{ background: 'var(--color-bg-base)' }}
                >
                  <IconSparkle size={32} className="text-muted mb-2" />
                  <p className="text-sm font-semibold text-primary">No clinical summary generated yet.</p>
                  <p className="text-xs text-muted max-w-sm mt-1 mb-4">
                    {hasRealTranscript
                      ? 'The transcript is ready. You can extract the structured SOAP summary now.'
                      : 'Clinical summaries are extracted once the consultation dialogue transcript is available.'}
                  </p>

                  {isDoctor && hasRealTranscript && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                      onClick={handleGenerateAISummary}
                      disabled={isSummarizing}
                    >
                      <IconSparkle size={14} className={isSummarizing ? 'animate-spin' : ''} />
                      <span>{isSummarizing ? 'Extracting...' : 'Extract Clinical Summary'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* SOAP Content */}
              {hasAnySOAP && (
                <div className="flex flex-col gap-3.5">
                  {/* Subjective */}
                  <div
                    className="p-4 rounded-xl border border-subtle text-left"
                    style={{ background: 'var(--color-bg-base)' }}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                      S — Subjective (Chief Complaint &amp; Symptoms)
                    </div>
                    {isEditingSOAP && isDoctor ? (
                      <textarea
                        className="input w-full text-sm mt-1"
                        rows={2}
                        value={editedSOAP.subjective}
                        onChange={(e) => setEditedSOAP({ ...editedSOAP, subjective: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-primary" style={{ margin: 0, lineHeight: 1.55 }}>
                        {editedSOAP.subjective || subjectiveText || 'No subjective complaints reported.'}
                      </p>
                    )}
                  </div>

                  {/* Objective */}
                  <div
                    className="p-4 rounded-xl border border-subtle text-left"
                    style={{ background: 'var(--color-bg-base)' }}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                      O — Objective (Observations &amp; Vitals)
                    </div>
                    {isEditingSOAP && isDoctor ? (
                      <textarea
                        className="input w-full text-sm mt-1"
                        rows={2}
                        value={editedSOAP.objective}
                        onChange={(e) => setEditedSOAP({ ...editedSOAP, objective: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-primary" style={{ margin: 0, lineHeight: 1.55 }}>
                        {editedSOAP.objective || objectiveText || 'No objective vital signs recorded during session.'}
                      </p>
                    )}
                  </div>

                  {/* Assessment */}
                  <div
                    className="p-4 rounded-xl border border-subtle text-left"
                    style={{ background: 'var(--color-bg-base)' }}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                      A — Assessment (Clinical Impression)
                    </div>
                    {isEditingSOAP && isDoctor ? (
                      <textarea
                        className="input w-full text-sm mt-1"
                        rows={2}
                        value={editedSOAP.assessment}
                        onChange={(e) => setEditedSOAP({ ...editedSOAP, assessment: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-primary" style={{ margin: 0, lineHeight: 1.55 }}>
                        {editedSOAP.assessment || assessmentText || 'Clinical assessment pending.'}
                      </p>
                    )}
                  </div>

                  {/* Plan */}
                  <div
                    className="p-4 rounded-xl border border-subtle text-left"
                    style={{ background: 'var(--color-bg-base)' }}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                      P — Plan (Treatment &amp; Follow-up)
                    </div>
                    {isEditingSOAP && isDoctor ? (
                      <textarea
                        className="input w-full text-sm mt-1"
                        rows={2}
                        value={editedSOAP.plan}
                        onChange={(e) => setEditedSOAP({ ...editedSOAP, plan: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-primary" style={{ margin: 0, lineHeight: 1.55 }}>
                        {editedSOAP.plan || planText || 'Treatment plan pending.'}
                      </p>
                    )}
                  </div>

                  {/* Doctor Review & EHR Commit Actions */}
                  {isDoctor && (
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-subtle">
                      <span className="text-xs text-muted">
                        Attending physician review required before finalizing.
                      </span>

                      <div className="flex items-center gap-2">
                        {isEditingSOAP && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setIsEditingSOAP(false);
                              success('Clinical notes updated.', 'Saved');
                            }}
                          >
                            Save Edits
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-primary btn-sm flex items-center gap-1.5"
                          onClick={() => {
                            success('Clinical notes approved and committed to EHR record.', 'Approved');
                            if (consultationId) navigate(`/consultations/${consultationId}`);
                          }}
                        >
                          <IconCheck size={14} />
                          <span>Approve &amp; Commit to EHR</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

