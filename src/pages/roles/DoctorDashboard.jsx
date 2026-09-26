import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoctorWorkspace, getAppointments } from '../../services/api';
import {
  listUserAppointmentsFirestore,
  listenToUserAppointmentsFirestore,
  updateAppointmentFirestore,
} from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import {
  IconPlus,
  IconRefresh,
  IconStethoscope,
  IconClock,
  IconCheck,
  IconUsers,
  IconVideo,
  IconMic,
  IconArrowRight,
  IconDoc,
  IconCalendar,
} from '../../components/icons';

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
        if (active && data) setWorkspace(data);

        // Load appointments from backend
        let apptList = data?.scheduled_appointments || [];
        if (apptList.length === 0) {
          try {
            const aptRes = await getAppointments();
            if (aptRes?.appointments) {
              apptList = aptRes.appointments.map((item) => {
                const a = item.appointment || item;
                return {
                  id: a.id,
                  patientId: a.patientId || a.patient_id,
                  patientName: item.patient?.displayName || a.patient_name || 'Patient',
                  patientAge: item.patient?.age || a.patient_age,
                  patientGender: item.patient?.gender || a.patient_gender,
                  doctorId: a.doctorId || a.doctor_id,
                  doctorName: item.doctor?.displayName || a.doctor_name || 'Dr. Specialist',
                  appointmentType: (a.consultationType || a.appointment_type || 'video').toLowerCase(),
                  scheduledAt: a.scheduledStart || a.scheduled_at,
                  reason: a.reason || 'General Consultation',
                  status: (a.status || 'SCHEDULED').toUpperCase(),
                };
              });
            }
          } catch (e) {
            console.warn('Backend getAppointments fallback in DoctorDashboard:', e);
          }
        }

        // Fetch from Firestore
        const fsAppts = await listUserAppointmentsFirestore(user?.uid, 'doctor');
        const normalizedFs = (fsAppts || []).map((a) => ({
          id: a.id,
          patientId: a.patientId || a.patient_id,
          patientName: a.patientName || a.patient_name || 'Patient',
          patientAge: a.patientAge || a.patient_age,
          patientGender: a.patientGender || a.patient_gender,
          doctorId: a.doctorId || a.doctor_id,
          doctorName: a.doctorName || a.doctor_name || 'Dr. Specialist',
          appointmentType: (a.consultationType || a.appointment_type || 'video').toLowerCase(),
          scheduledAt: a.scheduledStart?.toDate ? a.scheduledStart.toDate().toISOString() : (a.scheduledStart || a.scheduled_at),
          reason: a.reason || 'General Consultation',
          status: (a.status || 'SCHEDULED').toUpperCase(),
        }));

        const mergedMap = new Map();
        apptList.forEach((a) => mergedMap.set(a.id, a));
        normalizedFs.forEach((a) => {
          const existing = mergedMap.get(a.id) || {};
          mergedMap.set(a.id, { ...existing, ...a });
        });

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0)
        );

        if (active) setAppointments(merged);
      } catch (err) {
        console.error('Failed to load doctor workspace:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    // Setup realtime Firestore listener
    try {
      unsubscribeAppointments = listenToUserAppointmentsFirestore(user?.uid, 'doctor', (liveList) => {
        if (!active) return;
        setIsRealtimeActive(true);
        if (liveList && liveList.length > 0) {
          setAppointments((prev) => {
            const map = new Map();
            prev.forEach((p) => map.set(p.id, p));
            liveList.forEach((f) => {
              const existing = map.get(f.id) || {};
              map.set(f.id, {
                ...existing,
                id: f.id,
                patientId: f.patientId || f.patient_id || existing.patientId,
                patientName: f.patientName || f.patient_name || existing.patientName || 'Patient',
                patientAge: f.patientAge || f.patient_age || existing.patientAge,
                patientGender: f.patientGender || f.patient_gender || existing.patientGender,
                doctorId: f.doctorId || f.doctor_id || existing.doctorId,
                doctorName: f.doctorName || f.doctor_name || existing.doctorName || 'Dr. Specialist',
                appointmentType: (f.consultationType || f.appointment_type || existing.appointmentType || 'video').toLowerCase(),
                scheduledAt: f.scheduledStart?.toDate ? f.scheduledStart.toDate().toISOString() : (f.scheduledStart || f.scheduled_at || existing.scheduledAt),
                reason: f.reason || existing.reason || 'General Consultation',
                status: (f.status || existing.status || 'SCHEDULED').toUpperCase(),
              });
            });
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0)
            );
          });
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

  const metrics = workspace?.metrics || {};
  const recent = workspace?.recent_consultations || [];
  const pending = recent.filter((c) => !c.is_approved).length;
  const activeAppointments = appointments.filter(
    (a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED'
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
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
          {appointments.length === 0 ? (
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
                  {appointments.slice(0, 6).map((a) => {
                    const isVideo = a.appointmentType === 'video';
                    let formattedDate = 'Scheduled';
                    if (a.scheduledAt) {
                      try {
                        formattedDate = new Date(a.scheduledAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        });
                      } catch {
                        formattedDate = String(a.scheduledAt);
                      }
                    }

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
                        <span className="font-semibold">{c.patient_name}</span>
                        <span className="text-muted font-mono" style={{ display: 'block', fontSize: 12 }}>
                          {c.patient_id}
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