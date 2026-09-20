import { useState, useEffect } from 'react';
import { getNurseTasks } from '../../services/api';
import { IconRefresh, IconClipboard, IconActivity, IconAlert, IconShield } from '../../components/icons';

const PRIORITY_BADGE = {
  high: 'badge-danger',
  urgent: 'badge-danger',
  normal: 'badge-warning',
  medium: 'badge-warning',
  low: 'badge-secondary',
};

export default function NurseDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await getNurseTasks();
        if (active) setData(res);
      } catch (err) {
        console.error('Failed to load nurse tasks:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const tasks = data?.pending_tasks || [];
  const carePlans = data?.active_care_plans || [];
  const highPriority = tasks.filter((t) => t.priority === 'high' || t.priority === 'urgent').length;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton skeleton-text" style={{ width: 280, height: 30 }} />
        <div className="skeleton skeleton-card" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="nurse-dashboard">
      <div className="page-header">
        <div>
          <span className="badge badge-primary">Nursing Care Portal</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Care Directives
          </h1>
          <p className="page-subtitle">
            Monitoring tasks, allergy alerts, vital sign intervals and medication administration directives.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>
          <IconRefresh size={15} /> Refresh orders
        </button>
      </div>

      {highPriority > 0 && (
        <div className="alert alert-warning" role="alert">
          <IconAlert />
          <span>
            <strong>{highPriority} high-priority task{highPriority === 1 ? '' : 's'}</strong> require attention this shift.
          </span>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        <section className="section-card">
          <div className="section-card-header">
            <div>
              <h2 className="section-card-title">
                <IconClipboard size={16} /> Active nursing tasks
              </h2>
              <p className="card-subtitle">Directives assigned for this shift</p>
            </div>
          </div>
          <div className="section-card-body flex flex-col gap-3">
            {tasks.length === 0 && <p className="text-sm text-muted">No active nursing tasks assigned.</p>}
            {tasks.map((t) => (
              <div
                key={t.id}
                className="glass-card-flat"
                style={{
                  padding: '12px 14px',
                  borderLeft: `3px solid ${
                    t.priority === 'high' || t.priority === 'urgent' ? 'var(--color-danger)' : 'var(--color-warning)'
                  }`,
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <p className="font-semibold">
                    {t.patient_name} <span className="text-muted font-normal text-xs">({t.patient_id})</span>
                  </p>
                  <span className={`badge ${PRIORITY_BADGE[t.priority] || 'badge-warning'}`}>{t.priority}</span>
                </div>
                <p className="text-sm text-secondary">{t.description}</p>
                <p className="text-xs text-muted" style={{ marginTop: 4 }}>Ordered: {t.created_at}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div className="section-card-header">
            <div>
              <h2 className="section-card-title">
                <IconActivity size={16} /> Patient shift monitoring
              </h2>
              <p className="card-subtitle">Vitals, allergies and care plan overview</p>
            </div>
          </div>
          <div className="section-card-body flex flex-col gap-4">
            {carePlans.length === 0 && <p className="text-sm text-muted">No active care plans.</p>}
            {carePlans.map((cp, idx) => (
              <div key={idx} className="glass-card-flat" style={{ padding: 14 }}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{cp.patient_name}</p>
                  <span className="text-xs text-muted font-mono">{cp.date}</span>
                </div>
                <p className="text-sm text-secondary" style={{ margin: '6px 0' }}>
                  <strong>Assessed condition:</strong> {cp.condition}
                </p>
                <div className="grid grid-cols-2 gap-2" style={{ margin: '8px 0' }}>
                  <div className="glass-card-flat" style={{ padding: '8px 10px' }}>
                    <span className="text-label" style={{ fontSize: 11 }}>
                      BP
                    </span>
                    <p className="font-semibold text-sm">{cp.vitals?.bp || 'N/A'}</p>
                  </div>
                  <div className="glass-card-flat" style={{ padding: '8px 10px' }}>
                    <span className="text-label" style={{ fontSize: 11 }}>
                      Temperature
                    </span>
                    <p className="font-semibold text-sm">{cp.vitals?.temperature || 'N/A'}</p>
                  </div>
                </div>
                <p className="text-danger font-medium text-xs">
                  <IconAlert size={12} style={{ verticalAlign: '-2px' }} /> Allergy alert: {cp.allergies}
                </p>
                {(cp.nurse_view?.monitoring_instructions || []).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <p className="text-label" style={{ fontSize: 11, marginBottom: 4 }}>Shift directives</p>
                    <ul className="text-sm text-secondary list-disc" style={{ paddingLeft: 18 }}>
                      {cp.nurse_view.monitoring_instructions.map((inst, i) => (
                        <li key={i}>{inst}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="text-caption text-muted" style={{ marginTop: 4 }}>
        <IconShield size={12} style={{ verticalAlign: '-3px' }} /> All nursing orders are recorded against the patient's
        verified care plan for auditability.
      </p>
    </div>
  );
}