import { useState, useEffect } from 'react';
import { getLabTasks, updateLabTaskStatus } from '../../services/api';
import { IconRefresh, IconFlask, IconX, IconUpload, IconCheck } from '../../components/icons';

const LAB_STATUSES = [
  'Requested',
  'Sample Collected',
  'Processing',
  'Completed',
  'Result Uploaded',
  'Reviewed',
];

export default function LabDashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [resultInput, setResultInput] = useState('');

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getLabTasks();
        if (active) setTasks(data || []);
      } catch (err) {
        console.error('Failed to load lab tasks:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const handleStatusAdvance = async (task, nextStatus) => {
    try {
      await updateLabTaskStatus(task.id, nextStatus, task.result_summary);
      const refreshed = await getLabTasks();
      setTasks(refreshed || []);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSaveResult = async (e) => {
    e.preventDefault();
    if (!activeTask) return;

    try {
      await updateLabTaskStatus(activeTask.id, 'Result Uploaded', resultInput);
      setActiveTask(null);
      setResultInput('');
      const refreshed = await getLabTasks();
      setTasks(refreshed || []);
    } catch (err) {
      console.error('Failed to upload result:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton skeleton-text" style={{ width: 260, height: 30 }} />
        <div className="skeleton skeleton-card" style={{ height: 380 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="lab-dashboard">
      <div className="page-header">
        <div>
          <span className="badge badge-primary">Pathology &amp; Diagnostics</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Clinical Laboratory Queue
          </h1>
          <p className="page-subtitle">
            Investigations requested in consultation, tracked through the specimen processing pipeline.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>
          <IconRefresh size={15} /> Refresh queue
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <IconFlask />
          </div>
          <h3 className="empty-title">No lab tests currently queued</h3>
          <p className="empty-description">
            Specimen and test orders requested during consultations will appear here for processing.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tasks.map((task) => {
            const currentIdx = LAB_STATUSES.indexOf(task.status);
            return (
              <section key={task.id} className="section-card">
                <div className="section-card-body" style={{ paddingBottom: 16 }}>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <h3 className="font-semibold" style={{ fontSize: 'var(--font-size-md)' }}>{task.test_name}</h3>
                      <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
                        Patient: <strong>{task.patient_name}</strong> ({task.patient_id}) &middot; Ordered by:{' '}
                        <strong>{task.requesting_doctor}</strong>
                      </p>
                      <p className="text-xs text-muted" style={{ marginTop: 2 }}>Clinical indication: {task.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-badge status-${task.status.toLowerCase().replace(/ /g, '_')}`}>{task.status}</span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setActiveTask(task);
                          setResultInput(task.result_summary || '');
                        }}
                        id={`enter-result-${task.id}`}
                      >
                        Enter result
                      </button>
                    </div>
                  </div>

                  <div className="state-machine-tracker" style={{ marginTop: 16 }} aria-label={`Status for ${task.test_name}`}>
                    {LAB_STATUSES.map((st, i) => {
                      const isDone = i < currentIdx;
                      const isCurrent = i === currentIdx;
                      return (
                        <button
                          key={st}
                          type="button"
                          className={`state-step ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                          onClick={() => handleStatusAdvance(task, st)}
                          title={`Set status to ${st}`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
                        >
                          <span className="state-step-num">
                            {isDone ? <IconCheck size={13} /> : i + 1}
                          </span>
                          <span className="state-step-label">{st}</span>
                        </button>
                      );
                    })}
                  </div>

                  {task.result_summary && (
                    <div className="alert alert-info" style={{ marginTop: 14 }}>
                      <IconUpload size={15} />
                      <div className="flex-1">
                        <strong>Lab report summary</strong>
                        <div className="text-sm" style={{ marginTop: 2 }}>{task.result_summary}</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {activeTask && (
        <div className="modal-backdrop" onClick={() => setActiveTask(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lab-result-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" id="lab-result-title">Enter lab result</h2>
              <button type="button" className="modal-close" onClick={() => setActiveTask(null)} aria-label="Close">
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>
                {activeTask.test_name} for {activeTask.patient_name} ({activeTask.patient_id})
              </p>
              <form onSubmit={handleSaveResult} className="flex flex-col gap-3">
                <div>
                  <label className="form-label">Diagnostic finding / values</label>
                  <textarea
                    className="input"
                    rows={3}
                    required
                    placeholder="e.g. Fasting Glucose: 118 mg/dL..." 
                    value={resultInput}
                    onChange={(e) => setResultInput(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTask(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" onClick={handleSaveResult} disabled={!resultInput.trim()}>
                <IconUpload size={15} /> Upload report &amp; notify doctor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}