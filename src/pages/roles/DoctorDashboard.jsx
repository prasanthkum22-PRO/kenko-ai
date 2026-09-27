import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoctorWorkspace } from '../../services/api';
import {
  listUserAppointmentsFirestore,
  listenToUserAppointmentsFirestore,
} from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import {
  IconPlus,
  IconRefresh,
  IconStethoscope,
  IconClock,
  IconCheck,
  IconVideo,
  IconMic,
  IconArrowRight,
  IconDoc,
  IconCalendar,
} from '../../components/icons';

function formatScheduledDate(rawDate) {
  if (!rawDate) return 'Scheduled';
  try {
    let dateObj = null;
    if (rawDate && typeof rawDate.toDate === 'function') {
      dateObj = rawDate.toDate();
    } else if (rawDate && typeof rawDate.seconds === 'number') {
      dateObj = new Date(rawDate.seconds * 1000);
    } else if (typeof rawDate === 'string' || typeof rawDate === 'number') {
      dateObj = new Date(rawDate);
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      return dateObj.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    return typeof rawDate === 'string' ? rawDate : 'Scheduled';
  } catch {
    return 'Scheduled';
  }
}

function normalizeAppointment(a) {
  if (!a || typeof a !== 'object') return null;
  let scheduledAtIso = '';
  if (a.scheduledStart?.toDate) {
    try { scheduledAtIso = a.scheduledStart.toDate().toISOString(); } catch {}
  } else if (typeof a.scheduledStart?.seconds === 'number') {
    try { scheduledAtIso = new Date(a.scheduledStart.seconds * 1000).toISOString(); } catch {}
  } else if (typeof a.scheduledStart === 'string') {
    scheduledAtIso = a.scheduledStart;
  } else if (typeof a.scheduled_at === 'string') {
    scheduledAtIso = a.scheduled_at;
  }

  return {
    id: String(a.id || Math.random()),
    patientId: String(a.patientId || a.patient_id || ''),
    patientName: typeof a.patientName === 'string' ? a.patientName : (typeof a.patient_name === 'string' ? a.patient_name : 'Patient'),
    patientAge: a.patientAge || a.patient_age || null,
    patientGender: typeof a.patientGender === 'string' ? a.patientGender : (typeof a.patient_gender === 'string' ? a.patient_gender : ''),
    doctorId: String(a.doctorId || a.doctor_id || ''),
    doctorName: typeof a.doctorName === 'string' ? a.doctorName : (typeof a.doctor_name === 'string' ? a.doctor_name : 'Dr. Specialist'),
    appointmentType: String(a.consultationType || a.appointment_type || 'video').toLowerCase(),
    scheduledAt: scheduledAtIso,
    reason: typeof a.reason === 'string' ? a.reason : 'General Consultation',
    status: String(a.status || 'SCHEDULED').toUpperCase(),
  };
}

function formatDuration(totalSeconds = 0) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

function ConsultationTypeBadge({ type }) {
  const isVideo = type === 'video';
  return (
    <span className={`badge ${isVideo ? 'badge-info' : 'badge-secondary'}`}>
      {isVideo ? <IconVideo size={13} /> : <IconMic size={13} />}
      {isVideo ? 'Video' : 'In-Person'}
    </span>
  );
}

function ApprovalBadge({ isApproved }) {
  return isApproved ? <span className="badge badge-success">Approved</span> : <span className="badge badge-warning">Needs Review</span>;
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribeAppointments = null;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getDoctorWorkspace().catch(() => null);
        if (active && data && typeof data === 'object') setWorkspace(data);

        // Load appointments directly from Firebase Firestore (Pure Firebase)
        try {
          const fsAppts = await listUserAppointmentsFirestore(user?.uid, 'doctor');
          if (active && Array.isArray(fsAppts)) {
            const normalizedFs = fsAppts
              .map(normalizeAppointment)
              .filter(Boolean)
              .sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));

            setAppointments(normalizedFs);
          }
        } catch (fsErr) {
          console.warn('Firestore fetch error in DoctorDashboard:', fsErr);
        }
      } catch (err) {
        console.error('Failed to load doctor workspace:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    // Setup realtime Firestore listener (Pure Firebase)
    try {
      unsubscribeAppointments = listenToUserAppointmentsFirestore(user?.uid, 'doctor', (liveList) => {
        if (!active) return;
        setIsRealtimeActive(true);
        if (Array.isArray(liveList)) {
          const normalized = liveList
            .map(normalizeAppointment)
            .filter(Boolean)
            .sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));

          setAppointments(normalized);
        }
      });
    } catch (e) {
      console.warn('Realtime listener error in DoctorDashboard:', e);
    }

    return () => {
      active = false;
      if (unsubscribeAppointments) unsubscribeAppointments();
    };
  }, [user?.uid]);

  const safeAppointments = Array.isArray(appointments) ? appointments : [];
  const metrics = (workspace && typeof workspace === 'object' && workspace.metrics) || {};
  const recent = (workspace && typeof workspace === 'object' && Array.isArray(workspace.recent_consultations))
    ? workspace.recent_consultations
    : [];
  const pending = recent.filter((c) => !c.is_approved).length;
  const activeAppointments = safeAppointments.filter(
    (a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED'
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6" id="doctor-dashboard-loading">
        <div className="skeleton skeleton-text" style={{ width: 260, height: 30 }} />
        <div className="kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="skeleton skeleton-card" style={{ height: 300 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="doctor-dashboard">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary">Physician Console</span>
            {isRealtimeActive && (
              <span className="badge badge-success flex items-center gap-1" style={{ fontSize: 11 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                Firebase Live
              </span>
            )}
          </div>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {user?.name || user?.displayName || 'Doctor'}'s Clinical Workspace
          </h1>
          <p className="page-subtitle">
            AI-assisted SOAP summaries, patient appointment queues, and care coordination.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/consultations/video')} id="doctor-new-consult-btn">
            <IconVideo /> Launch Telehealth
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/appointments?action=book')}>
            <IconPlus /> Book Appointment
          </button>
          <button className="btn btn-ghost" onClick={() => window.location.reload()} aria-label="Refresh dashboard">
            <IconRefresh />
          </button>
        </div>
      </div>

      {pending > 0 && (
        <div className="alert alert-warning" role="alert">
          <IconClock />
          <span>
            <strong>{pending} consultation{pending === 1 ? '' : 's'}</strong> awaiting your clinical review.
          </span>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/consultations')}>
            Review queue <IconArrowRight />
          </button>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconCalendar />
          </div>
          <span className="kpi-label">Active Appointments</span>
          <span className="kpi-value">{activeAppointments.length}</span>
          <span className="kpi-foot">Upcoming patient visits</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconStethoscope />
          </div>
          <span className="kpi-label">Total consultations</span>
          <span className="kpi-value">{metrics.total_consultations || 0}</span>
          <span className="kpi-foot">In-person &amp; telehealth</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconClock />
          </div>
          <span className="kpi-label">Pending approval</span>
          <span className="kpi-value">{metrics.pending_approval ?? pending}</span>
          <span className="kpi-foot">Requires verification</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconCheck />
          </div>
          <span className="kpi-label">Finalized &amp; routed</span>
          <span className="kpi-value">{metrics.finalized_records || 0}</span>
          <span className="kpi-foot">Dispatched to portals</span>
        </div>
      </div>

      {/* ─── UPCOMING PATIENT APPOINTMENTS ─── */}
      <section className="section-card">
        <div className="section-card-header">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="section-card-title">Patient Appointments Schedule</h2>
              <span className="badge badge-primary">{activeAppointments.length}</span>
            </div>
            <p className="card-subtitle">Real-time scheduled patient visits synced with Firebase</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/appointments')}>
            View all appointments <IconArrowRight />
          </button>
        </div>
        <div style={{ padding: 18 }}>
          {safeAppointments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <IconCalendar />
              </div>
              <h3 className="empty-title">No appointments scheduled</h3>
              <p className="empty-description">
                Booked patient appointments will automatically appear here in real-time.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments?action=book')}>
                <IconPlus /> Schedule Appointment
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Visit Type</th>
                    <th>Scheduled Date &amp; Time</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {safeAppointments.slice(0, 6).map((a) => {
                    const isVideo = a.appointmentType === 'video';
                    const formattedDate = formatScheduledDate(a.scheduledAt);

                    return (
                      <tr key={a.id}>
                        <td>
                          <span className="font-semibold">{a.patientName}</span>
                          {a.patientAge && (
                            <span className="text-muted" style={{ display: 'block', fontSize: 12 }}>
                              {a.patientAge}y {a.patientGender || ''}
                            </span>
                          )}
                        </td>
                        <td>
                          <ConsultationTypeBadge type={a.appointmentType} />
                        </td>
                        <td className="text-secondary text-xs">
                          <span className="flex items-center gap-1">
                            <IconClock size={12} /> {formattedDate}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted line-clamp-1">{a.reason || 'General Consultation'}</span>
                        </td>
                        <td>
                          <span className={`badge ${a.status === 'COMPLETED' ? 'badge-success' : a.status === 'CANCELLED' ? 'badge-secondary' : 'badge-primary'}`}>
                            {a.status || 'SCHEDULED'}
                          </span>
                        </td>
                        <td className="text-right">
                          {isVideo ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate(`/consultations/video?appointmentId=${a.id}`)}
                            >
                              <IconVideo size={13} /> Launch Video
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => navigate(`/consultations/in-person?appointmentId=${a.id}`)}
                            >
                              <IconMic size={13} /> In-Person
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="section-card">
        <div className="section-card-header">
          <div>
            <h2 className="section-card-title">Recent consultations</h2>
            <p className="card-subtitle">Latest SOAP summaries awaiting or cleared for review</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/consultations')}>
            View all <IconArrowRight />
          </button>
        </div>
        <div style={{ padding: 18 }}>
          {recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <IconDoc />
              </div>
              <h3 className="empty-title">No consultations recorded</h3>
              <p className="empty-description">
                Start a telehealth video visit or an in-person ambient session to generate the first AI-assisted summary.
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/consultations/video')}>
                <IconPlus /> Start consultation
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="font-semibold">{c.patient_name || 'Patient'}</span>
                        <span className="text-muted font-mono" style={{ display: 'block', fontSize: 12 }}>
                          {c.patient_id || ''}
                        </span>
                      </td>
                      <td>
                        <ConsultationTypeBadge type={c.consultation_type} />
                      </td>
                      <td>
                        <ApprovalBadge isApproved={c.is_approved} />
                      </td>
                      <td className="text-secondary">{formatDuration(c.duration_seconds)}</td>
                      <td className="text-right">
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/consultations/${c.id}`)}>
                          Open review <IconArrowRight />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}