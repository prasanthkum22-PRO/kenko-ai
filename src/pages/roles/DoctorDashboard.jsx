import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoctorWorkspace } from '../../services/api';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getDoctorWorkspace();
        if (active) setWorkspace(data);
      } catch (err) {
        console.error('Failed to load doctor workspace:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const metrics = workspace?.metrics || {};
  const recent = workspace?.recent_consultations || [];
  const pending = recent.filter((c) => !c.is_approved).length;

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
          <span className="badge badge-primary">Physician Console</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {user?.name || 'Doctor'}'s Clinical Workspace
          </h1>
          <p className="page-subtitle">
            AI-assisted SOAP summaries, diagnostic approval queue and care coordination.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/consultations')} id="doctor-new-consult-btn">
            <IconPlus /> New Consultation
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
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconUsers />
          </div>
          <span className="kpi-label">Active patients</span>
          <span className="kpi-value">{metrics.active_patients || 0}</span>
          <span className="kpi-foot">Under active care</span>
        </div>
      </div>

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