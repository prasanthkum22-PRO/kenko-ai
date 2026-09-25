/**
 * Admin — Doctor Application Review Page
 * Shows full application detail and provides Approve/Reject/Request Info actions.
 * Requires confirmation before any irreversible action.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import {
  adminGetApplication, adminApproveApplication,
  adminRejectApplication, adminRequestMoreInfo,
} from '../../services/api';
import {
  IconStethoscope, IconBadgeCheck, IconThumbsUp, IconThumbsDown,
  IconMessageSquare, IconGlobe, IconTag, IconClock,
} from '../../components/icons';

export default function AdminApplicationReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // 'approve' | 'reject' | 'request_info'
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    adminGetApplication(id)
      .then(setApp)
      .catch(() => toastError('Application not found', 'Error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async () => {
    if ((action === 'reject' || action === 'request_info') && !reason.trim()) {
      toastError('Please provide a reason/message.', 'Required');
      return;
    }
    setSubmitting(true);
    try {
      if (action === 'approve') {
        await adminApproveApplication(id);
        success('Application approved! Doctor profile created.', 'Approved');
      } else if (action === 'reject') {
        await adminRejectApplication(id, reason);
        success('Application rejected.', 'Rejected');
      } else if (action === 'request_info') {
        await adminRequestMoreInfo(id, reason);
        success('Additional information requested.', 'Requested');
      }
      navigate('/admin/doctors/applications');
    } catch (err) {
      toastError(err?.response?.data?.detail || 'Action failed.', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="page-container flex items-center justify-center min-h-64">
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  if (!app) return (
    <div className="page-container text-center py-16">
      <p className="text-muted">Application not found.</p>
      <button className="btn btn-secondary mt-4" onClick={() => navigate(-1)}>← Back</button>
    </div>
  );

  const statusColor = {
    PENDING: 'var(--color-warning)',
    UNDER_REVIEW: 'var(--color-info)',
    APPROVED: 'var(--color-success)',
    REJECTED: 'var(--color-error)',
    REQUIRES_MORE_INFORMATION: 'var(--color-warning)',
  }[app.status] || 'var(--color-text-secondary)';

  return (
    <div className="page-container max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button className="btn btn-secondary text-xs" onClick={() => navigate(-1)}>← Back</button>
        <div>
          <h1 className="text-lg font-bold">Application Review</h1>
          <p className="text-xs text-muted">Review professional credentials and verify before approving</p>
        </div>
      </div>

      {/* Status Banner */}
      <div className="glass-card-flat p-4 mb-5 flex items-center gap-3" style={{ borderLeft: `4px solid ${statusColor}` }}>
        <span className="badge text-xs font-bold" style={{ color: statusColor, background: `${statusColor}15` }}>
          ● {app.status.replace(/_/g, ' ')}
        </span>
        {app.review_message && (
          <span className="text-xs text-muted">Last message: {app.review_message}</span>
        )}
      </div>

      {/* Applicant Info */}
      <div className="glass-card-flat p-6 mb-5">
        <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><IconStethoscope size={16} /> Applicant Profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['Full Name', app.full_name],
            ['Email', app.email],
            ['Phone', app.phone || '—'],
            ['Date of Birth', app.date_of_birth || '—'],
            ['Medical Degree', app.medical_degree],
            ['Specialization', app.specialization],
            ['Registration No.', app.registration_number],
            ['Years of Experience', `${app.years_of_experience} years`],
            ['Organization', app.organization || '—'],
          ].map(([label, val]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted">{label}</span>
              <span className="text-xs font-semibold">{val}</span>
            </div>
          ))}
        </div>

        {app.professional_bio && (
          <div className="mt-4">
            <p className="text-xs text-muted mb-1">Professional Bio</p>
            <p className="text-xs text-secondary p-3 glass-card-flat rounded-lg">{app.professional_bio}</p>
          </div>
        )}

        {app.languages?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted mb-1 flex items-center gap-1"><IconGlobe size={12} /> Languages</p>
            <div className="flex flex-wrap gap-1">
              {app.languages.map(l => <span key={l} className="badge badge-secondary text-xs">{l}</span>)}
            </div>
          </div>
        )}

        {app.areas_of_practice?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted mb-1 flex items-center gap-1"><IconTag size={12} /> Areas of Practice</p>
            <div className="flex flex-wrap gap-1">
              {app.areas_of_practice.map(a => <span key={a} className="badge badge-primary text-xs">{a}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="glass-card-flat p-5 mb-5">
        <h2 className="font-bold text-sm mb-3">Submitted Documents</h2>
        <div className="flex flex-col gap-2">
          {[
            ['Qualification Document', app.has_qualification_doc],
            ['Registration Certificate', app.has_registration_doc],
            ['Profile Photo', app.has_profile_photo],
          ].map(([label, present]) => (
            <div key={label} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <span className="text-xs font-medium">{label}</span>
              <span className={`badge text-xs ${present ? 'badge-primary' : 'badge-secondary'}`}>
                {present ? '✓ Uploaded' : 'Not uploaded'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">
          ⚠️ Document contents are stored securely server-side and only accessible to administrators.
        </p>
      </div>

      {/* Actions (only if not already resolved) */}
      {!['APPROVED', 'REJECTED'].includes(app.status) && (
        <div className="glass-card-flat p-6">
          <h2 className="font-bold text-sm mb-4">Admin Decision</h2>

          {!action && (
            <div className="flex flex-col gap-3">
              <button
                className="btn btn-primary flex items-center gap-2 justify-center"
                onClick={() => setAction('approve')}
              >
                <IconThumbsUp size={16} /> Approve Doctor Application
              </button>
              <button
                className="btn btn-secondary flex items-center gap-2 justify-center"
                onClick={() => setAction('request_info')}
              >
                <IconMessageSquare size={16} /> Request More Information
              </button>
              <button
                className="btn btn-ghost flex items-center gap-2 justify-center text-error"
                onClick={() => setAction('reject')}
              >
                <IconThumbsDown size={16} /> Reject Application
              </button>
            </div>
          )}

          {action === 'approve' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-lg" style={{ background: 'var(--color-success-light, #dcfce7)', border: '1px solid var(--color-success)' }}>
                <p className="text-sm font-bold text-success mb-1">⚠️ Confirm Approval</p>
                <p className="text-xs text-secondary">
                  Approving this application will:
                </p>
                <ul className="text-xs text-secondary mt-1 list-disc ml-4">
                  <li>Change the applicant's role to <strong>DOCTOR</strong></li>
                  <li>Create a public verified doctor profile</li>
                  <li>Grant access to the Doctor Dashboard, consultations, and posts</li>
                  <li>Send an approval notification to the applicant</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <button className="btn btn-primary flex-1 flex items-center gap-2 justify-center" onClick={handleAction} disabled={submitting}>
                  {submitting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <IconBadgeCheck size={16} />}
                  Confirm Approval
                </button>
                <button className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
              </div>
            </div>
          )}

          {(action === 'reject' || action === 'request_info') && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">
                  {action === 'reject' ? 'Rejection Reason' : 'Information Required'} <span className="text-error">*</span>
                </label>
                <textarea
                  className="input"
                  rows={4}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={action === 'reject'
                    ? 'Please explain why this application cannot be approved...'
                    : 'Describe what additional information is required...'}
                />
              </div>
              <div className="flex gap-3">
                <button
                  className={`btn flex-1 flex items-center gap-2 justify-center ${action === 'reject' ? 'btn-ghost text-error' : 'btn-primary'}`}
                  onClick={handleAction}
                  disabled={submitting || !reason.trim()}
                >
                  {submitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                  {action === 'reject' ? 'Confirm Rejection' : 'Send Request'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setAction(null); setReason(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {['APPROVED', 'REJECTED'].includes(app.status) && (
        <div className="glass-card-flat p-4" style={{ borderLeft: `3px solid ${statusColor}` }}>
          <p className="text-xs font-semibold" style={{ color: statusColor }}>
            This application has been {app.status.toLowerCase()}.
          </p>
          {app.reviewed_at && (
            <p className="text-xs text-muted mt-1">
              Decision made: {new Date(app.reviewed_at).toLocaleString('en-IN')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
