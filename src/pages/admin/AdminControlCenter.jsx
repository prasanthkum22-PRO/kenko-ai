/**
 * Admin Control Center — Main Dashboard
 * Accessible ONLY to ADMIN role. Backend enforces this too.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getModerationOverview, adminListApplications, adminListPosts, adminGetAuditLogs,
} from '../../services/api';
import {
  IconDashboard, IconStethoscope, IconDoc, IconUsers,
  IconActivity, IconBadgeCheck, IconClock, IconSparkle,
} from '../../components/icons';

function StatCard({ label, value, icon: Icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="glass-card-flat p-5 text-left hover:scale-105 transition-transform cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted mb-1">{label}</p>
          <p className="text-3xl font-black" style={{ color }}>{value ?? '—'}</p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </button>
  );
}

function StatusBadge({ status }) {
  const MAP = {
    PENDING: ['Pending', 'var(--color-warning)'],
    UNDER_REVIEW: ['Under Review', 'var(--color-info)'],
    APPROVED: ['Approved', 'var(--color-success)'],
    REJECTED: ['Rejected', 'var(--color-error)'],
    REQUIRES_MORE_INFORMATION: ['More Info', 'var(--color-warning)'],
    PENDING_REVIEW: ['Pending', 'var(--color-warning)'],
    PUBLISHED: ['Published', 'var(--color-primary)'],
    CHANGES_REQUESTED: ['Changes', 'var(--color-warning)'],
    DRAFT: ['Draft', 'var(--color-text-secondary)'],
  };
  const [label, color] = MAP[status] || [status, 'var(--color-text-secondary)'];
  return (
    <span className="badge text-xs font-semibold" style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
      {label}
    </span>
  );
}

export default function AdminControlCenterPage({ initialTab = 'overview' }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ov, apps, posts, logs] = await Promise.allSettled([
          getModerationOverview(),
          adminListApplications({ page: 1 }),
          adminListPosts({ page: 1 }),
          adminGetAuditLogs(1),
        ]);
        if (ov.status === 'fulfilled') setOverview(ov.value);
        if (apps.status === 'fulfilled') setRecentApps(apps.value.applications?.slice(0, 5) || []);
        if (posts.status === 'fulfilled') setRecentPosts(posts.value.posts?.slice(0, 5) || []);
        if (logs.status === 'fulfilled') setAuditLogs(logs.value.logs?.slice(0, 8) || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: IconDashboard },
    { id: 'applications', label: 'Doctor Applications', icon: IconStethoscope },
    { id: 'posts', label: 'Post Moderation', icon: IconDoc },
    { id: 'audit', label: 'Audit Logs', icon: IconActivity },
  ];

  return (
    <div className="page-container py-6 px-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="glass-card-flat p-6 mb-6" style={{ background: 'var(--gradient-primary)' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-white/10">
            <IconDashboard size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">ADMIN CONTROL CENTER</h1>
            <p className="text-white/70 text-sm">Manage doctor applications, post moderation, users, and audit logs</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Pending Applications" value={overview.pending_applications} icon={IconClock} color="var(--color-warning)" onClick={() => navigate('/admin/doctors/applications?status=PENDING')} />
          <StatCard label="Pending Posts" value={overview.pending_posts} icon={IconDoc} color="var(--color-info)" onClick={() => navigate('/admin/posts?status=PENDING_REVIEW')} />
          <StatCard label="Verified Doctors" value={overview.approved_doctors} icon={IconBadgeCheck} color="var(--color-success)" onClick={() => navigate('/admin/doctors/applications?status=APPROVED')} />
          <StatCard label="Published Posts" value={overview.published_posts} icon={IconSparkle} color="var(--color-primary)" onClick={() => navigate('/admin/posts?status=PUBLISHED')} />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-5 glass-card-flat p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-primary hover:bg-surface-alt'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-32">
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      )}

      {!loading && activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Applications */}
          <div className="glass-card-flat p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2"><IconStethoscope size={16} /> Doctor Applications</h2>
              <button className="btn btn-secondary text-xs" onClick={() => navigate('/admin/doctors/applications')}>View All</button>
            </div>
            {recentApps.length === 0 ? (
              <p className="text-muted text-xs text-center py-8">No applications yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentApps.map(app => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
                    onClick={() => navigate(`/admin/doctors/applications/${app.id}`)}
                  >
                    <div>
                      <p className="text-xs font-semibold">{app.full_name}</p>
                      <p className="text-xs text-muted">{app.specialization}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Posts */}
          <div className="glass-card-flat p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2"><IconDoc size={16} /> Post Moderation</h2>
              <button className="btn btn-secondary text-xs" onClick={() => navigate('/admin/posts')}>View All</button>
            </div>
            {recentPosts.length === 0 ? (
              <p className="text-muted text-xs text-center py-8">No posts for review</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentPosts.map(post => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
                    onClick={() => navigate(`/admin/posts/${post.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{post.title}</p>
                      <p className="text-xs text-muted">{post.author_name} • {post.category}</p>
                    </div>
                    <StatusBadge status={post.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && activeTab === 'applications' && (
        <AdminApplicationsTab navigate={navigate} />
      )}

      {!loading && activeTab === 'posts' && (
        <AdminPostsTab navigate={navigate} />
      )}

      {!loading && activeTab === 'audit' && (
        <div className="glass-card-flat p-5">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><IconActivity size={16} /> Recent Audit Events</h2>
          <div className="flex flex-col gap-2">
            {auditLogs.length === 0 ? (
              <p className="text-muted text-xs text-center py-8">No audit events recorded</p>
            ) : auditLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-alt">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--color-primary)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{log.action}</p>
                  <p className="text-xs text-muted">{log.resource_type} • {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN') : ''}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary text-xs mt-4 w-full" onClick={() => navigate('/admin/audit')}>
            View Full Audit Log
          </button>
        </div>
      )}
    </div>
  );
}


// ─── Sub-components ────────────────────────────────────────────

function AdminApplicationsTab({ navigate }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    adminListApplications({ status: filter || undefined, search: search || undefined })
      .then(data => setApps(data.applications || []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [filter, search]);

  const STATUSES = ['', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUIRES_MORE_INFORMATION'];

  return (
    <div className="glass-card-flat p-5">
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input text-xs flex-1 min-w-48"
          placeholder="Search by name, email, specialization..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input text-xs w-48" value={filter} onChange={e => setFilter(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-32"><span className="spinner" style={{ width: 28 }} /></div>
      ) : apps.length === 0 ? (
        <p className="text-center text-muted text-xs py-12">No applications found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {['Applicant', 'Specialization', 'Degree', 'Submitted', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left p-2 text-muted font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id} className="border-b border-border hover:bg-surface-alt">
                  <td className="p-2">
                    <p className="font-semibold">{app.full_name}</p>
                    <p className="text-muted">{app.email}</p>
                  </td>
                  <td className="p-2">{app.specialization}</td>
                  <td className="p-2">{app.medical_degree}</td>
                  <td className="p-2">{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="p-2"><StatusBadge2 status={app.status} /></td>
                  <td className="p-2">
                    <button
                      className="btn btn-primary text-xs"
                      onClick={() => navigate(`/admin/doctors/applications/${app.id}`)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminPostsTab({ navigate }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    adminListPosts({ status: filter || undefined, search: search || undefined })
      .then(data => setPosts(data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [filter, search]);

  return (
    <div className="glass-card-flat p-5">
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input text-xs flex-1 min-w-48"
          placeholder="Search posts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input text-xs w-48" value={filter} onChange={e => setFilter(e.target.value)}>
          {['', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'CHANGES_REQUESTED'].map(s => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-32"><span className="spinner" style={{ width: 28 }} /></div>
      ) : posts.length === 0 ? (
        <p className="text-center text-muted text-xs py-12">No posts found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {['Doctor', 'Title', 'Category', 'Submitted', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left p-2 text-muted font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b border-border hover:bg-surface-alt">
                  <td className="p-2 font-semibold">{post.author_name}</td>
                  <td className="p-2 max-w-xs truncate">{post.title}</td>
                  <td className="p-2">{post.category}</td>
                  <td className="p-2">{post.submitted_at ? new Date(post.submitted_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="p-2"><StatusBadge2 status={post.status} /></td>
                  <td className="p-2">
                    <button
                      className="btn btn-primary text-xs"
                      onClick={() => navigate(`/admin/posts/${post.id}`)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge2({ status }) {
  const MAP = {
    PENDING: ['Pending', 'var(--color-warning)'],
    UNDER_REVIEW: ['Under Review', 'var(--color-info)'],
    APPROVED: ['Approved', 'var(--color-success)'],
    REJECTED: ['Rejected', 'var(--color-error)'],
    REQUIRES_MORE_INFORMATION: ['More Info', 'var(--color-warning)'],
    PENDING_REVIEW: ['Pending Review', 'var(--color-warning)'],
    PUBLISHED: ['Published', 'var(--color-primary)'],
    CHANGES_REQUESTED: ['Changes', 'var(--color-warning)'],
    DRAFT: ['Draft', 'var(--color-text-secondary)'],
  };
  const [label, color] = MAP[status] || [status, 'var(--color-text-secondary)'];
  return (
    <span className="badge text-xs" style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
      {label}
    </span>
  );
}
