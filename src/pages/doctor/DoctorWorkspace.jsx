import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoctorWorkspace, getConsultations, getLabTasks, getAppointments } from '../../services/api';
import {
  listUserAppointmentsFirestore,
  listenToUserAppointmentsFirestore,
  updateAppointmentFirestore,
} from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  IconVideo,
  IconMic,
  IconRx,
  IconRefresh,
  IconStethoscope,
  IconClock,
  IconFlask,
  IconUsers,
  IconCheck,
  IconArrowRight,
  IconDoc,
  IconCalendar,
  IconPlus,
} from '../../components/icons';

export default function DoctorWorkspace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [workspace, setWorkspace] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [labTasks, setLabTasks] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [appointmentFilter, setAppointmentFilter] = useState('upcoming'); // 'upcoming' | 'all' | 'video' | 'in_person'
  const [loading, setLoading] = useState(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribeAppointments = null;

    const loadData = async () => {
      setLoading(true);
      try {
        const [wsData, cList, lList] = await Promise.all([
          getDoctorWorkspace().catch(() => null),
          getConsultations().catch(() => []),
          getLabTasks().catch(() => []),
        ]);

        if (!active) return;
        setWorkspace(wsData);
        setConsultations(cList || []);
        setLabTasks(lList || []);

        // Load appointments directly from Firebase Firestore (Pure Firebase)
        try {
          const fsAppts = await listUserAppointmentsFirestore(user?.uid, 'doctor');
          const normalizedFs = (fsAppts || []).map((a) => ({
            id: a.id,
            patientId: a.patientId || a.patient_id,
            patientName: a.patientName || a.patient_name || 'Patient',
            patientAge: a.patientAge || a.patient_age,
            patientGender: a.patientGender || a.patient_gender,
            doctorId: a.doctorId || a.doctor_id,
            doctorName: a.doctorName || a.doctor_name || 'Dr. Specialist',
            doctorSpecialization: a.doctorSpecialization || a.doctor_specialization || 'General Medicine',
            appointmentType: (a.consultationType || a.appointment_type || a.appointmentType || 'video').toLowerCase(),
            scheduledAt: a.scheduledStart?.toDate ? a.scheduledStart.toDate().toISOString() : (a.scheduledStart || a.scheduled_at),
            reason: a.reason || 'General Consultation',
            status: (a.status || 'SCHEDULED').toUpperCase(),
            meetStatus: a.meetStatus || a.meet_status || 'SCHEDULED',
            googleMeetingUri: a.googleMeetingUri || a.google_meeting_uri,
            googleMeetingCode: a.googleMeetingCode || a.google_meeting_code,
            googleSpaceName: a.googleSpaceName || a.google_space_name,
            consultationId: a.consultationId || a.consultation_id,
          })).sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));

          if (active) setAppointments(normalizedFs);
        } catch (fsErr) {
          console.warn('Firestore direct fetch error:', fsErr);
        }
      } catch (err) {
        console.error('Failed to load doctor workspace:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    // Setup Firestore realtime listener for doctor appointments (Pure Firebase)
    try {
      unsubscribeAppointments = listenToUserAppointmentsFirestore(user?.uid, 'doctor', (liveList) => {
        if (!active) return;
        setIsRealtimeActive(true);
        if (Array.isArray(liveList)) {
          const normalized = liveList.map((f) => ({
            id: f.id,
            patientId: f.patientId || f.patient_id,
            patientName: f.patientName || f.patient_name || 'Patient',
            patientAge: f.patientAge || f.patient_age,
            patientGender: f.patientGender || f.patient_gender,
            doctorId: f.doctorId || f.doctor_id,
            doctorName: f.doctorName || f.doctor_name || 'Dr. Specialist',
            doctorSpecialization: f.doctorSpecialization || f.doctor_specialization || 'General Medicine',
            appointmentType: (f.consultationType || f.appointment_type || f.appointmentType || 'video').toLowerCase(),
            scheduledAt: f.scheduledStart?.toDate ? f.scheduledStart.toDate().toISOString() : (f.scheduledStart || f.scheduled_at),
            reason: f.reason || 'General Consultation',
            status: (f.status || 'SCHEDULED').toUpperCase(),
            meetStatus: f.meetStatus || f.meet_status || 'SCHEDULED',
            googleMeetingUri: f.googleMeetingUri || f.google_meeting_uri,
            googleMeetingCode: f.googleMeetingCode || f.google_meeting_code,
            googleSpaceName: f.googleSpaceName || f.google_space_name,
            consultationId: f.consultationId || f.consultation_id,
          })).sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));

          setAppointments(normalized);
        }
      });
    } catch (listenerErr) {
      console.warn('Realtime appointments listener setup warning:', listenerErr);
    }

    return () => {
      active = false;
      if (unsubscribeAppointments) unsubscribeAppointments();
    };
  }, [user?.uid]);

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      await updateAppointmentFirestore(appointmentId, { status: newStatus });
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a))
      );
      success(`Appointment marked as ${newStatus}`, 'Status Updated');
    } catch (err) {
      toastError(err?.message || 'Failed to update appointment status.', 'Error');
    }
  };

  const handleAcceptAppointment = async (apt) => {
    try {
      const updated = await acceptAppointmentFirestore(apt.id);
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === apt.id
            ? {
                ...a,
                status: 'CONFIRMED',
                meetStatus: 'READY',
                googleMeetingUri: updated?.googleMeetingUri || a.googleMeetingUri,
                googleMeetingCode: updated?.googleMeetingCode || a.googleMeetingCode,
              }
            : a
        )
      );
      success(
        `Appointment for ${apt.patientName} accepted! Google Meet link generated and synced to patient.`,
        'Appointment Confirmed'
      );
    } catch (err) {
      toastError(err?.message || 'Failed to accept appointment.', 'Error');
    }
  };

  const handleDeclineAppointment = async (apt) => {
    if (!window.confirm(`Are you sure you want to decline the appointment request from ${apt.patientName}?`)) return;
    try {
      await declineAppointmentFirestore(apt.id, 'Declined by doctor');
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === apt.id ? { ...a, status: 'DECLINED', meetStatus: 'CANCELLED' } : a
        )
      );
      success(`Appointment request from ${apt.patientName} has been declined.`, 'Declined');
    } catch (err) {
      toastError(err?.message || 'Failed to decline appointment.', 'Error');
    }
  };

  const metrics = workspace?.metrics || {};
  const pendingVerification = consultations.filter((c) => !c.is_approved).length;
  const pendingLab = labTasks.filter((l) => l.status !== 'Reviewed' && l.status !== 'Completed').length;
  const pendingRequestsCount = appointments.filter(
    (a) => a.status === 'SCHEDULED' || a.status === 'REQUESTED' || a.status === 'PENDING'
  ).length;
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;

  const filteredAppointments = appointments.filter((apt) => {
    const st = apt.status?.toUpperCase() || 'SCHEDULED';
    if (appointmentFilter === 'requests') return st === 'SCHEDULED' || st === 'REQUESTED' || st === 'PENDING';
    if (appointmentFilter === 'confirmed') return st === 'CONFIRMED';
    if (appointmentFilter === 'upcoming') return st !== 'CANCELLED' && st !== 'DECLINED' && st !== 'COMPLETED';
    if (appointmentFilter === 'video') return apt.appointmentType === 'video';
    if (appointmentFilter === 'in_person') return apt.appointmentType === 'in_person';
    return true; // 'all'
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton skeleton-text" style={{ width: 300, height: 30 }} />
        <div className="kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="metrics-grid">
          <div className="skeleton skeleton-card" style={{ height: 320 }} />
          <div className="skeleton skeleton-card" style={{ height: 320 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="doctor-workspace">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary">Clinician Workspace</span>
            {isRealtimeActive && (
              <span className="badge badge-success flex items-center gap-1" style={{ fontSize: 11 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                Firebase Live
              </span>
            )}
          </div>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Welcome, {user?.name || user?.displayName || 'Dr. Aarav Patel'}
          </h1>
          <p className="page-subtitle">
            Accept incoming patient appointment requests, generate Google Meet links, and conduct AI-assisted consultations.
          </p>
        </div>

        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate('/consultations/video')}
            id="start-video-consult-btn"
          >
            <IconVideo size={16} /> Launch Telehealth Video
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/consultations/in-person')}
            id="start-ambient-record-btn"
          >
            <IconMic size={16} /> Ambient In-Person
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/appointments')}>
            <IconCalendar size={16} /> All Appointments
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <IconClock />
          </div>
          <span className="kpi-label">Pending Requests</span>
          <span className="kpi-value" style={{ color: '#f59e0b' }}>{pendingRequestsCount}</span>
          <span className="kpi-foot">Awaiting your approval</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <IconCalendar />
          </div>
          <span className="kpi-label">Confirmed Appointments</span>
          <span className="kpi-value" style={{ color: '#10b981' }}>{confirmedCount}</span>
          <span className="kpi-foot">Scheduled &amp; Google Meet ready</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconStethoscope />
          </div>
          <span className="kpi-label">Total Consultations</span>
          <span className="kpi-value">{metrics.total_consultations || consultations.length || 0}</span>
          <span className="kpi-foot">In-person &amp; video visits</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconFlask />
          </div>
          <span className="kpi-label">Pending lab results</span>
          <span className="kpi-value">{pendingLab}</span>
          <span className="kpi-foot">Specimens in pipeline</span>
        </div>
      </div>

      {/* ─── LIVE PATIENT APPOINTMENTS QUEUE ─── */}
      <section className="section-card flex flex-col" id="doctor-appointments-queue" style={{ borderRadius: '16px' }}>
        <div className="section-card-header flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="section-card-title">Patient Appointments Queue</h2>
              {pendingRequestsCount > 0 && (
                <span className="badge badge-warning font-bold" style={{ backgroundColor: '#f59e0b', color: '#fff' }}>
                  {pendingRequestsCount} New Requests
                </span>
              )}
              <span className="badge badge-primary">{filteredAppointments.length} Total</span>
            </div>
            <p className="card-subtitle">
              Accept patient requests to automatically generate Google Meet video links in real-time
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-slate-800/40 p-1 rounded-lg border border-slate-700/50 text-xs">
              <button
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  appointmentFilter === 'requests' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setAppointmentFilter('requests')}
              >
                Requests ({pendingRequestsCount})
              </button>
              <button
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  appointmentFilter === 'confirmed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setAppointmentFilter('confirmed')}
              >
                Confirmed ({confirmedCount})
              </button>
              <button
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  appointmentFilter === 'upcoming' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setAppointmentFilter('upcoming')}
              >
                All Upcoming
              </button>
              <button
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  appointmentFilter === 'video' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setAppointmentFilter('video')}
              >
                Video Telehealth
              </button>
              <button
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  appointmentFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setAppointmentFilter('all')}
              >
                All
              </button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/appointments')}>
              Manage <IconArrowRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ padding: 18, flex: 1 }}>
          {filteredAppointments.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-icon">
                <IconCalendar />
              </div>
              <h3 className="empty-title">No appointments in this view</h3>
              <p className="empty-description">
                When patients book an appointment, requests will appear here instantly for approval.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments?action=book')}>
                <IconPlus size={14} /> Book Test Appointment
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Visit Mode</th>
                    <th>Requested Date &amp; Time</th>
                    <th>Clinical Reason</th>
                    <th>Status</th>
                    <th>Google Meet Link</th>
                    <th className="text-right">Action / Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((apt) => {
                    const isVideo = apt.appointmentType === 'video';
                    const isPendingApproval =
                      apt.status === 'SCHEDULED' || apt.status === 'REQUESTED' || apt.status === 'PENDING';
                    const isConfirmed = apt.status === 'CONFIRMED';
                    const isCompleted = apt.status === 'COMPLETED';
                    const isDeclined = apt.status === 'DECLINED' || apt.status === 'CANCELLED';

                    let formattedDate = 'Scheduled';
                    if (apt.scheduledAt) {
                      try {
                        const d = new Date(apt.scheduledAt);
                        formattedDate = d.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        });
                      } catch {
                        formattedDate = String(apt.scheduledAt);
                      }
                    }

                    return (
                      <tr key={apt.id}>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{apt.patientName}</span>
                            <span className="text-muted text-xs">
                              {apt.patientAge ? `${apt.patientAge} yrs` : ''} {apt.patientGender || ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${isVideo ? 'badge-info' : 'badge-secondary'}`}>
                            {isVideo ? <IconVideo size={13} /> : <IconMic size={13} />}
                            {isVideo ? 'Video Telehealth' : 'In-Person Clinic'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <IconClock size={13} className="text-muted" />
                            <span>{formattedDate}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-slate-300 line-clamp-1 max-w-xs" title={apt.reason}>
                            {apt.reason || 'General Consultation'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              isConfirmed
                                ? 'badge-success'
                                : isPendingApproval
                                ? 'badge-warning'
                                : isCompleted
                                ? 'badge-primary'
                                : 'badge-secondary'
                            }`}
                            style={{ fontWeight: 700 }}
                          >
                            {isPendingApproval ? 'PENDING APPROVAL' : apt.status}
                          </span>
                        </td>
                        <td>
                          {isVideo && apt.googleMeetingUri ? (
                            <a
                              href={apt.googleMeetingUri}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 underline"
                              title={apt.googleMeetingUri}
                            >
                              <IconVideo size={12} /> Join Meet
                            </a>
                          ) : isVideo && isPendingApproval ? (
                            <span className="text-[11px] text-muted italic">Generated on acceptance</span>
                          ) : (
                            <span className="text-[11px] text-muted">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Doctor Approval Action Buttons */}
                            {isPendingApproval ? (
                              <>
                                <button
                                  className="btn btn-sm btn-primary flex items-center gap-1"
                                  style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff' }}
                                  onClick={() => handleAcceptAppointment(apt)}
                                  title="Accept appointment and create Google Meet link"
                                >
                                  <IconCheck size={13} /> Accept
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost text-danger flex items-center gap-1"
                                  style={{ color: '#ef4444' }}
                                  onClick={() => handleDeclineAppointment(apt)}
                                  title="Decline appointment request"
                                >
                                  ✕ Decline
                                </button>
                              </>
                            ) : isConfirmed ? (
                              <>
                                {isVideo ? (
                                  <>
                                    <button
                                      className="btn btn-primary btn-sm flex items-center gap-1"
                                      onClick={() => navigate(`/consultations/video?appointmentId=${apt.id}`)}
                                      title="Open Telehealth Video Consultation"
                                    >
                                      <IconVideo size={13} /> Join Consultation
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn btn-secondary btn-sm flex items-center gap-1"
                                    onClick={() => navigate(`/consultations/in-person?appointmentId=${apt.id}`)}
                                    title="Start In-Person Ambient Recording"
                                  >
                                    <IconMic size={13} /> Ambient Visit
                                  </button>
                                )}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                                  title="Mark as Completed"
                                >
                                  <IconCheck size={14} className="text-emerald-400" />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-muted">
                                {isCompleted ? 'Completed' : isDeclined ? 'Declined' : apt.status}
                              </span>
                            )}
                          </div>
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

      <div className="metrics-grid">
        {/* 1. Consultation & AI SOAP Queue */}
        <section className="section-card flex flex-col">
          <div className="section-card-header">
            <div>
              <h2 className="section-card-title">Consultation &amp; AI SOAP queue</h2>
              <p className="card-subtitle">Review, verify and finalize recommendation summaries</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/consultations')}>
              All consultations <IconArrowRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-3" style={{ padding: 18, flex: 1 }}>
            {consultations.length === 0 ? (
              <div className="empty-state" style={{ flex: 1 }}>
                <div className="empty-icon">
                  <IconDoc />
                </div>
                <h3 className="empty-title">No consultations to review</h3>
                <p className="empty-description">
                  Start a telehealth video visit or ambient in-person session to generate a SOAP summary.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {consultations.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <span className="font-semibold">{c.patient_name}</span>
                          <span className="text-muted" style={{ fontSize: 12 }}> ({c.patient_age}y)</span>
                        </td>
                        <td>
                          <span className={`badge ${c.consultation_type === 'video' ? 'badge-info' : 'badge-secondary'}`}>
                            {c.consultation_type === 'video' ? <IconVideo size={13} /> : <IconMic size={13} />}
                            {c.consultation_type === 'video' ? 'Video' : 'In-Person'}
                          </span>
                        </td>
                        <td>
                          {c.is_approved ? (
                            <span className="badge badge-success">
                              <IconCheck size={13} /> Approved
                            </span>
                          ) : (
                            <span className="badge badge-warning">Review</span>
                          )}
                        </td>
                        <td className="text-right">
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/consultations/${c.id}`)}>
                            Review SOAP <IconArrowRight size={14} />
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

        {/* 2. Diagnostic Lab Investigations */}
        <section className="section-card flex flex-col">
          <div className="section-card-header">
            <div>
              <h2 className="section-card-title">Diagnostic lab investigations</h2>
              <p className="card-subtitle">Latest results and requisitions in progress</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/followups')}>
              Follow-ups <IconArrowRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-3" style={{ padding: 18, flex: 1 }}>
            {labTasks.length === 0 ? (
              <div className="empty-state" style={{ flex: 1 }}>
                <div className="empty-icon">
                  <IconFlask />
                </div>
                <h3 className="empty-title">No diagnostic requisitions pending</h3>
                <p className="empty-description">New lab investigations will appear here as they are ordered.</p>
              </div>
            ) : (
              labTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="glass-card-flat flex items-center justify-between" style={{ padding: '10px 14px' }}>
                  <div className="min-w-0">
                    <p className="font-semibold">{task.test_name}</p>
                    <p className="text-muted text-xs" style={{ marginTop: 2 }}>
                      Patient: {task.patient_name}
                    </p>
                  </div>
                  <span className={`status-badge status-${String(task.status || '').toLowerCase().replace(/ /g, '_')}`}>
                    {task.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="text-right">
        <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} /> Refresh workspace
        </button>
      </div>
    </div>
  );
}