import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDoctorPatientDetail } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconUsers,
  IconVideo,
  IconPill,
  IconClock,
  IconDoc,
  IconShield,
  IconCheck,
  IconArrowRight,
} from '../../components/icons';

export default function DoctorPatientDetailPage() {
  const { patientId } = useParams();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'consultations' | 'prescriptions' | 'followups'

  useEffect(() => {
    loadDetail();
  }, [patientId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const res = await getDoctorPatientDetail(patientId);
      setData(res);
    } catch (err) {
      console.error('Failed to load patient detail:', err);
      addToast('Failed to load patient clinical profile or unauthorized access.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="workspace-container" style={{ padding: '2rem 1rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <p className="text-muted" style={{ marginTop: '1rem' }}>Verifying clinician relationship and loading records…</p>
          </div>
        </div>
      </div>
    );
  }

  const patient = data?.patient;
  const consultations = data?.consultations || [];
  const prescriptions = data?.prescriptions || [];
  const followUps = data?.follow_ups || [];

  return (
    <div className="workspace-container" style={{ padding: '2rem 1.5rem', maxWidth: 1160, margin: '0 auto' }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
          <Link to="/doctor" style={{ color: 'var(--color-text-secondary, #94a3b8)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to Doctor Workspace
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.4rem',
                fontWeight: 800,
              }}
            >
              {patient?.name ? patient.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                  {patient?.name || 'Patient'}
                </h1>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                  }}
                >
                  ID: {patient?.id}
                </span>
              </div>
              <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem', marginTop: 2 }}>
                Connected Patient • Registered {patient?.created_at || 'Recently'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/consultations/video" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              Launch Consultation
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'timeline', label: 'Care Timeline' },
          { key: 'consultations', label: `Consultations (${consultations.length})` },
          { key: 'prescriptions', label: `Prescriptions (${prescriptions.length})` },
          { key: 'followups', label: `Follow-Ups (${followUps.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ───────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div
          className="card"
          style={{
            padding: '2rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.5rem' }}>
            Comprehensive Doctor Care Timeline
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', paddingLeft: '2rem' }}>
            {/* Timeline vertical bar */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: 11,
                width: 2,
                background: 'rgba(255, 255, 255, 0.1)',
              }}
            />

            {[
              { event: 'Appointment Created', source: 'Patient Scheduling', date: 'Sept 2026', time: '09:30 AM', icon: IconClock, color: '#60a5fa' },
              { event: 'Google Meet Consultation', source: 'Official REST API v2', date: 'Sept 2026', time: '10:00 AM', icon: IconVideo, color: '#3b82f6' },
              { event: 'Transcript Processed', source: 'NVIDIA Cloud STT', date: 'Sept 2026', time: '10:45 AM', icon: IconDoc, color: '#a855f7' },
              { event: 'Clinical SOAP Note Signed', source: 'Doctor Verified', date: 'Sept 2026', time: '11:00 AM', icon: IconShield, color: '#10b981' },
              { event: 'Prescription Issued', source: 'Prescription Studio', date: 'Sept 2026', time: '11:05 AM', icon: IconPill, color: '#10b981' },
              { event: 'Follow-Up Plan Scheduled', source: 'Follow-Up Intelligence', date: 'Sept 2026', time: '11:10 AM', icon: IconClock, color: '#f59e0b' },
            ].map((ev, i) => {
              const Icon = ev.icon;
              return (
                <div key={i} style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: -28,
                      top: 4,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: ev.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      boxShadow: `0 0 10px ${ev.color}40`,
                    }}
                  >
                    <Icon style={{ width: 10, height: 10 }} />
                  </div>

                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem' }}>{ev.event}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{ev.date} at {ev.time}</div>
                    </div>
                    <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: 4 }}>
                      Source: <strong>{ev.source}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'consultations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {consultations.map((c) => (
            <div key={c.id} className="card" style={{ padding: '1.25rem', background: 'var(--color-surface, #1e293b)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#f8fafc' }}>{c.type.toUpperCase()} Consultation</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Date: {c.date || 'Recent'} • Status: {c.status}</div>
                </div>
                <Link to={`/doctor/consultations/${c.id}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                  Open Workspace
                </Link>
              </div>
            </div>
          ))}
          {consultations.length === 0 && <p style={{ color: '#94a3b8' }}>No consultation records found.</p>}
        </div>
      )}

      {activeTab === 'prescriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {prescriptions.map((p) => (
            <div key={p.id} className="card" style={{ padding: '1.25rem', background: 'var(--color-surface, #1e293b)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc' }}>Prescription #{p.id}</div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Status: {p.status} • Items: {p.items_count} • Issued: {p.issued_at || 'Pending'}</div>
            </div>
          ))}
          {prescriptions.length === 0 && <p style={{ color: '#94a3b8' }}>No prescription records found.</p>}
        </div>
      )}

      {activeTab === 'followups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {followUps.map((f) => (
            <div key={f.id} className="card" style={{ padding: '1.25rem', background: 'var(--color-surface, #1e293b)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#f8fafc' }}>Review Target: {f.due_date}</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Status: {f.status} • Instruction: {f.instruction}</div>
                </div>
                <Link to={`/doctor/follow-up/${f.id}`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  Evaluate
                </Link>
              </div>
            </div>
          ))}
          {followUps.length === 0 && <p style={{ color: '#94a3b8' }}>No follow-up plans found.</p>}
        </div>
      )}
    </div>
  );
}
