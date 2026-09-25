/**
 * Doctor Follow-Up Dashboard
 * Route: /doctor/follow-up
 * Sections: All | Due Today | Upcoming | Patient Responses | Needs Review | High Priority
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoctorFollowUpDashboard } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconClock, IconAlert, IconCheck, IconActivity,
  IconUsers, IconSparkle, IconArrowRight
} from '../../components/icons';

export default function DoctorFollowUpDashboardPage() {
  const navigate = useNavigate();
  const { error: toastError } = useToast();

  const [activeFilter, setActiveFilter] = useState('all');
  const [plans, setPlans] = useState([]);
  const [counts, setCounts] = useState({ all: 0, due_today: 0, high_priority: 0, needs_review: 0 });
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDoctorFollowUpDashboard(activeFilter);
      setPlans(res.plans || []);
      setCounts(res.counts || {});
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to load follow-up plans.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, toastError]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card p-6 flex flex-wrap items-center justify-between gap-4 border-l-4 border-warning">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-warning text-xs font-semibold">Care Continuity Intelligence</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <IconClock className="text-warning" size={24} /> Doctor Follow-Up Dashboard
          </h1>
          <p className="text-xs text-muted mt-1">
            Monitor active follow-up commitments, patient condition check-in reports, and priority clinical review tasks.
          </p>
        </div>

        {/* Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-surface/60 border border-border/40 text-center">
            <p className="text-xs text-muted">Due Today</p>
            <p className="text-lg font-bold text-warning">{counts.due_today || 0}</p>
          </div>
          <div className="px-4 py-2 rounded-lg bg-error/10 border border-error/30 text-center">
            <p className="text-xs text-error">High Priority</p>
            <p className="text-lg font-bold text-error">{counts.high_priority || 0}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-3">
        {[
          { id: 'all', label: `All Plans (${counts.all || 0})` },
          { id: 'due_today', label: `Due Today (${counts.due_today || 0})` },
          { id: 'high_priority', label: `⚠️ High Priority (${counts.high_priority || 0})` },
          { id: 'needs_review', label: `Needs Review (${counts.needs_review || 0})` },
          { id: 'patient_responses', label: 'Patient Responses' },
          { id: 'upcoming', label: 'Upcoming' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`btn btn-sm ${activeFilter === tab.id ? 'btn-primary' : 'btn-outline'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Plans List */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <span className="spinner mr-3" />
          <span>Loading follow-up dashboard...</span>
        </div>
      ) : plans.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-2">
          <IconClock size={36} className="text-muted mx-auto" />
          <p className="text-muted text-sm font-semibold">No follow-up plans found for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`glass-card p-5 space-y-4 hover:border-primary/50 transition-colors flex flex-col justify-between ${
                p.is_high_priority ? 'border-error/60 bg-error/5' : ''
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{p.patient_name}</h3>
                    <p className="text-xs text-muted font-mono">ID: {p.patient_id}</p>
                  </div>
                  <span
                    className={`badge text-xs font-bold ${
                      p.latest_response === 'WORSENING'
                        ? 'badge-error animate-pulse'
                        : p.latest_response === 'SAME'
                        ? 'badge-warning'
                        : p.latest_response === 'RECOVERING'
                        ? 'badge-success'
                        : 'badge-ghost text-muted'
                    }`}
                  >
                    {p.latest_response}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-surface/50 text-xs space-y-1">
                  <p className="text-muted">Instruction:</p>
                  <p className="text-white font-medium line-clamp-2">{p.instruction}</p>
                </div>

                {p.recommended_test_name && (
                  <div className="flex items-center gap-1.5 text-xs text-info font-medium">
                    <IconActivity size={13} /> Test: {p.recommended_test_name}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">Due Date</p>
                  <p className="text-xs font-bold text-white">{p.due_date}</p>
                </div>
                <button
                  onClick={() => navigate(`/doctor/follow-up/${p.id}`)}
                  className={`btn btn-sm ${p.is_high_priority ? 'btn-error' : 'btn-primary'}`}
                >
                  Review Patient →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
