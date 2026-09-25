import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { submitPatientCheckIn, getPatientFollowUpOverview } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconCheck,
  IconClock,
  IconShield,
  IconAlert,
  IconHeart,
  IconArrowRight,
} from '../../components/icons';

export default function PatientConditionCheckInPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null); // 'RECOVERING' | 'SAME' | 'WORSENING'
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    loadPlan();
  }, [id]);

  const loadPlan = async () => {
    try {
      const overview = await getPatientFollowUpOverview();
      const current = overview?.plans?.find((p) => String(p.id) === String(id));
      if (current) setPlan(current);
    } catch (err) {
      console.error('Failed to load follow-up details:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStatus) {
      addToast('Please select your current condition status.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await submitPatientCheckIn({
        follow_up_plan_id: id || '',
        condition_status: selectedStatus,
        notes: notes.trim(),
      });
      setSubmittedStatus(selectedStatus);
      setSubmitted(true);
      addToast('Condition check-in submitted successfully.', 'success');
    } catch (err) {
      console.error('Failed to submit check-in:', err);
      addToast('Failed to submit condition check-in. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workspace-container" style={{ padding: '2.5rem 1.5rem', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link to="/patient/follow-up" style={{ color: 'var(--color-text-secondary, #94a3b8)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Follow-Up Center
        </Link>
      </div>

      {!submitted ? (
        <div
          className="card"
          style={{
            padding: '2.5rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: 20,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 9999,
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#60a5fa',
                marginBottom: '0.75rem',
              }}
            >
              <IconHeart style={{ width: 14, height: 14 }} /> Scheduled Care Check-In
            </span>
            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              How is your condition now?
            </h1>
            <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '1rem', marginTop: '0.5rem', maxWidth: 540, margin: '0.5rem auto 0 auto' }}>
              {plan?.instruction || 'Please select how you are feeling compared to your initial doctor consultation.'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Condition Options Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              {/* Option 1: RECOVERING */}
              <div
                onClick={() => setSelectedStatus('RECOVERING')}
                style={{
                  padding: '1.5rem',
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: selectedStatus === 'RECOVERING' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: selectedStatus === 'RECOVERING' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    margin: '0 auto 1rem auto',
                    fontSize: '1.4rem',
                  }}
                >
                  ✓
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>RECOVERING</div>
                <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>
                  Symptoms improving, feeling noticeably better.
                </p>
              </div>

              {/* Option 2: SAME */}
              <div
                onClick={() => setSelectedStatus('SAME')}
                style={{
                  padding: '1.5rem',
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: selectedStatus === 'SAME' ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: selectedStatus === 'SAME' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                    margin: '0 auto 1rem auto',
                    fontSize: '1.4rem',
                  }}
                >
                  —
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>SAME</div>
                <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>
                  No notable change in symptoms or discomfort.
                </p>
              </div>

              {/* Option 3: WORSENING */}
              <div
                onClick={() => setSelectedStatus('WORSENING')}
                style={{
                  padding: '1.5rem',
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: selectedStatus === 'WORSENING' ? '2px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: selectedStatus === 'WORSENING' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    margin: '0 auto 1rem auto',
                    fontSize: '1.4rem',
                  }}
                >
                  !
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>WORSENING</div>
                <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>
                  Symptoms increased or new symptoms appeared.
                </p>
              </div>
            </div>

            {/* Additional details textarea */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
                Additional Notes or Observations (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe any specific sensations, temperature changes, or medications taken..."
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !selectedStatus}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.9rem',
                fontSize: '1rem',
                fontWeight: 700,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? 'Transmitting to Care Team…' : 'Submit Condition Update'}
            </button>
          </form>
        </div>
      ) : (
        /* ─── Confirmation Screen ────────────────────────────────────────── */
        <div
          className="card"
          style={{
            padding: '3rem 2rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: 20,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: submittedStatus === 'WORSENING' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: submittedStatus === 'WORSENING' ? '#ef4444' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
            }}
          >
            <IconCheck style={{ width: 32, height: 32 }} />
          </div>

          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
            Your response was sent for doctor review.
          </h2>

          <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '1.05rem', maxWidth: 520, margin: '0.5rem auto 1.5rem auto' }}>
            {submittedStatus === 'RECOVERING' && 'Thanks. Your update has been recorded.'}
            {submittedStatus === 'SAME' && 'Your update has been recorded and scheduled for routine doctor review.'}
            {submittedStatus === 'WORSENING' && 'Your response has been sent to your care team for high-priority clinical review.'}
          </p>

          <div
            style={{
              padding: '1rem',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.03)',
              maxWidth: 500,
              margin: '0 auto 2rem auto',
              fontSize: '0.875rem',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            <IconShield style={{ width: 16, height: 16, color: '#10b981' }} />
            <span>Response recorded under patient-governed clinical provenance.</span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/patient/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Return to Dashboard
            </Link>
            <Link to="/patient/health-timeline" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              View Care Timeline
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
