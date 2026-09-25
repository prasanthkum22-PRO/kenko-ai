import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPatientHealthTimeline } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconActivity,
  IconCheck,
  IconClock,
  IconVideo,
  IconDoc,
  IconPill,
  IconFlask,
  IconShield,
} from '../../components/icons';

export default function PatientActivityPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    loadTimeline();
  }, []);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const res = await getPatientHealthTimeline();
      setTimeline(res || []);
    } catch (err) {
      console.error('Failed to load activity timeline:', err);
      addToast('Failed to load health activities.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'CONSULTATION':
        return <IconVideo style={{ width: 18, height: 18, color: '#60a5fa' }} />;
      case 'PRESCRIPTION':
        return <IconPill style={{ width: 18, height: 18, color: '#10b981' }} />;
      case 'FOLLOW_UP':
        return <IconClock style={{ width: 18, height: 18, color: '#f59e0b' }} />;
      case 'TEST':
        return <IconFlask style={{ width: 18, height: 18, color: '#a855f7' }} />;
      default:
        return <IconDoc style={{ width: 18, height: 18, color: '#94a3b8' }} />;
    }
  };

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
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
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
              Health Activity Log
            </h1>
            <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '1rem', marginTop: 2 }}>
              Verified clinical actions, appointments, medications, and follow-up updates.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <p className="text-muted" style={{ marginTop: '1rem' }}>Loading activity logs…</p>
          </div>
        </div>
      ) : timeline.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem',
            textAlign: 'center',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <IconActivity style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>No Activity Recorded Yet</h3>
          <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
            When you complete consultations, receive prescriptions, or submit check-ins, they will appear here chronologically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {timeline.map((item, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1.25rem',
                padding: '1.25rem 1.5rem',
                background: 'var(--color-surface, #1e293b)',
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {getIcon(item.type)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color:
                          item.type === 'CONSULTATION'
                            ? '#60a5fa'
                            : item.type === 'PRESCRIPTION'
                            ? '#10b981'
                            : item.type === 'FOLLOW_UP'
                            ? '#f59e0b'
                            : '#a855f7',
                      }}
                    >
                      {item.type}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{item.date}</span>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    <IconCheck style={{ width: 12, height: 12 }} /> Verified
                  </span>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '4px 0 2px 0' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                  {item.details}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
