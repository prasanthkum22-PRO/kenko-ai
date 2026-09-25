import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getPatientDashboardData,
  getPatientPrescriptions,
  getPatientFollowUpOverview,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconDoc,
  IconVideo,
  IconPill,
  IconClock,
  IconCheck,
  IconShield,
  IconCalendar,
} from '../../components/icons';

export default function PatientHealthSummaryPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const [dash, rx, follow] = await Promise.all([
        getPatientDashboardData(),
        getPatientPrescriptions(),
        getPatientFollowUpOverview(),
      ]);
      setSummaryData({
        dashboard: dash,
        prescriptions: rx?.prescriptions || rx || [],
        followUps: follow?.plans || [],
        tasks: follow?.tasks || [],
      });
    } catch (err) {
      console.error('Failed to load health summary:', err);
      addToast('Failed to load comprehensive health summary.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="workspace-container" style={{ padding: '2rem 1rem', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <p className="text-muted" style={{ marginTop: '1rem' }}>Compiling verified health summary…</p>
          </div>
        </div>
      </div>
    );
  }

  const upcomingConsult = summaryData?.dashboard?.upcoming_consultation;
  const prescriptions = summaryData?.prescriptions || [];
  const followUps = summaryData?.followUps || [];
  const medTasks = summaryData?.dashboard?.medication_tasks || [];

  return (
    <div className="workspace-container" style={{ padding: '2rem 1.5rem', maxWidth: 1060, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
          <Link to="/patient" style={{ color: 'var(--color-text-secondary, #94a3b8)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Clinical Health Summary
            </h1>
            <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '1rem', marginTop: 2 }}>
              Verified medical profile, active regimens, and pending clinical tasks.
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 14px', borderRadius: 9999, fontSize: '0.85rem', fontWeight: 600 }}>
            <IconShield style={{ width: 16, height: 16 }} /> Doctor-Approved Evidence Only
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Section 1: Upcoming Consultations */}
        <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface, #1e293b)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <IconVideo style={{ width: 20, height: 20, color: '#60a5fa' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Upcoming Consultations</h2>
          </div>
          {upcomingConsult ? (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>{upcomingConsult.doctor_name}</div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '2px 0 8px 0' }}>{upcomingConsult.specialization}</div>
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{upcomingConsult.date} at {upcomingConsult.time}</div>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No upcoming consultations scheduled.</p>
          )}
        </div>

        {/* Section 2: Active Prescriptions */}
        <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface, #1e293b)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <IconPill style={{ width: 20, height: 20, color: '#10b981' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Active Prescriptions</h2>
          </div>
          {prescriptions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {prescriptions.slice(0, 3).map((rx) => (
                <div key={rx.id} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>Dr. {rx.doctor_name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Issued: {rx.issued_at || 'Recent'} • {(rx.items || []).length} medications</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No active prescriptions on record.</p>
          )}
        </div>

        {/* Section 3: Active Follow-Up Plans */}
        <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface, #1e293b)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <IconClock style={{ width: 20, height: 20, color: '#f59e0b' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Active Follow-Up Plans</h2>
          </div>
          {followUps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {followUps.slice(0, 3).map((plan) => (
                <div key={plan.id} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>Review Due: {plan.due_date}</div>
                  <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: 2 }}>{plan.instruction}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No pending follow-up plans.</p>
          )}
        </div>

        {/* Section 4: Pending Daily Tasks */}
        <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface, #1e293b)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <IconCheck style={{ width: 20, height: 20, color: '#a855f7' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Pending Daily Tasks</h2>
          </div>
          {medTasks.filter((t) => t.status !== 'TAKEN').length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {medTasks.filter((t) => t.status !== 'TAKEN').slice(0, 3).map((t) => (
                <div key={t.id} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>{t.medicine_name}</div>
                  <div style={{ fontSize: '0.825rem', color: '#f59e0b', marginTop: 2 }}>{t.due_time || t.schedule_slot} — Pending</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>✓ All daily tasks completed.</p>
          )}
        </div>
      </div>
    </div>
  );
}
