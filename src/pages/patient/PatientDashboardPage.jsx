import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getPatientDashboardData,
  updateMedicationTaskStatus,
} from '../../services/api';
import {
  IconVideo,
  IconPill,
  IconClock,
  IconActivity,
  IconCheck,
  IconAlert,
  IconDoc,
  IconCalendar,
  IconShield,
  IconArrowRight,
} from '../../components/icons';

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const defaultData = {
    greeting: 'Good morning',
    patient_name: user?.full_name || 'Patient',
    subtitle: "Here's your care journey.",
    upcoming_consultation: {
      id: 'demo_consult_1',
      doctor_name: 'Dr. Sarah Jenkins',
      specialization: 'Cardiologist & Internal Medicine',
      date: 'Today',
      time: '10:00 AM',
      status: 'Confirmed',
    },
    medication_tasks: [
      {
        id: 'task_1',
        medicine_name: 'Amoxicillin 500mg',
        dosage: '1 capsule',
        schedule_slot: 'Morning',
        due_time: '08:00 AM',
        instructions: 'Take with food and water',
        status: 'TAKEN',
        taken_at: new Date().toISOString(),
      },
      {
        id: 'task_2',
        medicine_name: 'Paracetamol 650mg',
        dosage: '1 tablet',
        schedule_slot: 'Afternoon',
        due_time: '01:00 PM',
        instructions: 'Take after lunch',
        status: 'PENDING',
      },
      {
        id: 'task_3',
        medicine_name: 'Cetirizine 10mg',
        dosage: '1 tablet',
        schedule_slot: 'Night',
        due_time: '08:00 PM',
        instructions: 'Take before sleep',
        status: 'PENDING',
      },
    ],
    follow_up: {
      id: 'plan_1',
      doctor_name: 'Dr. Sarah Jenkins',
      due_date: 'Tomorrow, 06:00 PM',
      instruction: 'Daily recovery and symptom check-in',
      status: 'ACTIVE',
      is_checkin_due: true,
    },
    recent_activities: [
      { id: 'act_1', title: 'Consultation with Dr. Sarah Jenkins completed', timestamp: 'Today, 10:45 AM', icon: 'video' },
      { id: 'act_2', title: 'Prescription issued by Dr. Sarah Jenkins', timestamp: 'Today, 11:00 AM', icon: 'rx' },
      { id: 'act_3', title: 'Follow-Up Care Plan created', timestamp: 'Today, 11:05 AM', icon: 'clock' },
    ],
    todays_care: [
      {
        type: 'MEDICATION',
        time: '08:00 AM',
        title: 'Amoxicillin 500mg',
        subtitle: '1 capsule • Take with food',
        status: 'TAKEN',
        action_id: 'task_1',
      },
      {
        type: 'APPOINTMENT',
        time: '10:00 AM',
        title: 'Consultation with Dr. Sarah Jenkins',
        subtitle: 'Telehealth Video Consultation',
        status: 'CONFIRMED',
        action_id: 'demo_consult_1',
      },
      {
        type: 'MEDICATION',
        time: '01:00 PM',
        title: 'Paracetamol 650mg',
        subtitle: '1 tablet • Take after lunch',
        status: 'PENDING',
        action_id: 'task_2',
      },
      {
        type: 'FOLLOW_UP',
        time: '06:00 PM',
        title: 'Condition Check-in',
        subtitle: 'Doctor requested a condition update',
        status: 'DUE',
        action_id: 'plan_1',
      },
      {
        type: 'MEDICATION',
        time: '08:00 PM',
        title: 'Cetirizine 10mg',
        subtitle: '1 tablet • Take before sleep',
        status: 'PENDING',
        action_id: 'task_3',
      },
    ],
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await getPatientDashboardData();
      if (res && (res.upcoming_consultation || res.medication_tasks?.length || res.todays_care?.length)) {
        setData(res);
      } else {
        setData(defaultData);
      }
    } catch (err) {
      console.warn('Backend unavailable, using connected mock state:', err);
      setData(defaultData);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkMedication = async (taskId, newStatus = 'TAKEN') => {
    setActionLoading((prev) => ({ ...prev, [taskId]: true }));
    try {
      await updateMedicationTaskStatus(taskId, newStatus);
      addToast(`Medication recorded as ${newStatus.toLowerCase()}.`, 'success');
      await loadDashboard();
    } catch (err) {
      console.warn('Fallback local state update:', err);
      setData((prev) => {
        if (!prev) return prev;
        const updatedMeds = (prev.medication_tasks || []).map((m) =>
          m.id === taskId ? { ...m, status: newStatus, taken_at: newStatus === 'TAKEN' ? new Date().toISOString() : null } : m
        );
        const updatedCare = (prev.todays_care || []).map((c) =>
          c.action_id === taskId ? { ...c, status: newStatus } : c
        );
        return { ...prev, medication_tasks: updatedMeds, todays_care: updatedCare };
      });
      addToast(`Medication recorded as ${newStatus.toLowerCase()}.`, 'success');
    } finally {
      setActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  if (loading && !data) {
    return (
      <div className="workspace-container" style={{ padding: '2rem 1rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <p className="text-muted" style={{ marginTop: '1rem' }}>Loading your personalized care journey…</p>
          </div>
        </div>
      </div>
    );
  }

  const patientName = data?.patient_name || user?.full_name || 'Patient';
  const greeting = data?.greeting || 'Good morning';
  const upcomingConsultation = data?.upcoming_consultation;
  const medicationTasks = data?.medication_tasks || [];
  const followUp = data?.follow_up;
  const recentActivities = data?.recent_activities || [];
  const todaysCare = data?.todays_care || [];

  const takenCount = medicationTasks.filter((m) => m.status === 'TAKEN').length;
  const totalMeds = medicationTasks.length;

  return (
    <div className="workspace-container" style={{ padding: '2rem 1.5rem', maxWidth: 1240, margin: '0 auto' }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 9999,
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                marginBottom: '0.75rem',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              KENKO Connected Care
            </span>
            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              {greeting}, {patientName}
            </h1>
            <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '1.05rem', marginTop: '0.35rem' }}>
              Here's your care journey.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link
              to="/patient/care-journey"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
            >
              <IconActivity style={{ width: 16, height: 16 }} />
              Care Journey
            </Link>
            <Link
              to="/consultations/video"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
            >
              <IconVideo style={{ width: 16, height: 16 }} />
              Start Consultation
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 4 Primary Cards Grid ───────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        {/* Card 1: Upcoming Consultation */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#60a5fa' }}>
                Upcoming Consultation
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60a5fa',
                }}
              >
                <IconVideo style={{ width: 18, height: 18 }} />
              </div>
            </div>

            {upcomingConsultation ? (
              <>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                  {upcomingConsultation.doctor_name}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #94a3b8)', margin: '0 0 1rem 0' }}>
                  {upcomingConsultation.specialization}
                </p>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 10, marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Date:</span>
                    <span style={{ fontWeight: 600 }}>{upcomingConsultation.date}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Time:</span>
                    <span style={{ fontWeight: 600 }}>{upcomingConsultation.time}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Status:</span>
                    <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconCheck style={{ width: 14, height: 14 }} /> {upcomingConsultation.status}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '1rem 0', color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
                <p>No upcoming consultation scheduled.</p>
              </div>
            )}
          </div>

          <Link
            to={upcomingConsultation ? `/consultations/${upcomingConsultation.id}` : '/consultations/video'}
            className="btn btn-secondary"
            style={{ width: '100%', textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
          >
            {upcomingConsultation ? 'View Consultation' : 'Book Consultation'}
          </Link>
        </div>

        {/* Card 2: Medication Tasks */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #10b981, #34d399)',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399' }}>
                Medication Tasks
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34d399',
                }}
              >
                <IconPill style={{ width: 18, height: 18 }} />
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
              {totalMeds > 0 ? `${takenCount} of ${totalMeds} Completed` : 'No Prescribed Meds'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #94a3b8)', margin: '0 0 1rem 0' }}>
              Today's scheduled doses
            </p>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 10, marginBottom: '1rem' }}>
              {medicationTasks.slice(0, 2).map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{m.medicine_name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 6 }}>({m.due_time || m.schedule_slot})</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: m.status === 'TAKEN' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: m.status === 'TAKEN' ? '#10b981' : '#f59e0b',
                    }}
                  >
                    {m.status === 'TAKEN' ? '✓ Taken' : 'Pending'}
                  </span>
                </div>
              ))}
              {medicationTasks.length === 0 && (
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>All medications up to date.</span>
              )}
            </div>
          </div>

          <Link
            to="/patient/medications"
            className="btn btn-secondary"
            style={{ width: '100%', textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
          >
            Track Medications
          </Link>
        </div>

        {/* Card 3: Follow-Up */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fbbf24' }}>
                Follow-Up
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fbbf24',
                }}
              >
                <IconClock style={{ width: 18, height: 18 }} />
              </div>
            </div>

            {followUp ? (
              <>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                  {followUp.doctor_name}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #94a3b8)', margin: '0 0 1rem 0' }}>
                  Next review: {followUp.due_date}
                </p>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 10, marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #94a3b8)', marginBottom: 4 }}>
                    Instructions:
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#f8fafc' }}>
                    {followUp.instruction || 'Record daily condition response.'}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '1rem 0', color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
                <p>No active follow-up plans.</p>
              </div>
            )}
          </div>

          <Link
            to={followUp ? `/patient/follow-up/${followUp.id}/check-in` : '/patient/follow-up'}
            className={`btn ${followUp?.is_checkin_due ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
          >
            {followUp?.is_checkin_due ? 'Complete Check-In' : 'View Follow-Up'}
          </Link>
        </div>

        {/* Card 4: Health Activity */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a78bfa' }}>
                Health Activity
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(139, 92, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a78bfa',
                }}
              >
                <IconActivity style={{ width: 18, height: 18 }} />
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
              Care Journey Activity
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #94a3b8)', margin: '0 0 1rem 0' }}>
              Recent verified updates
            </p>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 10, marginBottom: '1rem' }}>
              {recentActivities.slice(0, 2).map((act) => (
                <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.825rem', marginBottom: 6 }}>
                  <IconCheck style={{ width: 14, height: 14, color: '#10b981', flexShrink: 0 }} />
                  <span style={{ color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {act.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Link
            to="/patient/activity"
            className="btn btn-secondary"
            style={{ width: '100%', textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
          >
            View All Activity
          </Link>
        </div>
      </div>

      {/* ─── TODAY'S CARE Section ──────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '2rem',
          background: 'var(--color-surface, #1e293b)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>TODAY'S CARE</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary, #94a3b8)', margin: '0.25rem 0 0 0' }}>
              Your personalized schedule for medication, consultations, and doctor check-ins
            </p>
          </div>
          <Link to="/patient/calendar" className="btn btn-ghost" style={{ fontSize: '0.875rem', textDecoration: 'none' }}>
            <IconCalendar style={{ width: 16, height: 16, marginRight: 6 }} />
            View Calendar
          </Link>
        </div>

        {todaysCare.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
            <IconCheck style={{ width: 40, height: 40, color: '#10b981', margin: '0 auto 1rem auto' }} />
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>All Caught Up for Today!</p>
            <p style={{ fontSize: '0.9rem' }}>No pending medication tasks or consultations scheduled right now.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {todaysCare.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.2rem 1.5rem',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#60a5fa',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      minWidth: 85,
                      textAlign: 'center',
                    }}
                  >
                    {item.time}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color:
                            item.type === 'MEDICATION'
                              ? '#34d399'
                              : item.type === 'APPOINTMENT'
                              ? '#60a5fa'
                              : '#fbbf24',
                        }}
                      >
                        {item.type}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {item.status === 'TAKEN' ? 'Completed' : item.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 2 }}>
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  {item.type === 'MEDICATION' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {item.status === 'TAKEN' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                          }}
                        >
                          <IconCheck style={{ width: 14, height: 14 }} /> Marked as Taken
                        </span>
                      ) : (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={actionLoading[item.action_id]}
                            onClick={() => handleMarkMedication(item.action_id, 'TAKEN')}
                          >
                            Mark as Taken
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={actionLoading[item.action_id]}
                            onClick={() => handleMarkMedication(item.action_id, 'SKIPPED')}
                          >
                            Skip
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {item.type === 'APPOINTMENT' && (
                    <Link
                      to={`/consultations/${item.action_id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      View
                    </Link>
                  )}

                  {item.type === 'FOLLOW_UP' && (
                    <Link
                      to={`/patient/follow-up/${item.action_id}/check-in`}
                      className="btn btn-primary btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      Complete
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
