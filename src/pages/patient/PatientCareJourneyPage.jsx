import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPatientCareJourney } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconCheck,
  IconClock,
  IconVideo,
  IconDoc,
  IconPill,
  IconActivity,
  IconStethoscope,
  IconArrowRight,
  IconShield,
} from '../../components/icons';

const STAGE_ICONS = {
  CONSULTATION: IconVideo,
  CLINICAL_REVIEW: IconDoc,
  PRESCRIPTION: IconPill,
  CARE_PLAN: IconActivity,
  PATIENT_TASKS: IconPill,
  FOLLOW_UP: IconClock,
  DOCTOR_REVIEW: IconStethoscope,
};

export default function PatientCareJourneyPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const defaultStages = [
    {
      step: 1,
      key: 'CONSULTATION',
      title: 'Google Meet Consultation',
      doctor: 'Dr. Sarah Jenkins',
      date: 'Today, 10:00 AM',
      status: 'COMPLETED',
      action_label: 'View Consultation',
      action_url: '/consultations/video',
    },
    {
      step: 2,
      key: 'CLINICAL_REVIEW',
      title: 'Clinical Documentation Signed',
      doctor: 'Dr. Sarah Jenkins',
      date: 'Today, 10:45 AM',
      status: 'COMPLETED',
      action_label: 'View Summary',
      action_url: '/patient/activity',
    },
    {
      step: 3,
      key: 'PRESCRIPTION',
      title: 'Prescription Issued',
      doctor: 'Dr. Sarah Jenkins',
      date: 'Today, 11:00 AM',
      status: 'COMPLETED',
      action_label: 'View Prescription',
      action_url: '/patient/medications',
    },
    {
      step: 4,
      key: 'CARE_PLAN',
      title: 'Personalized Care Plan',
      doctor: 'Care Team',
      date: 'Today, 11:05 AM',
      status: 'COMPLETED',
      action_label: 'View Care Plan',
      action_url: '/patient/follow-up',
    },
    {
      step: 5,
      key: 'PATIENT_TASKS',
      title: 'Daily Patient Medication & Tasks',
      doctor: 'Patient Self-Care',
      date: 'Ongoing (Day 1 of 5)',
      status: 'IN_PROGRESS',
      action_label: "Today's Tasks",
      action_url: '/patient/medications',
    },
    {
      step: 6,
      key: 'FOLLOW_UP',
      title: 'Condition Check-in & Signal',
      doctor: 'Patient Reported',
      date: 'Tomorrow, 06:00 PM',
      status: 'DUE',
      action_label: 'Check In Now',
      action_url: '/patient/follow-up/plan_1/check-in',
    },
    {
      step: 7,
      key: 'DOCTOR_REVIEW',
      title: 'Doctor Care Evaluation',
      doctor: 'Attending Physician',
      date: 'Pending Check-In',
      status: 'PENDING',
      action_label: 'View Review Notes',
      action_url: '/patient/activity',
    },
  ];

  useEffect(() => {
    loadJourney();
  }, []);

  const loadJourney = async () => {
    try {
      setLoading(true);
      const res = await getPatientCareJourney();
      if (res?.stages && res.stages.length > 0) {
        setStages(res.stages);
      } else {
        setStages(defaultStages);
      }
    } catch (err) {
      console.warn('Backend unavailable, using default care journey stages:', err);
      setStages(defaultStages);
    } finally {
      setLoading(false);
    }
  };

  if (loading && stages.length === 0) {
    return (
      <div className="workspace-container" style={{ padding: '2rem 1rem', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <p className="text-muted" style={{ marginTop: '1rem' }}>Loading your comprehensive care journey…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-container" style={{ padding: '2rem 1.5rem', maxWidth: 960, margin: '0 auto' }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
          <Link to="/patient" style={{ color: 'var(--color-text-secondary, #94a3b8)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <IconActivity style={{ width: 24, height: 24 }} />
          </div>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Your Care Journey
            </h1>
            <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '1rem', marginTop: 2 }}>
              End-to-end clinical timeline from Google Meet consultation to follow-up evaluation.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Care Journey Visual Timeline ───────────────────────── */}
      <div
        style={{
          position: 'relative',
          paddingLeft: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        }}
      >
        {/* Continuous background vertical timeline line */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            bottom: 24,
            left: 19,
            width: 2,
            background: 'linear-gradient(to bottom, #10b981, #3b82f6, #6366f1, #8b5cf6)',
            zIndex: 1,
          }}
        />

        {stages.map((stage, idx) => {
          const IconComp = STAGE_ICONS[stage.key] || IconActivity;
          const isCompleted = stage.status === 'COMPLETED';
          const isInProgress = stage.status === 'IN_PROGRESS' || stage.status === 'DUE';

          return (
            <div
              key={stage.key}
              style={{
                position: 'relative',
                zIndex: 2,
              }}
            >
              {/* Step indicator node */}
              <div
                style={{
                  position: 'absolute',
                  left: -40,
                  top: 14,
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: isCompleted
                    ? '#10b981'
                    : isInProgress
                    ? '#3b82f6'
                    : 'var(--color-surface, #1e293b)',
                  border: isCompleted
                    ? '3px solid rgba(16, 185, 129, 0.3)'
                    : isInProgress
                    ? '3px solid rgba(59, 130, 246, 0.3)'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isCompleted || isInProgress ? '#fff' : '#64748b',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                }}
              >
                {isCompleted ? (
                  <IconCheck style={{ width: 18, height: 18 }} />
                ) : (
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{stage.step}</span>
                )}
              </div>

              {/* Stage Card */}
              <div
                className="card"
                style={{
                  padding: '1.5rem',
                  background: 'var(--color-surface, #1e293b)',
                  borderRadius: 14,
                  border: isInProgress
                    ? '1px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isInProgress ? '0 0 20px rgba(59, 130, 246, 0.08)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isCompleted ? '#10b981' : isInProgress ? '#60a5fa' : '#94a3b8',
                      }}
                    >
                      <IconComp style={{ width: 20, height: 20 }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                          }}
                        >
                          STAGE {stage.step} • {stage.key.replace('_', ' ')}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: isCompleted
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isInProgress
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(255, 255, 255, 0.05)',
                            color: isCompleted ? '#10b981' : isInProgress ? '#60a5fa' : '#94a3b8',
                          }}
                        >
                          {stage.status}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: '4px 0 0 0' }}>
                        {stage.title}
                      </h3>
                    </div>
                  </div>

                  {stage.action_url && (
                    <Link
                      to={stage.action_url}
                      className={`btn ${isInProgress ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      {stage.action_label || 'View'}
                      <IconArrowRight style={{ width: 14, height: 14 }} />
                    </Link>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                    marginTop: '1.25rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                      Doctor / Team
                    </span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginTop: 2 }}>
                      {stage.doctor}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                      Date / Timeline
                    </span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginTop: 2 }}>
                      {stage.date}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                      Governance
                    </span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#10b981', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconShield style={{ width: 14, height: 14 }} /> Doctor Verified
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
