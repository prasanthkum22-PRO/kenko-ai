import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoctorWorkspace, getConsultations, getLabTasks } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
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
} from '../../components/icons';

export default function DoctorWorkspace() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [labTasks, setLabTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const wsData = await getDoctorWorkspace();
        const cList = await getConsultations();
        const lList = await getLabTasks();
        if (!active) return;
        setWorkspace(wsData);
        setConsultations(cList || []);
        setLabTasks(lList || []);
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
  const pendingVerification = consultations.filter((c) => !c.is_approved).length;
  const pendingLab = labTasks.filter((l) => l.status !== 'Reviewed' && l.status !== 'Completed').length;

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
          <span className="badge badge-primary">Clinician Workspace</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Welcome, {user?.name || 'Dr. Aarav Patel'}
          </h1>
          <p className="page-subtitle">
            AI-assisted clinical workflow with verifiable SOAP summaries and ambient speech capture.
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
          <button className="btn btn-secondary" onClick={() => navigate('/consultations/in-person')} id="start-ambient-record-btn">
            <IconMic size={16} /> Ambient In-Person
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/prescriptions')}>
            <IconRx size={16} /> Prescriptions
          </button>
        </div>
      </div>

      <div className="kpi-grid">
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
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconUsers />
          </div>
          <span className="kpi-label">Active patients</span>
          <span className="kpi-value">{metrics.active_patients || 12}</span>
          <span className="kpi-foot">Unique medical profiles</span>
        </div>
      </div>

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