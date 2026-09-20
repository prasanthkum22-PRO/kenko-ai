import { useState, useEffect } from 'react';
import { getLabTasks, updateLabTaskStatus } from '../../services/api';
import { getLabRequests } from '../../services/firestoreService';
import { useToast } from '../../context/ToastContext';
import { IconRefresh, IconFlask, IconX, IconUpload, IconCheck, IconStethoscope } from '../../components/icons';

const LAB_STAGES = [
  'Requested',
  'Sample Collected',
  'Processing',
  'Completed',
  'Result Uploaded',
  'Reviewed',
];

export default function LabWorkspace() {
  const { success } = useToast();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [resultInput, setResultInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        let data = [];
        try {
          data = await getLabTasks();
        } catch {
          data = await getLabRequests();
        }
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

  const handleAdvanceStatus = async (task, nextStatus) => {
    try {
      await updateLabTaskStatus(task.id, nextStatus, task.result_summary);
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    }
    success(`Test status updated to "${nextStatus}"`, 'Status Updated');
  };

  const handleSaveResult = async (e) => {
    e.preventDefault();
    if (!selectedTask || !resultInput.trim()) return;

    try {
      await updateLabTaskStatus(selectedTask.id, 'Result Uploaded', resultInput);
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id ? { ...t, status: 'Result Uploaded', result_summary: resultInput } : t
        )
      );
    }
    success(`Diagnostic results uploaded for ${selectedTask.test_name}`, 'Results Committed');
    setSelectedTask(null);
    setResultInput('');
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  const pendingCount = tasks.filter((t) => t.status === 'Requested').length;
  const collectedCount = tasks.filter((t) => t.status === 'Sample Collected').length;
  const processingCount = tasks.filter((t) => t.status === 'Processing').length;
  const completedCount = tasks.filter((t) => t.status === 'Completed' || t.status === 'Result Uploaded').length;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton skeleton-text" style={{ width: 280, height: 30 }} />
        <div className="kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="skeleton skeleton-card" style={{ height: 340 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="lab-workspace">
      <div className="page-header">
        <div>
          <span className="badge badge-primary">Pathology &amp; Diagnostics</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Clinical Diagnostic Test Queue
          </h1>
          <p className="page-subtitle">
            Manage specimens through the clinical pathology pipeline from request to clinician review.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>
          <IconRefresh size={15} /> Refresh test orders
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconFlask />
          </div>
          <span className="kpi-label">Pending orders</span>
          <span className="kpi-value">{pendingCount}</span>
          <span className="kpi-foot">Awaiting specimen collection</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconStethoscope />
          </div>
          <span className="kpi-label">Samples collected</span>
          <span className="kpi-value">{collectedCount}</span>
          <span className="kpi-foot">In transit to analyzer</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconUpload />
          </div>
          <span className="kpi-label">Tests processing</span>
          <span className="kpi-value">{processingCount}</span>
          <span className="kpi-foot">Active lab instruments</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconCheck />
          </div>
          <span className="kpi-label">Completed reports</span>
          <span className="kpi-value">{completedCount}</span>
          <span className="kpi-foot">Ready for clinician review</span>
        </div>
      </div>

      <section className="section-card">
        <div className="section-card-header">
          <div>
            <h2 className="section-card-title">Active diagnostic orders</h2>
            <p className="card-subtitle">Specimen &amp; test pipeline for requested investigations</p>
          </div>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 200 }}
            aria-label="Filter by status"
          >
            <option value="all">All statuses ({tasks.length})</option>
            <option value="Requested">Requested ({pendingCount})</option>
            <option value="Sample Collected">Sample Collected ({collectedCount})</option>
            <option value="Processing">Processing ({processingCount})</option>
            <option value="Result Uploaded">Result Uploaded ({completedCount})</option>
          </select>
        </div>

        <div className="section-card-body" style={{ paddingTop: 16 }}>
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <IconFlask />
              </div>
              <h3 className="empty-title">No orders match this filter</h3>
              <p className="empty-description">Adjust the status filter or refresh the queue to see the latest orders.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredTasks.map((task) => {
                const currentIdx = LAB_STAGES.indexOf(task.status);
                return (
                  <div key={task.id} className="glass-card-flat" style={{ padding: 16 }}>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <p className="font-semibold" style={{ fontSize: 'var(--font-size-md)' }}>{task.test_name}</p>
                        <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
                          Patient: <strong>{task.patient_name}</strong> ({task.patient_id}) &middot; Ordered by:{' '}
                          <strong>{task.requesting_doctor || task.requestingDoctor || 'Attending Physician'}</strong>
                        </p>
                        <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                          Indication: {task.reason || 'Clinical evaluation'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`status-badge status-${task.status.toLowerCase().replace(/ /g, '_')}`}>
                          {task.status}
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setResultInput(task.result_summary || '');
                          }}
                        >
                          Enter results
                        </button>
                      </div>
                    </div>

                    <div className="state-machine-tracker" style={{ marginTop: 16 }}>
                      {LAB_STAGES.map((st, i) => {
                        const isDone = i < currentIdx;
                        const isCurrent = i === currentIdx;
                        return (
                          <button
                            key={st}
                            type="button"
                            className={`state-step ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                            onClick={() => handleAdvanceStatus(task, st)}
                            title={`Set status to ${st}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
                          >
                            <span className="state-step-num">{isDone ? <IconCheck size={13} /> : i + 1}</span>
                            <span className="state-step-label">{st}</span>
                          </button>
                        );
                      })}
                    </div>

                    {task.result_summary && (
                      <div className="alert alert-info" style={{ marginTop: 14 }}>
                        <IconUpload size={15} />
                        <div className="flex-1">
                          <strong>Diagnostic report summary</strong>
                          <div className="text-sm" style={{ marginTop: 2 }}>{task.result_summary}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedTask && (
        <div className="modal-backdrop" onClick={() => setSelectedTask(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lab-result-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" id="lab-result-title">Enter diagnostic results</h2>
              <button type="button" className="modal-close" onClick={() => setSelectedTask(null)} aria-label="Close">
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>
                {selectedTask.test_name} &middot; {selectedTask.patient_name} ({selectedTask.patient_id})
              </p>
              <label className="form-label" htmlFor="lab-result-input">Diagnostic finding / values</label>
              <textarea
                id="lab-result-input"
                className="input"
                rows={4}
                placeholder="Enter quantitative values, reference ranges, and diagnostic interpretation..."
                value={resultInput}
                onChange={(e) => setResultInput(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedTask(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" onClick={handleSaveResult} disabled={!resultInput.trim()}>
                <IconUpload size={15} /> Save &amp; dispatch to clinician
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}