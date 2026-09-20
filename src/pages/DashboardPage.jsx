import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHealthStats, getFollowupIntelligence } from '../services/api';
import { getGreeting, getFirstName } from '../utils/helpers';

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ id, icon, label, value, unit, color, loading, subtitle }) {
  return (
    <div className="stat-card glass-card animate-fade-in" id={id}>
      <div className="stat-card-header">
        <div className="stat-card-icon" style={{ background: color + '22', color }}>
          {icon}
        </div>
      </div>
      <div className="stat-card-body">
        {loading ? (
          <div className="skeleton stat-skeleton" />
        ) : (
          <div className="stat-value">
            {value !== null && value !== undefined ? value : '0'}
            {unit && <span className="stat-unit">{unit}</span>}
          </div>
        )}
        <p className="stat-label">{label}</p>
        {subtitle && <p className="text-xs text-secondary mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Quick Action Card ─────────────────────────────────────────
function QuickAction({ id, icon, title, description, color, onClick }) {
  return (
    <button className="quick-action glass-card" id={id} onClick={onClick}>
      <div className="quick-action-icon" style={{ background: color + '22', color }}>
        {icon}
      </div>
      <div className="quick-action-body">
        <p className="quick-action-title">{title}</p>
        <p className="quick-action-desc text-xs text-muted">{description}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="quick-action-arrow">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [followupData, setFollowupData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsData, fuData] = await Promise.all([
          getHealthStats(),
          getFollowupIntelligence(),
        ]);
        setStats(statsData);
        setFollowupData(fuData);
      } catch (err) {
        console.warn('Dashboard data note:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const counts = followupData?.counts || {};

  const statCards = [
    {
      id: 'stat-followups-pending',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ),
      label: 'Pending Follow-Up Confirmations',
      value: counts.pending_confirmation_count || 0,
      color: '#f59e0b',
      subtitle: 'Doctor review needed',
    },
    {
      id: 'stat-followups-today',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      label: 'Follow-Ups Due Today',
      value: counts.today_count || 0,
      color: '#eab308',
      subtitle: 'Active today',
    },
    {
      id: 'stat-followups-upcoming',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      label: 'Confirmed Upcoming Reviews',
      value: counts.upcoming_count || 0,
      color: '#10b981',
      subtitle: 'Scheduled in 7-14 days',
    },
    {
      id: 'stat-total-consultations',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
      label: 'Total Consultations',
      value: stats?.total_consultations || 0,
      color: '#00d4aa',
      subtitle: 'Ambient & Telehealth',
    },
  ];

  return (
    <div className="dashboard-page" id="dashboard-page">
      {/* ── Greeting ── */}
      <div className="dashboard-greeting animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">MediBridge AI</span>
            <span className="text-xs text-muted font-italic">&quot;From Conversation to Connected Care&quot;</span>
          </div>
          <h1 className="dashboard-greeting-title">
            {getGreeting()},{' '}
            <span className="text-gradient">{getFirstName(user?.full_name || user?.email || 'Clinician')}</span>
            {'! 👋'}
          </h1>
          <p className="text-secondary">
            AI-Based Patient-Doctor Consultation Summarization &amp; Follow-Up Intelligence System.
          </p>
        </div>
        <div className="dashboard-date">
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* ── Stat Cards Highlighting Killer Feature: Follow-Up Intelligence ── */}
      <section className="stat-cards-grid stagger-children" aria-label="Follow-up intelligence statistics">
        {statCards.map((card) => (
          <StatCard key={card.id} {...card} loading={loading} />
        ))}
      </section>

      {/* ── Quick Actions ── */}
      <section className="dashboard-section animate-fade-in" aria-label="Quick actions">
        <div className="dashboard-section-header">
          <h2 className="dashboard-section-title">Core Clinical Workflows</h2>
        </div>
        <div className="quick-actions-grid stagger-children">
          <QuickAction
            id="qa-ambient-recording"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
            title="Ambient Voice Recording"
            description="Capture multilingual dialogue &amp; extract structured summary"
            color="#00d4aa"
            onClick={() => navigate('/consultations/in-person')}
          />

          <QuickAction
            id="qa-followups-hub"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            title="Follow-Up Intelligence Hub"
            description="Review, confirm and track clinical follow-up commitments"
            color="#f59e0b"
            onClick={() => navigate('/followups')}
          />
          <QuickAction
            id="qa-telehealth-video"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>}
            title="Telehealth Video Room"
            description="Encrypted browser video call with live transcription"
            color="#7c3aed"
            onClick={() => navigate('/consultations/video')}
          />
          <QuickAction
            id="qa-prescription-ocr"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>}
            title="Prescription OCR Studio"
            description="Extract text from Rx documents with human-in-the-loop review"
            color="#3b82f6"
            onClick={() => navigate('/prescriptions')}
          />
        </div>
      </section>
    </div>
  );
}
