import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getConsultations, createConsultation } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  IconMic,
  IconVideo,
  IconSearch,
  IconX,
  IconArrowRight,
  IconCheck,
  IconSparkle,
} from '../components/icons';


export default function ConsultationsHubPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newType, setNewType] = useState('in_person');
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientAge, setPatientAge] = useState(38);
  const [patientGender, setPatientGender] = useState('Male');
  const [consentChecked, setConsentChecked] = useState(true);

  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadConsultations = async () => {
      setLoading(true);
      try {
        const data = await getConsultations();
        if (!active) return;
        setConsultations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load consultations:', err);
        if (active) {
          toastError('Could not load consultations. Using cached records.', 'Network Note');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadConsultations();
    return () => {
      active = false;
    };
  }, [toastError]);

  const openNewModal = (type) => {
    setNewType(type);
    setPatientName('');
    setPatientId('');
    setModalOpen(true);
  };

  const handleCreateNew = async (e) => {
    e.preventDefault();
    if (!patientName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const created = await createConsultation({
        patient_name: patientName.trim(),
        patient_id: patientId.trim() || `P-${Math.floor(1000 + Math.random() * 9000)}`,
        patient_age: Number(patientAge) || 30,
        patient_gender: patientGender,
        doctor_id: user?.doctorId || user?.id || null,
        doctor_name: user?.displayName || user?.full_name || 'Dr. Attending',
        consultation_type: newType,
        has_consent: consentChecked,
      });

      success(`Session initialized for ${patientName.trim()}`, 'Consultation Ready');
      setModalOpen(false);
      navigate(
        newType === 'video'
          ? `/consultations/video?id=${created.id}`
          : `/consultations/in-person?id=${created.id}`
      );
    } catch (err) {
      console.error('Failed to create consultation:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to initialize consultation session.';
      toastError(detail, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };


  const searchLower = (search || '').toLowerCase().trim();
  const filtered = consultations.filter((c) => {
    if (!searchLower) return true;
    const name = (c?.patient_name || '').toLowerCase();
    const pid = (c?.patient_id || '').toLowerCase();
    const st = (c?.status || '').toLowerCase();
    const doc = (c?.doctor_name || '').toLowerCase();
    const lang = (c?.detected_language || '').toLowerCase();
    return (
      name.includes(searchLower) ||
      pid.includes(searchLower) ||
      st.includes(searchLower) ||
      doc.includes(searchLower) ||
      lang.includes(searchLower)
    );
  });

  return (
    <div className="flex flex-col gap-6" id="consultations-page">
      <div className="page-header animate-fade-in">
        <div>
          <span className="badge badge-primary mb-2">Consultation Capture</span>
          <h1 className="page-title">
            <span className="text-gradient">Clinical</span> Consultations
          </h1>
          <p className="page-subtitle">
            Capture, transcribe, summarize and route audio consultations with privacy-first local AI.
          </p>
        </div>
        <div className="page-actions">
          <button id="start-inperson-btn" className="btn btn-primary" onClick={() => openNewModal('in_person')}>
            <IconMic size={16} /> In-Person Recording
          </button>
          <button id="start-video-btn" className="btn btn-secondary" onClick={() => openNewModal('video')}>
            <IconVideo size={16} /> Video Consultation
          </button>
        </div>
      </div>

      <div className="glass-card-flat animate-fade-in">
        <div className="flex items-center gap-2" style={{ padding: 'var(--space-3)' }}>
          <IconSearch size={16} className="text-muted flex-shrink-0" />
          <input
            id="consultations-search-input"
            type="text"
            className="input"
            placeholder="Search consultations by patient name, ID, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: 190 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <IconMic />
          </div>
          <h3 className="empty-title">
            {search ? 'No matching consultations found' : 'No Consultations Recorded Yet'}
          </h3>
          <p className="empty-description">
            {search
              ? `No consultation records matched "${search}". Try searching by patient ID, name, or status.`
              : 'Begin capturing patient-doctor consultations with multilingual ambient speech-to-text, or explore 1-Click Demo Mode.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <IconMic size={16} /> Start Consultation
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/demo')}>
              <IconSparkle size={16} /> Launch 1-Click Demo
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {filtered.map((c) => {
            const docName = c?.doctor_name
              ? c.doctor_name.startsWith('Dr.')
                ? c.doctor_name
                : `Dr. ${c.doctor_name}`
              : 'Dr. Attending';
            const statusKey = String(c?.status || 'recording').toLowerCase().replace(/\s+/g, '_');
            const statusLabel = String(c?.status || 'recording').replace(/_/g, ' ');
            const duration = c?.duration_seconds || 0;

            return (
              <div
                key={c.id}
                className="glass-card-interactive p-4 flex flex-col gap-3 animate-fade-in"
                onClick={() => navigate(`/consultations/${c.id}`)}
                id={`consultation-card-${c.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate">{c.patient_name || 'Patient'}</h3>
                    <p className="text-xs text-muted truncate">
                      ID: {c.patient_id || 'N/A'} • {docName}
                    </p>
                  </div>
                  <span
                    className={`badge whitespace-nowrap ${
                      c.google_meeting_uri ? 'badge-primary' : (c.consultation_type === 'video' ? 'badge-info' : 'badge-secondary')
                    }`}
                  >
                    {c.consultation_type === 'video' ? <IconVideo size={13} /> : <IconMic size={13} />}
                    {c.google_meeting_uri ? 'Google Meet' : (c.consultation_type === 'video' ? 'Video' : 'In-Person')}
                  </span>
                </div>

                {c.google_meeting_uri && (
                  <div
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded"
                    style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border-subtle)' }}
                  >
                    <span className="text-muted truncate max-w-[170px]">Meet: {c.google_meeting_code || 'Active Space'}</span>
                    <a
                      href={c.google_meeting_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Join Meet ↗
                    </a>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="kpi-label">Status</span>
                    <span className={`status-badge status-${statusKey}`}>{statusLabel}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="kpi-label">Duration</p>
                      <p className="text-sm font-semibold">
                        {Math.floor(duration / 60)}m {duration % 60}s
                      </p>
                    </div>
                    <div>
                      <p className="kpi-label">Segments</p>
                      <p className="text-sm font-semibold">{c?.transcript_count || 0} lines</p>
                    </div>
                    <div>
                      <p className="kpi-label">Date</p>
                      <p className="text-sm font-semibold">
                        {c?.created_at
                          ? new Date(c.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Recent'}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}
                >
                  <span className="text-xs text-primary font-semibold inline-flex items-center gap-1">
                    Open Workspace <IconArrowRight size={12} />
                  </span>
                  {c?.is_approved && (
                    <span className="badge badge-success">
                      <IconCheck size={12} /> Approved
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="modal animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="New consultation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                New {newType === 'video' ? 'Video' : 'In-Person'} Consultation
              </h2>
              <button type="button" className="modal-close" onClick={() => setModalOpen(false)} aria-label="Close">
                <IconX size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateNew}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Patient Full Name</label>
                  <input
                    type="text"
                    className="input"
                    required
                    placeholder="e.g. Aarav Sharma"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Patient ID</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. P-1002"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Age / Gender</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className="input"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        style={{ width: 76 }}
                      />
                      <select
                        className="input"
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="glass-card-flat p-3">
                  <label className="checkbox-label items-start">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      required
                      style={{ marginTop: 3 }}
                    />
                    <span className="text-xs text-secondary">
                      <strong>Patient Recording Consent:</strong> Patient has given informed consent for
                      consultation recording to generate clinical transcript and structured medical summaries.
                    </span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex items-center gap-1.5" disabled={isSubmitting}>
                  <IconMic size={14} />
                  <span>{isSubmitting ? 'Starting...' : 'Begin Consultation'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}