/**
 * Public Post Feed — shows only PUBLISHED posts.
 * DRAFT, PENDING_REVIEW, REJECTED posts are NEVER shown here.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicPosts } from '../services/api';
import { IconDoc, IconBadgeCheck, IconTag, IconSparkle } from '../components/icons';

const CATEGORIES = [
  'All', 'Health Education', 'Patient Education', 'Medical Technology',
  'Clinical Awareness', 'Healthcare News', 'Professional Insights', 'General Health',
];

export default function PublicPostFeedPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getPublicPosts({
        category: category || undefined,
        search: search || undefined,
        page,
        perPage: 12,
      })
        .then(data => { setPosts(data.posts || []); setTotal(data.total || 0); })
        .catch(() => setPosts([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [category, search, page]);

  return (
    <div className="page-container py-8 px-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black">Health Posts</h1>
        <p className="text-muted text-sm mt-2">Educational content from our verified doctors</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <input
          className="input flex-1"
          placeholder="Search posts..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => { setCategory(cat === 'All' ? '' : cat); setPage(1); }}
            className={`badge shrink-0 text-xs cursor-pointer transition-all ${
              (cat === 'All' && !category) || cat === category
                ? 'badge-primary'
                : 'badge-secondary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-48">
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-card-flat p-16 text-center">
          <IconSparkle size={48} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 12px' }} />
          <h3 className="font-bold mb-2">No posts available</h3>
          <p className="text-muted text-sm">Check back soon for educational content from our verified doctors.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted mb-4">{total} post{total !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {posts.map(post => (
              <div
                key={post.id}
                className="glass-card-flat p-5 flex flex-col cursor-pointer hover:scale-102 transition-transform"
                onClick={() => navigate(`/posts/${post.id}`)}
              >
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  <span className="badge badge-primary text-xs">{post.category}</span>
                </div>
                <h3 className="font-bold text-sm mb-2 line-clamp-2">{post.title}</h3>
                <p className="text-xs text-muted flex-1 line-clamp-3 mb-3">{post.content}</p>

                {post.tags?.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    <IconTag size={11} style={{ color: 'var(--color-text-secondary)' }} />
                    {post.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs text-muted">#{t}</span>
                    ))}
                  </div>
                )}

                {post.author && (
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: 'var(--gradient-primary)' }}>
                      {post.author.name?.charAt(0) || 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{post.author.name}</p>
                      <div className="flex items-center gap-1">
                        {post.author.verified && (
                          <IconBadgeCheck size={10} style={{ color: 'var(--color-success)' }} />
                        )}
                        <span className="text-xs text-muted">{post.author.specialization}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted shrink-0">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > 12 && (
            <div className="flex items-center justify-center gap-2">
              <button className="btn btn-secondary text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="text-xs text-muted">Page {page} of {Math.ceil(total / 12)}</span>
              <button className="btn btn-secondary text-xs" disabled={page >= Math.ceil(total / 12)} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
