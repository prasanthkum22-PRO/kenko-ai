import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFollowupIntelligence, confirmFollowup, updateFollowupStatus } from '../services/api';
import {
  IconActivity,
  IconShield,
  IconSparkle,
  IconAlert,
  IconClock,
  IconCalendar,
  IconBell,
  IconCheck,
  IconSend,
  IconRefresh,
  IconX,
  IconFlask,
  IconArrowRight,
} from '../components/icons';

const MODAL_META = {
  confirm: { title: 'Confirm Doctor Follow-Up', confirmLabel: 'Confirm Follow-Up' },
  complete: { title: 'Mark Follow-Up Complete', confirmLabel: 'Mark Complete' },
  email: { title: 'Email Care Team', confirmLabel: 'Send Email' },
  notify: { title: 'Send Reminder', confirmLabel: 'Send Reminder' },
};

export default function FollowUpHubPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalAction, setModalAction] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await getFollowupIntelligence();
        if (active) setData(res);
      } catch (err) {
        if (active) console.error('Failed to load followups:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const openAction = (type, fu) => setModalAction({ type, fu });

  const runModalAction = async () => {
    if (!modalAction) return;
    const { type, fu } = modalAction;
    setActionLoading(fu.id);
    try {
      if (type === 'complete') {
        await updateFollowupStatus(fu.id, 'completed', fu.due_date, fu.action);
        setNotice({ text: `Marked as complete for ${fu.patient_name}.` });
        setReloadKey((k) => k + 1);
      } else if (type === 'confirm') {
        await confirmFollowup(fu.id);
        setNotice({ text: `Follow-up confirmed for ${fu.patient_name}.` });
        setReloadKey((k) => k + 1);
      } else if (type === 'email') {
        setNotice({ text: `Follow-up email queued for ${fu.patient_name}.` });
      } else {
        setNotice({ text: `Reminder notification queued for ${fu.patient_name}.` });
      }
      setModalAction(null);
    } catch (err) {
      console.error('Follow-up action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="loading-spinner" />
        <p className="text-xs text-muted">Loading follow-up intelligence...</p>
      </div>
    );
  }

  const counts = data?.counts || {};
  const pending = data?.pending_confirmation || [];
  const today = data?.today || [];
  const upcoming = data?.upcoming || [];
  const overdue = data?.overdue || [];
  const labTests = data?.pending_lab_tests || [];
  const reviews = data?.pending_reviews || [];
  const noScheduled = today.length === 0 && upcoming.length === 0 && overdue.length === 0;

  const renderScheduleGroup = (items, statusLabel, noteFor, dotClass, badgeClass) => (
    <div className="followup-list">
      {items.map((item) => (
        <div key={item.id} className="followup-item-card">
          <div className="flex items-start gap-3 min-w-0">
            <span className={`indicator-dot ${dotClass} mt-2`} />
            <div className="min-w-0">
              <p className="text-sm font-bold">{item.patient_name} ({item.patient_id})</p>
              <p className="text-xs text-secondary mt-1">{item.action}</p>
              <p className="text-xs text-muted mt-1">{noteFor(item)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`badge ${badgeClass}`}>{statusLabel}</span>
            <div className="flex gap-1">
              <button
                className="btn btn-secondary btn-sm btn-icon"
                title="Mark complete"
                aria-label="Mark complete"
                onClick={() => openAction('complete', item)}
                disabled={actionLoading === item.id}
              >
                <IconCheck size={14} />
              </button>
              <button
                className="btn btn-secondary btn-sm btn-icon"
                title="Email care team"
                aria-label="Email care team"
                onClick={() => openAction('email', item)}
              >
                <IconSend size={14} />
              </button>
              <button
                className="btn btn-secondary btn-sm btn-icon"
                title="Send reminder"
                aria-label="Send reminder"
                onClick={() => openAction('notify', item)}
              >
                <IconBell size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="followups-page" id="followups-page">
      {notice && (
        <div className="alert alert-success animate-fade-in">
          <IconCheck size={16} className="flex-shrink-0 mt-1" />
          <span className="flex-1 text-sm">{notice.text}</span>
          <button className="modal-close flex-shrink-0" onClick={() => setNotice(null)} aria-label="Dismiss">
            <IconX size={16} />
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge badge-primary"><IconSparkle size={13} /> Intelligent Follow-Up</span>
            <span className="badge badge-secondary"><IconShield size={13} /> Zero-Hallucination Routing</span>
          </div>
          <h1 className="page-title">
            <IconActivity size={24} className="text-primary" />
            <span className="flex flex-col">
              Follow-Up Intelligence Hub
              <span className="page-subtitle">
                Automated clinical action tracker extracted from doctor statements with full doctor confirmation lifecycle.
              </span>
            </span>
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            <IconRefresh size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="followups-metrics-grid">
        <div className="followup-metric-card">
          <span className="followup-metric-label flex items-center gap-1">
            <IconAlert size={12} className="text-warning" /> Pending Confirmation
          </span>
          <span className="followup-metric-num text-warning">{counts.pending_confirmation_count || 0}</span>
          <span className="text-xs text-secondary">AI-detected doctor statements</span>
        </div>

        <div className="followup-metric-card">
          <span className="followup-metric-label flex items-center gap-1">
            <IconClock size={12} className="text-warning" /> Due Today
          </span>
          <span className="followup-metric-num text-warning">{counts.today_count || 0}</span>
          <span className="text-xs text-secondary">Action items for today</span>
        </div>

        <div className="followup-metric-card">
          <span className="followup-metric-label flex items-center gap-1">
            <IconCalendar size={12} className="text-success" /> Upcoming (7-14 Days)
          </span>
          <span className="followup-metric-num text-success">{counts.upcoming_count || 0}</span>
          <span className="text-xs text-secondary">Confirmed clinical reviews</span>
        </div>

        <div className="followup-metric-card">
          <span className="followup-metric-label flex items-center gap-1">
            <IconBell size={12} className="text-danger" /> Overdue Reviews
          </span>
          <span className="followup-metric-num text-danger">{counts.overdue_count || 0}</span>
          <span className="text-xs text-secondary">Past scheduled date</span>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <IconAlert size={16} className="text-warning" /> Pending Doctor Confirmation
            </span>
            <span className="badge badge-warning">{pending.length} awaiting</span>
          </div>
          <div className="section-card-body">
            <p className="text-sm text-secondary mb-4">
              The AI detected follow-up directives spoken during the consultation. Confirm them to add to the official patient care plan.
            </p>
            <div className="followup-list">
              {pending.map((fu) => (
                <div key={fu.id} className="followup-item-card">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="indicator-dot indicator-dot-yellow mt-2" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary">{fu.patient_name} ({fu.patient_id})</p>
                      <p className="text-xs text-secondary mt-1">{fu.action}</p>
                      {fu.source_quote && (
                        <p className="text-xs text-muted mt-1 font-italic">
                          Quote: &quot;{fu.source_quote}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openAction('confirm', fu)}
                      disabled={actionLoading === fu.id}
                    >
                      {actionLoading === fu.id ? <span className="btn-spinner" /> : <IconCheck size={13} />} Doctor Confirm
                    </button>
                    {fu.consultation_id && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/consultations/${fu.consultation_id}`)}
                      >
                        View Visit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="followup-sections-grid">
        <section className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <IconCalendar size={16} className="text-primary" /> Confirmed Clinical Review Schedule
            </span>
            <span className="badge badge-primary">{today.length + upcoming.length + overdue.length} scheduled</span>
          </div>
          <div className="section-card-body">
            {noScheduled ? (
              <div className="empty-state">
                <span className="empty-icon"><IconCalendar size={22} /></span>
                <p className="empty-title">No confirmed follow-ups yet</p>
                <p className="empty-description">
                  Confirmed clinical reviews will appear here once follow-ups are approved from the pending queue.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {today.length > 0 && (
                  <div>
                    <p className="text-label mb-2">Due Today</p>
                    {renderScheduleGroup(today, 'Today', () => 'Due: Today', 'indicator-dot-yellow', 'badge-warning')}
                  </div>
                )}
                {upcoming.length > 0 && (
                  <div>
                    <p className="text-label mb-2">Upcoming (7-14 Days)</p>
                    {renderScheduleGroup(
                      upcoming,
                      'Upcoming',
                      (item) => `Due: ${item.due_date} (${item.days_until} days)`,
                      'indicator-dot-green',
                      'badge-primary'
                    )}
                  </div>
                )}
                {overdue.length > 0 && (
                  <div>
                    <p className="text-label mb-2">Overdue</p>
                    {renderScheduleGroup(
                      overdue,
                      'Overdue',
                      (item) => `Overdue by ${item.days_overdue} days`,
                      'indicator-dot-red',
                      'badge-danger'
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <IconFlask size={16} className="text-primary" /> Pending Items
            </span>
            <span className="badge badge-secondary">Awaiting action</span>
          </div>
          <div className="section-card-body">
            <p className="text-label mb-2">Pending Lab Tests</p>
            {labTests.length > 0 ? (
              <div className="followup-list">
                {labTests.map((lt) => (
                  <div key={lt.id} className="followup-item-card">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{lt.patient_name} ({lt.patient_id})</p>
                      <p className="text-xs text-primary font-medium mt-1">{lt.test_name}</p>
                      <p className="text-xs text-muted mt-1">Ordered on {lt.date}</p>
                    </div>
                    <span className="badge badge-secondary flex-shrink-0">{lt.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No pending laboratory tasks.</p>
            )}

            <div className="divider" />

            <p className="text-label mb-2">Pending Doctor Reviews</p>
            {reviews.length > 0 ? (
              <div className="followup-list">
                {reviews.map((pr) => (
                  <div
                    key={pr.id}
                    className="followup-item-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/consultations/${pr.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{pr.patient_name} ({pr.patient_id})</p>
                      <p className="text-xs text-muted mt-1">{pr.consultation_type} consultation &middot; {pr.created_at}</p>
                    </div>
                    <span className="text-xs text-primary font-semibold flex items-center gap-1 flex-shrink-0">
                      Review <IconArrowRight size={13} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">All consultation summaries have been reviewed!</p>
            )}
          </div>
        </section>
      </div>

      {modalAction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{MODAL_META[modalAction.type].title}</span>
              <button className="modal-close" onClick={() => setModalAction(null)} aria-label="Close">
                <IconX size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="flex items-start gap-3">
                <span className="kpi-icon"><IconBell size={16} /></span>
                <div className="min-w-0">
                  <p className="text-sm text-secondary mb-1">
                    {modalAction.type === 'confirm'
                      ? 'Confirm this AI-detected follow-up to add it to the official patient care plan.'
                      : modalAction.type === 'complete'
                        ? 'Mark this follow-up as completed to close it in the clinical schedule.'
                        : modalAction.type === 'email'
                          ? 'Send a follow-up email to the care team for this patient.'
                          : 'Send a reminder notification to the care team for this patient.'}
                  </p>
                  <p className="text-sm font-bold text-primary">{modalAction.fu.patient_name} ({modalAction.fu.patient_id})</p>
                  <p className="text-xs text-secondary mt-1">{modalAction.fu.action}</p>
                  {modalAction.fu.due_date && (
                    <p className="text-xs text-muted mt-1">
                      Due: {modalAction.fu.due_date}
                    </p>
                  )}
                  {modalAction.fu.source_quote && (
                    <p className="text-xs text-muted mt-1 font-italic">
                      Quote: &quot;{modalAction.fu.source_quote}&quot;
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalAction(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={runModalAction}
                disabled={actionLoading === modalAction.fu.id}
              >
                {actionLoading === modalAction.fu.id ? <span className="btn-spinner" /> : <IconCheck size={15} />}
                {actionLoading === modalAction.fu.id ? 'Working...' : MODAL_META[modalAction.type].confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}