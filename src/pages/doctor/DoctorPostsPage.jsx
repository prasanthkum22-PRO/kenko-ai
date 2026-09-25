/**
 * Doctor Posts Management Page
 * Allows verified doctors to create/manage educational posts.
 * Posts go through DRAFT → PENDING_REVIEW → (admin approves) → PUBLISHED
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { getMyPosts, createPost, submitPostForReview } from '../../services/api';
import {
  IconDoc, IconEdit, IconSend, IconTag, IconSparkle, IconRefresh,
} from '../../components/icons';

const POST_CATEGORIES = [
  'Health Education', 'Patient Education', 'Medical Technology',
  'Clinical Awareness', 'Healthcare News', 'Professional Insights', 'General Health',
];

const STATUS_BADGE = {
  DRAFT: { label: 'Draft', color: 'var(--color-text-secondary)', bg: 'var(--color-surface-alt)' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'var(--color-warning)', bg: 'var(--color-warning-light, #fef3c7)' },
  APPROVED: { label: 'Approved', color: 'var(--color-success)', bg: 'var(--color-success-light, #dcfce7)' },
  PUBLISHED: { label: 'Published', color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
  REJECTED: { label: 'Rejected', color: 'var(--color-error)', bg: 'var(--color-error-light, #fee2e2)' },
  CHANGES_REQUESTED: { label: 'Changes Needed', color: 'var(--color-warning)', bg: 'var(--color-warning-light, #fef3c7)' },
};

export default function DoctorPostsPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '', content: '', category: 'General Health',
    tags: '', specialization: '', save_as_draft: true,
  });
  const [coverImage, setCoverImage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyPosts();
      setPosts(data.posts || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toastError('Title and content are required.', 'Validation');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('content', form.content);
      fd.append('category', form.category);
      fd.append('tags', JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean)));
      fd.append('specialization', form.specialization);
      fd.append('save_as_draft', form.save_as_draft);
      if (coverImage) fd.append('cover_image', coverImage);

      await createPost(fd);
      success(form.save_as_draft ? 'Post saved as draft.' : 'Post submitted for review!', 'Post Created');
      setShowCreate(false);
      setForm({ title: '', content: '', category: 'General Health', tags: '', specialization: '', save_as_draft: true });
      setCoverImage(null);
      load();
    } catch (err) {
      toastError(err?.response?.data?.detail || 'Failed to create post.', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForReview = async (postId) => {
    try {
      await submitPostForReview(postId);
      success('Post submitted for admin review.', 'Submitted');
      load();
    } catch (err) {
      toastError(err?.response?.data?.detail || 'Submission failed.', 'Error');
    }
  };

  return (
    <div className="page-container py-6 px-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <IconDoc size={20} style={{ color: 'var(--color-primary)' }} />
            My Posts
          </h1>
          <p className="text-muted text-sm mt-1">Create educational content reviewed by administrators before publishing.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary text-xs" onClick={load}><IconRefresh size={14} /></button>
          <button className="btn btn-primary text-sm flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <IconEdit size={14} /> Create Post
          </button>
        </div>
      </div>

      {/* Create Post Form */}
      {showCreate && (
        <div className="glass-card-flat p-6 mb-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><IconEdit size={16} /> New Post</h2>

          <div className="p-3 mb-4 rounded-lg text-xs" style={{ background: 'var(--color-warning-light, #fef3c7)', color: 'var(--color-warning)' }}>
            ⚠️ Do not include any identifiable patient information, medical records, or consultation transcripts in this post.
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Title <span className="text-error">*</span></label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Post title..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {POST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Specialization</label>
                <input className="input" value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} placeholder="e.g. Cardiology" />
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1"><IconTag size={13} /> Tags (comma separated)</label>
              <input className="input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="diabetes, prevention, diet" />
            </div>
            <div>
              <label className="label">Cover Image</label>
              <input type="file" accept="image/*" className="input" onChange={e => setCoverImage(e.target.files[0])} />
            </div>
            <div>
              <label className="label">Content <span className="text-error">*</span></label>
              <textarea className="input" rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Write your educational content here. Include references where appropriate..." />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              className="btn btn-secondary flex items-center gap-2"
              onClick={() => { setForm(f => ({ ...f, save_as_draft: true })); handleCreate(); }}
              disabled={submitting}
            >
              <IconDoc size={14} /> Save Draft
            </button>
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={() => { setForm(f => ({ ...f, save_as_draft: false })); handleCreate(); }}
              disabled={submitting}
            >
              {submitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <IconSend size={14} />}
              Submit for Review
            </button>
            <button className="btn btn-ghost ml-auto text-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Posts List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-32">
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-card-flat p-12 text-center">
          <IconSparkle size={40} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 12px' }} />
          <h3 className="font-bold text-base mb-2">No posts yet</h3>
          <p className="text-muted text-sm">Create your first educational post to share your medical expertise.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => {
            const badge = STATUS_BADGE[post.status] || STATUS_BADGE.DRAFT;
            return (
              <div key={post.id} className="glass-card-flat p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge text-xs" style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                      <span className="badge badge-secondary text-xs">{post.category}</span>
                    </div>
                    <h3 className="font-semibold text-sm truncate">{post.title}</h3>
                    <p className="text-xs text-muted mt-1">
                      {post.created_at ? new Date(post.created_at).toLocaleDateString('en-IN') : ''}
                      {post.published_at ? ` • Published ${new Date(post.published_at).toLocaleDateString('en-IN')}` : ''}
                    </p>
                    {post.review_message && (
                      <div className="mt-2 p-2 rounded text-xs" style={{ background: 'var(--color-warning-light, #fef3c7)', color: 'var(--color-warning)' }}>
                        Admin note: {post.review_message}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {(post.status === 'DRAFT' || post.status === 'CHANGES_REQUESTED') && (
                      <button
                        className="btn btn-primary text-xs flex items-center gap-1"
                        onClick={() => handleSubmitForReview(post.id)}
                      >
                        <IconSend size={12} /> Submit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
