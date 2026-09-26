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

        // Load appointments from backend and fallback to Firebase
        let backendAppts = wsData?.scheduled_appointments || [];
        if (backendAppts.length === 0) {
          try {
            const aptRes = await getAppointments();
            if (aptRes?.appointments) {
              backendAppts = aptRes.appointments.map((item) => {
                const a = item.appointment || item;
                return {
                  id: a.id,
                  patientId: a.patientId || a.patient_id,
                  patientName: item.patient?.displayName || a.patient_name || a.patientName || 'Patient',
                  patientAge: item.patient?.age || a.patient_age || a.patientAge,
                  patientGender: item.patient?.gender || a.patient_gender || a.patientGender,
                  doctorId: a.doctorId || a.doctor_id,
                  doctorName: item.doctor?.displayName || a.doctor_name || a.doctorName || 'Dr. Specialist',
                  doctorSpecialization: item.doctor?.specialization || a.doctor_specialization || a.doctorSpecialization,
                  appointmentType: (a.consultationType || a.appointment_type || a.appointmentType || 'video').toLowerCase(),
                  scheduledAt: a.scheduledStart || a.scheduled_at || a.scheduledAt,
                  reason: a.reason || 'General Consultation',
                  status: (a.status || 'SCHEDULED').toUpperCase(),
                  meetStatus: item.googleMeet?.status || a.meet_status || a.meetStatus || 'SCHEDULED',
                  googleMeetingUri: item.googleMeet?.meetingUri || a.google_meeting_uri || a.googleMeetingUri,
                  googleMeetingCode: item.googleMeet?.meetingCode || a.google_meeting_code || a.googleMeetingCode,
                  googleSpaceName: item.googleMeet?.spaceName || a.google_space_name || a.googleSpaceName,
                };
              });
            }
          } catch (err) {
            console.warn('Backend getAppointments fallback to Firestore:', err?.message);
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
          doctorSpecialization: a.doctorSpecialization || a.doctor_specialization || 'General Medicine',
          appointmentType: (a.consultationType || a.appointment_type || 'video').toLowerCase(),
          scheduledAt: a.scheduledStart?.toDate ? a.scheduledStart.toDate().toISOString() : (a.scheduledStart || a.scheduled_at),
          reason: a.reason || 'General Consultation',
          status: (a.status || 'SCHEDULED').toUpperCase(),
          meetStatus: a.meetStatus || 'SCHEDULED',
          googleMeetingUri: a.googleMeetingUri || a.google_meeting_uri,
          googleMeetingCode: a.googleMeetingCode || a.google_meeting_code,
          googleSpaceName: a.googleSpaceName || a.google_space_name,
        }));

        // Merge backend + firestore uniquely
        const mergedMap = new Map();
        backendAppts.forEach((a) => mergedMap.set(a.id, a));
        normalizedFs.forEach((a) => {
          const existing = mergedMap.get(a.id) || {};
          mergedMap.set(a.id, { ...existing, ...a });
        });

        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0)
        );

        if (active) setAppointments(mergedList);
      } catch (err) {
        console.error('Failed to load doctor workspace:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    // Setup Firestore realtime listener for doctor appointments
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
                doctorSpecialization: f.doctorSpecialization || f.doctor_specialization || existing.doctorSpecialization || 'General Medicine',
                appointmentType: (f.consultationType || f.appointment_type || existing.appointmentType || 'video').toLowerCase(),
                scheduledAt: f.scheduledStart?.toDate ? f.scheduledStart.toDate().toISOString() : (f.scheduledStart || f.scheduled_at || existing.scheduledAt),
                reason: f.reason || existing.reason || 'General Consultation',
                status: (f.status || existing.status || 'SCHEDULED').toUpperCase(),
                meetStatus: f.meetStatus || existing.meetStatus || 'SCHEDULED',
                googleMeetingUri: f.googleMeetingUri || existing.googleMeetingUri,
                googleMeetingCode: f.googleMeetingCode || existing.googleMeetingCode,
                googleSpaceName: f.googleSpaceName || existing.googleSpaceName,
              });
            });
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0)
            );
          });
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

  const metrics = workspace?.metrics || {};
  const pendingVerification = consultations.filter((c) => !c.is_approved).length;
  const pendingLab = labTasks.filter((l) => l.status !== 'Reviewed' && l.status !== 'Completed').length;
  const scheduledCount = appointments.filter(
    (a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED'
  ).length;

  const filteredAppointments = appointments.filter((apt) => {
    const st = apt.status?.toUpperCase() || 'SCHEDULED';
    if (appointmentFilter === 'upcoming') return st !== 'CANCELLED' && st !== 'COMPLETED';
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
            AI-assisted clinical workflow with verifiable SOAP summaries, patient appointment queues, and ambient speech capture.
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
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconCalendar />
          </div>
          <span className="kpi-label">Patient Appointments</span>
          <span className="kpi-value">{scheduledCount}</span>
          <span className="kpi-foot">Upcoming &amp; active visits</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconStethoscope />
          </div>
          <span className="kpi-label">Total consultations</span>
          <span className="kpi-value">{metrics.total_consultations || consultations.length || 0}</span>
          <span className="kpi-foot">In-person &amp; video</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconClock />
          </div>
          <span className="kpi-label">Pending verification</span>
          <span className="kpi-value">{pendingVerification || metrics.pending_approval || 0}</span>
          <span className="kpi-foot">Requires doctor review</span>
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
      <section className="section-card flex flex-col" id="doctor-appointments-queue">
        <div className="section-card-header flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="section-card-title">Patient Appointments Queue</h2>
              <span className="badge badge-primary">{filteredAppointments.length}</span>
            </div>
            <p className="card-subtitle">
              Real-time patient bookings synced with Firebase Firestore and Google Meet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800/40 p-1 rounded-lg border border-slate-700/50 text-xs">
              <button
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  appointmentFilter === 'upcoming' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setAppointmentFilter('upcoming')}
              >
                Upcoming
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
                  appointmentFilter === 'in_person' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setAppointmentFilter('in_person')}
              >
                In-Person
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
              <h3 className="empty-title">No appointments found</h3>
              <p className="empty-description">
                Patient bookings from the portal or mobile app will appear here in real-time.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments?action=book')}>
                <IconPlus size={14} /> Book New Appointment
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Visit Type</th>
                    <th>Date &amp; Time</th>
                    <th>Clinical Reason</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((apt) => {
                    const isVideo = apt.appointmentType === 'video';
                    const isScheduled = apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED';
                    const isCompleted = apt.status === 'COMPLETED';
                    const isCancelled = apt.status === 'CANCELLED';

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
                              {apt.patientAge ? `${apt.patientAge}y` : ''} {apt.patientGender || ''}
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
                              isCompleted
                                ? 'badge-success'
                                : isCancelled
                                ? 'badge-secondary'
                                : 'badge-primary'
                            }`}
                          >
                            {apt.status || 'SCHEDULED'}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isVideo ? (
                              <button
                                className="btn btn-primary btn-sm flex items-center gap-1"
                                onClick={() => navigate(`/consultations/video?appointmentId=${apt.id}`)}
                                title="Start Telehealth Video Consultation"
                              >
                                <IconVideo size={13} /> Launch Video
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm flex items-center gap-1"
                                onClick={() => navigate(`/consultations/in-person?appointmentId=${apt.id}`)}
                                title="Start In-Person Ambient Recording"
                              >
                                <IconMic size={13} /> Ambient Visit
                              </button>
                            )}
                            {isScheduled && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                                title="Mark as Completed"
                              >
                                <IconCheck size={14} className="text-emerald-400" />
                              </button>
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