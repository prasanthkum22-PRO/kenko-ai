/**
 * Doctor Application Status Page
 * Shown to DOCTOR_PENDING users after submission.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyDoctorApplication } from '../../services/api';
import { IconStethoscope, IconClock, IconCheckCircle, IconXCircle, IconMessageSquare } from '../../components/icons';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending Review',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-light, #fef3c7)',
    icon: IconClock,
    desc: 'Your application has been submitted and is waiting for admin review.',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    color: 'var(--color-info)',
    bg: 'var(--color-info-light, #dbeafe)',
    icon: IconStethoscope,
    desc: 'An administrator is currently reviewing your application.',
  },
  APPROVED: {
    label: 'Approved ✓',
    color: 'var(--color-success)',
    bg: 'var(--color-success-light, #dcfce7)',
    icon: IconCheckCircle,
    desc: 'Congratulations! Your application has been approved. Please log out and log back in to access your Doctor Dashboard.',
  },
  REJECTED: {
    label: 'Not Approved',
    color: 'var(--color-error)',
    bg: 'var(--color-error-light, #fee2e2)',
    icon: IconXCircle,
    desc: 'Your application was not approved at this time.',
  },
  REQUIRES_MORE_INFORMATION: {
    label: 'Additional Info Required',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-light, #fef3c7)',
    icon: IconMessageSquare,
    desc: 'The admin has requested additional information. Please review the message below and resubmit.',
  },
};

export default function DoctorApplicationStatusPage() {
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyDoctorApplication()
      .then(data => setApp(data.application))
      .catch(() => setApp(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-64">
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="page-container max-w-lg mx-auto py-12 px-4 text-center">
        <IconStethoscope size={48} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 16px' }} />
        <h1 className="text-xl font-bold mb-2">No Application Found</h1>
        <p className="text-muted text-sm mb-5">You haven't submitted a doctor application yet.</p>
        <button className="btn btn-primary" onClick={() => navigate('/apply-doctor')}>
          Apply as Doctor
        </button>
      </div>
    );
  }

  const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = config.icon;

  return (
    <div className="page-container max-w-lg mx-auto py-8 px-4">
      {/* Status Card */}
      <div className="glass-card-flat p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: config.bg }}>
            <StatusIcon size={24} style={{ color: config.color }} />
          </div>
          <div>
            <h1 className="text-lg font-bold">Application Status</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="badge text-xs font-semibold"
                style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}30` }}
              >
                ● {config.label}
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted mb-4">{config.desc}</p>

        <div className="flex flex-col gap-2 text-sm">
          {[
            ['Applicant', app.full_name],
            ['Specialization', app.specialization],
            ['Medical Degree', app.medical_degree],
            ['Registration No.', app.registration_number],
            ['Submitted', app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted text-xs">{label}</span>
              <span className="font-medium text-xs">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Admin message if present */}
      {app.review_message && (
        <div className="glass-card-flat p-5 mb-5" style={{ borderLeft: '3px solid var(--color-warning)' }}>
          <p className="text-xs font-semibold text-warning mb-1 flex items-center gap-1">
            <IconMessageSquare size={14} /> Message from Administration
          </p>
          <p className="text-sm text-secondary">{app.review_message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {app.status === 'APPROVED' && (
          <div className="glass-card-flat p-4" style={{ background: 'var(--color-success-light, #dcfce7)', borderLeft: '3px solid var(--color-success)' }}>
            <p className="text-sm font-bold text-success">🎉 You are now a Verified Doctor!</p>
            <p className="text-xs text-muted mt-1">Log out and log back in to access your full Doctor Dashboard.</p>
            <button className="btn btn-primary mt-3 text-sm" onClick={() => navigate('/doctor')}>
              Go to Doctor Dashboard →
            </button>
          </div>
        )}
        {app.status === 'REJECTED' && (
          <button className="btn btn-secondary text-sm" onClick={() => navigate('/apply-doctor')}>
            Apply Again
          </button>
        )}
        {app.status === 'REQUIRES_MORE_INFORMATION' && (
          <button className="btn btn-primary text-sm" onClick={() => navigate('/apply-doctor')}>
            Update Application
          </button>
        )}
        <button className="btn btn-secondary text-sm" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    </div>
  );
}
