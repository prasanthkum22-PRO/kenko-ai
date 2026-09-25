import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPatientCalendarEvents } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconCalendar,
  IconClock,
  IconVideo,
  IconPill,
  IconFlask,
  IconCheck,
} from '../../components/icons';

export default function PatientCalendarPage() {
  const { addToast } = useToast();
  const [view, setView] = useState('agenda'); // 'month' | 'week' | 'agenda'
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await getPatientCalendarEvents();
      setEvents(res || []);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
      addToast('Failed to load appointment calendar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'appointment':
        return '#60a5fa';
      case 'followup':
        return '#fbbf24';
      case 'medication':
        return '#34d399';
      case 'test':
        return '#c084fc';
      default:
        return '#94a3b8';
    }
  };

  return (
    <div className="workspace-container" style={{ padding: '2rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
          <Link to="/patient" style={{ color: 'var(--color-text-secondary, #94a3b8)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <IconCalendar style={{ width: 24, height: 24 }} />
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Care Schedule & Calendar
              </h1>
              <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.95rem', marginTop: 2 }}>
                Synchronized consultations, follow-up reviews, and diagnostic milestones.
              </p>
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: 4, borderRadius: 10 }}>
            {['agenda', 'week', 'month'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: view === v ? '#3b82f6' : 'transparent',
                  color: view === v ? '#fff' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <p className="text-muted" style={{ marginTop: '1rem' }}>Loading calendar events…</p>
          </div>
        </div>
      ) : events.length === 0 ? (
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
          <IconCalendar style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>No Events Scheduled</h3>
          <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
            Book a video consultation or schedule a check-in to see dates appear on your calendar.
          </p>
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: '2rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {events.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.2rem 1.5rem',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  borderLeft: `4px solid ${getCategoryColor(evt.category)}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: '#f8fafc',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      minWidth: 90,
                    }}
                  >
                    <div>{evt.date}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>{evt.time}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: getCategoryColor(evt.category),
                        }}
                      >
                        {evt.category}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{evt.status}</span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>
                      {evt.title}
                    </div>
                    {evt.instruction && (
                      <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: 2 }}>
                        {evt.instruction}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {evt.category === 'appointment' && (
                    <Link to="/consultations/video" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                      Join Room
                    </Link>
                  )}
                  {evt.category === 'followup' && (
                    <Link to="/patient/follow-up" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                      Check-In
                    </Link>
                  )}
                  {evt.category === 'medication' && (
                    <Link to="/patient/medications" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
                      Log Dose
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
