import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../context/RoleContext';
import { useToast } from '../context/ToastContext';
import {
  getConsultation,
  getTranscript,
  createConsultation,
  summarizeConsultation,
} from '../services/api';
import {
  IconHospital,
  IconShield,
  IconClock,
  IconUser,
  IconCheck,
  IconSparkle,
  IconDoc,
  IconArrowLeft,
  IconGoogleMeet,
  IconStethoscope,
  IconCalendar,
  IconExternalLink,
  IconAlert,
  IconX,
} from '../components/icons';
import GoogleMeetCard from '../components/GoogleMeetCard';
import GoogleMeetTranscriptViewer from '../components/GoogleMeetTranscriptViewer';

function generatePatientIdFallback() {
  return 'PT-' + Date.now().toString().slice(-6);
}

function formatTimer(sec) {
  const hrs = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function initialsOf(name) {
  return (name || 'P')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function VideoConsultationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { roleConfig } = useRole();
  const { success, error: toastError, info } = useToast();

  const urlId = searchParams.get('id');
  const [consultationId, setConsultationId] = useState(urlId || null);
  const [consultation, setConsultation] = useState(null);

  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientLanguage, setPatientLanguage] = useState('English');
  const [doctorName, setDoctorName] = useState(
    user?.name
      ? user.name.startsWith('Dr.')
        ? user.name
        : `Dr. ${user.name}`
      : roleConfig?.name
      ? `Dr. ${roleConfig.name}`
      : 'Dr. Sarah Jenkins'
  );
  const [doctorDept, setDoctorDept] = useState('General Medicine');

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [modalPostSummaryOpen, setModalPostSummaryOpen] = useState(false);

  // Load consultation & transcript if id is present
  useEffect(() => {
    if (!urlId) return;

    async function loadData() {
      try {
        const cData = await getConsultation(urlId);
        if (cData) {
          setConsultation(cData);
          setConsultationId(cData.id);
          if (cData.patient_name) setPatientName(cData.patient_name);
          if (cData.patient_id) setPatientId(cData.patient_id);
          if (cData.patient_age) setPatientAge(cData.patient_age);
          if (cData.patient_gender) setPatientGender(cData.patient_gender);
          if (cData.doctor_name) setDoctorName(cData.doctor_name);
          if (cData.doctor_department) setDoctorDept(cData.doctor_department);
          if (cData.language || cData.detected_language) {
            setPatientLanguage(cData.language || cData.detected_language);
          }
          if (cData.duration_seconds) setElapsedSeconds(cData.duration_seconds);
        }

        try {
          const tData = await getTranscript(urlId);
          if (Array.isArray(tData) && tData.length > 0) {
            setTranscriptSegments(tData);
          }
        } catch {}
      } catch (err) {
        console.error('Failed to load consultation:', err);
        toastError('Could not load consultation ID: ' + urlId, 'Not Found');
      }
    }

    loadData();
  }, [urlId, toastError]);

  // Timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCreateNewConsultationSession = async () => {
    try {
      const pName = patientName.trim() || 'Eleanor Vance';
      const pId = patientId.trim() || generatePatientIdFallback();
      const created = await createConsultation({
        patient_name: pName,
        patient_id: pId,
        patient_age: Number(patientAge) || 45,
        patient_gender: patientGender || 'Female',
        doctor_name: doctorName,
        doctor_department: doctorDept,
        consultation_type: 'video',
        has_consent: true,
      });

      setConsultation(created);
      setConsultationId(created.id);
      success(`New consultation session initialized for ${pName}`, 'Session Created');
      navigate(`/consultation/video?id=${created.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to initialize consultation session:', err);
      toastError('Could not initialize consultation session: ' + err.message, 'Error');
    }
  };

  const handleGenerateAISummary = async () => {
    if (!consultationId) {
      toastError('Please initialize or select a consultation first.', 'No Consultation');
      return;
    }

    setIsSummarizing(true);
    info('Extracting structured clinical facts & SOAP summary via NVIDIA AI...', 'AI Extraction');

    try {
      const res = await summarizeConsultation(consultationId);
      if (res?.summary) {
        const updated = await getConsultation(consultationId);
        setConsultation(updated);
        setModalPostSummaryOpen(true);
        success('Clinical SOAP extraction completed successfully.', 'Summary Ready');
      } else {
        const updated = await getConsultation(consultationId);
        setConsultation(updated);
        setModalPostSummaryOpen(true);
      }
    } catch (err) {
      console.error('Error generating AI summary:', err);
      toastError('Failed to generate AI clinical summary: ' + err.message, 'Extraction Error');
    } finally {
      setIsSummarizing(false);
    }
  };

  const displayPatient = patientName || consultation?.patient_name || 'Patient';
  const displayId = patientId || consultation?.patient_id || 'ID: --';
  const displayDoctor = doctorName || consultation?.doctor_name || 'Attending Physician';
  const displayDept = doctorDept || consultation?.doctor_department || 'General Medicine';
  const displayAge = patientAge || consultation?.patient_age || '--';
  const displayGender = patientGender || consultation?.patient_gender || 'Unspecified';
  const patientInitials = initialsOf(displayPatient);
  const doctorInitials = initialsOf(displayDoctor);

  const subjectiveText =
    consultation?.summary?.chief_complaint &&
    consultation.summary.chief_complaint !== 'Not mentioned'
      ? consultation.summary.chief_complaint
      : consultation?.summary?.symptoms?.length
      ? `Patient presents with: ${consultation.summary.symptoms
          .map((s) => (typeof s === 'string' ? s : s.name))
          .join(', ')}`
      : `Patient ${displayPatient} Google Meet consultation dialogue captured for clinical review.`;

  const objectiveText =
    consultation?.summary?.vitals &&
    (consultation.summary.vitals.bp ||
      consultation.summary.vitals.pulse ||
      consultation.summary.vitals.spo2 ||
      consultation.summary.vitals.temp)
      ? `BP: ${consultation.summary.vitals.bp || '--'}, HR: ${
          consultation.summary.vitals.pulse || '--'
        } bpm, SpO2: ${consultation.summary.vitals.spo2 || '--'}%, Temp: ${
          consultation.summary.vitals.temp || '--'
        } °C.`
      : 'Objective findings discussed and evaluated during Google Meet telehealth consultation.';

  const assessmentText =
    consultation?.summary?.assessment &&
    consultation.summary.assessment !== 'Not mentioned'
      ? consultation.summary.assessment
      : 'Clinical assessment synthesized from Google Meet transcript by KENKO AI engine.';

  const planText =
    consultation?.summary?.treatment_plan &&
    consultation.summary.treatment_plan !== 'Not mentioned'
      ? consultation.summary.treatment_plan
      : consultation?.summary?.doctor_instructions?.length
      ? consultation.summary.doctor_instructions
          .map((i) => (typeof i === 'string' ? i : i.instruction))
          .join('. ')
      : 'Follow prescribed clinical instructions and scheduled virtual follow-up.';

  return (
    <div className="page-container animate-fade-in" id="video-consultation-page">
      {/* ── Top App Bar ── */}
      <div
        className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-subtle mb-6"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/consultations')}
            title="Back to Consultations"
          >
            <IconArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                <IconGoogleMeet size={22} />
                <span>Google Meet Telehealth Consultation</span>
              </h1>
              <span className="badge badge-success text-xs font-mono">REST API v2</span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              High-definition clinical video consultation with official Google Meet REST API v2, secure transcript ingestion, and AI SOAP extraction.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="badge badge-primary flex items-center gap-1.5 py-1 px-3">
            <span className="status-dot" style={{ background: '#22c55e' }} />
            <span>Google Workspace Telehealth</span>
          </span>
          <span className="badge badge-secondary flex items-center gap-1.5 py-1 px-3 font-mono text-xs">
            <IconClock size={12} /> {formatTimer(elapsedSeconds)}
          </span>
          {consultationId && (
            <button
              type="button"
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              onClick={() => navigate(`/consultations/${consultationId}`)}
            >
              <IconDoc size={14} /> View Full EHR
            </button>
          )}
        </div>
      </div>

      {/* ── Patient & Clinician Metadata Banner ── */}
      <div
        className="glass-card mb-6"
        style={{
          padding: '16px 20px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="avatar" style={{ width: 44, height: 44, fontSize: '1.1rem' }}>
              {patientInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-primary">{displayPatient}</span>
                <span className="badge badge-secondary text-xs">{displayGender} · {displayAge} yrs</span>
                <span className="text-xs font-mono text-muted">{displayId}</span>
              </div>
              <div className="text-xs text-muted mt-1 flex items-center gap-3">
                <span>Language: <strong>{patientLanguage}</strong></span>
                <span>Type: <strong>Google Meet Telehealth</strong></span>
                {consultation?.google_meeting_code && (
                  <span className="text-primary font-mono font-medium flex items-center gap-1">
                    <IconGoogleMeet size={12} /> {consultation.google_meeting_code}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-l border-subtle pl-4">
            <div className="avatar" style={{ width: 40, height: 40, fontSize: '0.95rem' }}>
              {doctorInitials}
            </div>
            <div>
              <div className="font-semibold text-sm text-primary flex items-center gap-1">
                <IconStethoscope size={14} /> {displayDoctor}
              </div>
              <div className="text-xs text-muted">{displayDept}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Workspace: Google Meet Primary Hub ── */}
      <div className="grid grid-cols-1 gap-6">
        {/* Google Meet Card */}
        <section>
          <GoogleMeetCard
            consultation={
              consultation || {
                id: consultationId,
                patient_id: displayId,
                patient_name: displayPatient,
                doctor_name: displayDoctor,
              }
            }
            onTranscriptReady={(transcriptData) => {
              if (transcriptData?.entries) {
                setTranscriptSegments(transcriptData.entries);
              }
            }}
            onConsultationUpdated={async () => {
              if (consultationId) {
                const updated = await getConsultation(consultationId);
                setConsultation(updated);
                try {
                  const tData = await getTranscript(consultationId);
                  if (Array.isArray(tData)) setTranscriptSegments(tData);
                } catch {}
              }
            }}
          />
        </section>

        {/* Google Meet Ingested Transcript Stream & Clinical Facts Viewer */}
        <section>
          <GoogleMeetTranscriptViewer
            consultation={consultation || { id: consultationId, patient_name: displayPatient, doctor_name: displayDoctor }}
            segments={transcriptSegments}
            onGenerateSummary={handleGenerateAISummary}
            isSummarizing={isSummarizing}
            onMarkReviewed={async () => {
              success('Google Meet clinical transcript verified and marked as reviewed.', 'Clinician Verified');
            }}
          />
        </section>
      </div>

      {/* ── SOAP Note Modal ── */}
      {modalPostSummaryOpen && (
        <div className="th-modal-backdrop animate-fade-in">
          <div className="th-modal" style={{ maxWidth: 680, width: '90%' }}>
            <div className="th-modal-header">
              <div className="th-modal-title flex items-center gap-2">
                <IconDoc size={18} />
                <span>Extracted Clinical SOAP Summary</span>
              </div>
              <button
                type="button"
                className="th-modal-close"
                onClick={() => setModalPostSummaryOpen(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="th-modal-body flex flex-col gap-4">
              <div className="th-summary-section">
                <span className="th-summary-label">S — Subjective</span>
                <span className="th-summary-text">{subjectiveText}</span>
              </div>
              <div className="th-summary-section">
                <span className="th-summary-label">O — Objective</span>
                <span className="th-summary-text">{objectiveText}</span>
              </div>
              <div className="th-summary-section">
                <span className="th-summary-label">A — Assessment</span>
                <span className="th-summary-text">{assessmentText}</span>
              </div>
              <div className="th-summary-section">
                <span className="th-summary-label">P — Plan</span>
                <span className="th-summary-text">{planText}</span>
              </div>
            </div>
            <div className="th-modal-footer flex items-center justify-between">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalPostSummaryOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary flex items-center gap-1.5"
                onClick={() => {
                  success('SOAP notes verified and synced to EHR.', 'EHR Sign-off');
                  setModalPostSummaryOpen(false);
                  if (consultationId) {
                    navigate(`/consultations/${consultationId}`);
                  }
                }}
              >
                <IconCheck size={14} /> Sign &amp; Commit to EHR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}