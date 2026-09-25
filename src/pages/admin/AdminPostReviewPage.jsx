/**
 * Admin — Post Moderation Review Page
 * Shows full post content and provides Approve/Reject/Request Changes.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import {
  adminGetPost, adminApprovePost, adminRejectPost, adminRequestPostChanges,
} from '../../services/api';
import {
  IconDoc, IconBadgeCheck, IconThumbsUp, IconThumbsDown, IconMessageSquare,
  IconTag, IconStethoscope,
} from '../../components/icons';

export default function AdminPostReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    adminGetPost(id)
      .then(setPost)
      .catch(() => toastError('Post not found', 'Error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async () => {
    if ((action === 'reject' || action === 'changes') && !message.trim()) {
      toastError('Please provide a reason/message.', 'Required');
      return;
    }
    setSubmitting(true);
    try {
      if (action === 'approve') {
        await adminApprovePost(id);
        success('Post approved and published!', 'Published');
      } else if (action === 'reject') {
        await adminRejectPost(id, message);
        success('Post rejected.', 'Rejected');
      } else if (action === 'changes') {
        await adminRequestPostChanges(id, message);
        success('Changes requested.', 'Changes Requested');
      }
      navigate('/admin/posts');
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

  if (!post) return (
    <div className="page-container text-center py-16">
      <p className="text-muted">Post not found.</p>
      <button className="btn btn-secondary mt-4" onClick={() => navigate(-1)}>← Back</button>
    </div>
  );

  return (
    <div className="page-container max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button className="btn btn-secondary text-xs" onClick={() => navigate(-1)}>← Back</button>
        <div>
          <h1 className="text-lg font-bold">Post Review</h1>
          <p className="text-xs text-muted">Review content before publishing to the public feed</p>
        </div>
      </div>

      {/* Author Info */}
      <div className="glass-card-flat p-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <IconStethoscope size={18} style={{ color: '#fff' }} />
          </div>
          <div>
            <p className="font-semibold text-sm">{post.author?.name || 'Unknown Doctor'}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{post.author?.specialization}</span>
              {post.author?.verified && (
                <span className="badge text-xs" style={{ color: 'var(--color-success)', background: 'var(--color-success-light, #dcfce7)' }}>
                  <IconBadgeCheck size={10} /> Verified Doctor
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="glass-card-flat p-6 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="badge badge-secondary text-xs">{post.category}</span>
          {post.specialization && <span className="badge badge-primary text-xs">{post.specialization}</span>}
        </div>
        <h2 className="text-lg font-bold mb-3">{post.title}</h2>

        {post.tags?.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-3">
            <IconTag size={12} style={{ color: 'var(--color-text-secondary)' }} />
            {post.tags.map(t => <span key={t} className="badge badge-secondary text-xs">#{t}</span>)}
          </div>
        )}

        <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap p-4 glass-card-flat rounded-lg max-h-96 overflow-y-auto">
          {post.content}
        </div>

        {post.references?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted font-semibold mb-1">References</p>
            <ul className="text-xs text-secondary list-disc ml-4 flex flex-col gap-1">
              {post.references.map((ref, i) => (
                <li key={i}>{typeof ref === 'string' ? ref : ref.title || JSON.stringify(ref)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Review Checklist */}
      <div className="glass-card-flat p-5 mb-5">
        <h3 className="font-bold text-sm mb-3">Review Checklist</h3>
        <div className="flex flex-col gap-2 text-xs text-muted">
          {[
            'Content is medically relevant and professional',
            'No identifiable patient information (names, IDs, phone numbers)',
            'No private medical records or consultation transcripts',
            'No inappropriate claims or misinformation',
            'References are provided where appropriate',
            'Content does not promote unauthorized medical advice',
          ].map((item, i) => (
            <label key={i} className="flex items-start gap-2 cursor-pointer hover:text-primary transition-colors">
              <input type="checkbox" className="mt-0.5 shrink-0" />
              <span>{item}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted mt-3 p-3 rounded" style={{ background: 'var(--color-surface-alt)' }}>
          ℹ️ Approval indicates this content has been reviewed by an administrator, not that it is medically guaranteed to be correct.
        </p>
      </div>

      {/* Actions */}
      {post.status === 'PENDING_REVIEW' && (
        <div className="glass-card-flat p-6">
          <h3 className="font-bold text-sm mb-4">Moderation Decision</h3>

          {!action && (
            <div className="flex flex-col gap-3">
              <button className="btn btn-primary flex items-center gap-2 justify-center" onClick={() => setAction('approve')}>
                <IconThumbsUp size={16} /> Approve & Publish Post
              </button>
              <button className="btn btn-secondary flex items-center gap-2 justify-center" onClick={() => setAction('changes')}>
                <IconMessageSquare size={16} /> Request Changes
              </button>
              <button className="btn btn-ghost text-error flex items-center gap-2 justify-center" onClick={() => setAction('reject')}>
                <IconThumbsDown size={16} /> Reject Post
              </button>
            </div>
          )}

          {action === 'approve' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-lg" style={{ background: 'var(--color-success-light, #dcfce7)', border: '1px solid var(--color-success)' }}>
                <p className="text-sm font-bold text-success">Confirm Publication</p>
                <p className="text-xs text-secondary mt-1">This post will be immediately visible in the public feed to all users.</p>
              </div>
              <div className="flex gap-3">
                <button className="btn btn-primary flex-1 flex items-center gap-2 justify-center" onClick={handleAction} disabled={submitting}>
                  {submitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <IconThumbsUp size={14} />}
                  Confirm Publish
                </button>
                <button className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
              </div>
            </div>
          )}

          {(action === 'reject' || action === 'changes') && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">
                  {action === 'reject' ? 'Rejection Reason' : 'Changes Required'} <span className="text-error">*</span>
                </label>
                <textarea
                  className="input"
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={action === 'reject'
                    ? 'Why is this post being rejected?'
                    : 'What changes does the doctor need to make?'}
                />
              </div>
              <div className="flex gap-3">
                <button
                  className={`btn flex-1 flex items-center gap-2 justify-center ${action === 'reject' ? 'btn-ghost text-error' : 'btn-primary'}`}
                  onClick={handleAction}
                  disabled={submitting || !message.trim()}
                >
                  {action === 'reject' ? 'Confirm Rejection' : 'Send Changes Request'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setAction(null); setMessage(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {post.status !== 'PENDING_REVIEW' && (
        <div className="glass-card-flat p-4">
          <p className="text-xs font-semibold text-muted">Post status: <span className="font-bold text-primary">{post.status}</span></p>
          {post.review_message && <p className="text-xs text-muted mt-1">Review note: {post.review_message}</p>}
        </div>
      )}
    </div>
  );
}
