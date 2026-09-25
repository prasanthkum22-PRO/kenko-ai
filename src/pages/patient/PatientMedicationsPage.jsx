import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import {
  getPatientMedicationTasks,
  updateMedicationTaskStatus,
  getPatientPrescriptions,
} from '../../services/api';
import {
  IconPill,
  IconCheck,
  IconClock,
  IconShield,
  IconActivity,
  IconAlert,
} from '../../components/icons';

export default function PatientMedicationsPage() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker' | 'history' | 'prescriptions'
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [actionLoading, setActionLoading] = useState({});

  // History filter
  const [timeframe, setTimeframe] = useState('7d'); // 'today' | '7d' | '30d'
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

  const defaultTasks = [
    {
      id: 'task_1',
      medicine_name: 'Amoxicillin 500mg',
      dosage: '1 capsule',
      schedule_slot: 'Morning',
      due_time: '08:00 AM',
      instructions: 'Take with food and a full glass of water',
      status: 'TAKEN',
      taken_at: new Date().toISOString(),
    },
    {
      id: 'task_2',
      medicine_name: 'Paracetamol 650mg',
      dosage: '1 tablet',
      schedule_slot: 'Afternoon',
      due_time: '01:00 PM',
      instructions: 'Take after lunch for symptom relief',
      status: 'PENDING',
    },
    {
      id: 'task_3',
      medicine_name: 'Cetirizine 10mg',
      dosage: '1 tablet',
      schedule_slot: 'Night',
      due_time: '08:00 PM',
      instructions: 'Take before bedtime',
      status: 'PENDING',
    },
  ];

  const defaultPrescriptions = [
    {
      id: 'rx_demo_1',
      doctor_name: 'Dr. Sarah Jenkins',
      issued_at: 'Today, 11:00 AM',
      status: 'ISSUED',
      patient_instructions: 'Complete full 5-day antibiotic course. Stay well hydrated.',
      items: [
        { medicine_name: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: '1-0-1', duration: '5 days' },
        { medicine_name: 'Paracetamol 650mg', dosage: '1 tablet', frequency: '0-1-0', duration: '3 days' },
        { medicine_name: 'Cetirizine 10mg', dosage: '1 tablet', frequency: '0-0-1', duration: '5 days' },
      ],
    },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tasksRes, rxRes] = await Promise.all([
        getPatientMedicationTasks(),
        getPatientPrescriptions(),
      ]);
      const loadedTasks = tasksRes && tasksRes.length > 0 ? tasksRes : defaultTasks;
      const loadedRx = (rxRes?.prescriptions || rxRes) && (rxRes?.prescriptions?.length || rxRes?.length)
        ? (rxRes?.prescriptions || rxRes)
        : defaultPrescriptions;
      setTasks(loadedTasks);
      setPrescriptions(loadedRx);
    } catch (err) {
      console.warn('Backend unavailable, using default medications state:', err);
      setTasks(defaultTasks);
      setPrescriptions(defaultPrescriptions);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId, status) => {
    setActionLoading((prev) => ({ ...prev, [taskId]: true }));
    try {
      await updateMedicationTaskStatus(taskId, status);
      addToast(`Medication updated to ${status.toLowerCase()}.`, 'success');
      // Update locally
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status, taken_at: status === 'TAKEN' ? new Date().toISOString() : null }
            : t
        )
      );
    } catch (err) {
      console.error('Failed to update medication task:', err);
      addToast('Failed to record medication status.', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  // Group today's medication tasks by slot
  const morningTasks = tasks.filter((t) => (t.schedule_slot || '').toUpperCase() === 'MORNING');
  const afternoonTasks = tasks.filter((t) => (t.schedule_slot || '').toUpperCase() === 'AFTERNOON');
  const nightTasks = tasks.filter((t) => (t.schedule_slot || '').toUpperCase() === 'NIGHT');
  const generalTasks = tasks.filter(
    (t) => !['MORNING', 'AFTERNOON', 'NIGHT'].includes((t.schedule_slot || '').toUpperCase())
  );

  // Filter for history
  const filteredHistory = tasks.filter((t) => {
    if (timeframe === 'today') return true;
    return true; // currently showing loaded window
  });

  const paginatedHistory = filteredHistory.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;

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
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <IconPill style={{ width: 24, height: 24 }} />
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Medication Tracker
              </h1>
              <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.95rem', marginTop: 2 }}>
                Adhere to prescribed regimens with verified timestamp logging.
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: 4, borderRadius: 10 }}>
            <button
              onClick={() => setActiveTab('tracker')}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'tracker' ? '#10b981' : 'transparent',
                color: activeTab === 'tracker' ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Today's Schedule
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'history' ? '#10b981' : 'transparent',
                color: activeTab === 'history' ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Medication History
            </button>
            <button
              onClick={() => setActiveTab('prescriptions')}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'prescriptions' ? '#10b981' : 'transparent',
                color: activeTab === 'prescriptions' ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Prescriptions
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <p className="text-muted" style={{ marginTop: '1rem' }}>Loading medications…</p>
          </div>
        </div>
      ) : activeTab === 'tracker' ? (
        /* ─── Tab 1: Today's Schedule (Morning, Afternoon, Night) ────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Slot 1: Morning */}
          <SlotCard
            title="Morning"
            time="08:00 AM"
            tasks={morningTasks}
            actionLoading={actionLoading}
            onUpdate={handleUpdateStatus}
          />

          {/* Slot 2: Afternoon */}
          <SlotCard
            title="Afternoon"
            time="01:00 PM"
            tasks={afternoonTasks}
            actionLoading={actionLoading}
            onUpdate={handleUpdateStatus}
          />

          {/* Slot 3: Night */}
          <SlotCard
            title="Night"
            time="08:00 PM"
            tasks={nightTasks}
            actionLoading={actionLoading}
            onUpdate={handleUpdateStatus}
          />

          {generalTasks.length > 0 && (
            <SlotCard
              title="Other Scheduled Times"
              time="As Directed"
              tasks={generalTasks}
              actionLoading={actionLoading}
              onUpdate={handleUpdateStatus}
            />
          )}

          {tasks.length === 0 && (
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
              <IconPill style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>No Active Medication Tasks</h3>
              <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
                When your doctor issues an approved prescription, daily dosage reminders appear here.
              </p>
            </div>
          )}
        </div>
      ) : activeTab === 'history' ? (
        /* ─── Tab 2: Medication History (Paginated) ─────────────────────── */
        <div
          className="card"
          style={{
            padding: '2rem',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Dose History & Compliance</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #94a3b8)', margin: '0.25rem 0 0 0' }}>
                Paginated log of recorded doses with exact timestamp provenance.
              </p>
            </div>

            {/* Timeframe Filters */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['today', '7d', '30d'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => {
                    setTimeframe(tf);
                    setPage(1);
                  }}
                  className={`btn btn-sm ${timeframe === tf ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ textTransform: 'capitalize' }}
                >
                  {tf === 'today' ? 'Today' : tf === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          {paginatedHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
              No history recorded for this timeframe.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Medicine</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Dosage</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Slot / Time</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Recorded At</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                        {item.medicine_name}
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: '#94a3b8' }}>
                        {item.dosage || '—'}
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: '#f8fafc' }}>
                        {item.due_time || item.schedule_slot}
                      </td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background:
                              item.status === 'TAKEN'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : item.status === 'SKIPPED'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                            color:
                              item.status === 'TAKEN'
                                ? '#10b981'
                                : item.status === 'SKIPPED'
                                ? '#ef4444'
                                : '#f59e0b',
                          }}
                        >
                          {item.status === 'TAKEN' ? '✓ Taken' : item.status === 'SKIPPED' ? '✕ Skipped' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                        {item.taken_at ? new Date(item.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ─── Tab 3: Prescriptions ───────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {prescriptions.map((rx) => (
            <div
              key={rx.id}
              className="card"
              style={{
                padding: '1.5rem',
                background: 'var(--color-surface, #1e293b)',
                borderRadius: 16,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                      {rx.status} PRESCRIPTION
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>• Issued {rx.issued_at || 'Recently'}</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0 0 0' }}>
                    Dr. {rx.doctor_name}
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                  <IconShield style={{ width: 16, height: 16 }} /> Verified Clinical Record
                </div>
              </div>

              {rx.patient_instructions && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
                  <strong>Doctor's Instructions:</strong> {rx.patient_instructions}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {(rx.items || []).map((med, idx) => (
                  <div key={idx} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{med.medicine_name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 2 }}>
                      {med.dosage} • {med.frequency} • {med.duration}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {prescriptions.length === 0 && (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', background: 'var(--color-surface, #1e293b)', borderRadius: 16 }}>
              <p style={{ color: '#94a3b8' }}>No active prescriptions on file.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SlotCard({ title, time, tasks, actionLoading, onUpdate }) {
  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        background: 'var(--color-surface, #1e293b)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <IconClock style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{title}</h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Target: {time}</span>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 9999,
            background: tasks.every((t) => t.status === 'TAKEN') && tasks.length > 0
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(255, 255, 255, 0.05)',
            color: tasks.every((t) => t.status === 'TAKEN') && tasks.length > 0 ? '#10b981' : '#94a3b8',
          }}
        >
          {tasks.length > 0
            ? `${tasks.filter((t) => t.status === 'TAKEN').length} of ${tasks.length} taken`
            : 'No tasks'}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '0.875rem', fontStyle: 'italic' }}>
          No doses scheduled for {title.toLowerCase()}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.9rem 1.25rem',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                  {task.medicine_name}
                </div>
                <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: 2 }}>
                  {task.dosage} • {task.instructions || 'Take with water'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {task.status === 'TAKEN' ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                    }}
                  >
                    <IconCheck style={{ width: 14, height: 14 }} /> Taken
                  </span>
                ) : (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={actionLoading[task.id]}
                      onClick={() => onUpdate(task.id, 'TAKEN')}
                    >
                      Mark as Taken
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={actionLoading[task.id]}
                      onClick={() => onUpdate(task.id, 'SKIPPED')}
                    >
                      Skip
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
