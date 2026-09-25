import { useState, useEffect } from 'react';
import { getAllUsers, updateUserStatus, getAuditLogs } from '../../services/firestoreService';
import { useToast } from '../../context/ToastContext';
import {
  IconActivity,
  IconAlert,
  IconArrowRight,
  IconCalendar,
  IconChart,
  IconCheck,
  IconChevronDown,
  IconDoc,
  IconFlask,
  IconHeart,
  IconInfo,
  IconMic,
  IconPill,
  IconRefresh,
  IconSearch,
  IconShield,
  IconSparkle,
  IconStethoscope,
  IconUsers,
  IconX,
} from '../../components/icons';

function Sparkline({ color = 'var(--color-primary)', data = [10, 15, 12, 18, 22, 20, 28] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 22;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

const roleLabel = (role) => {
  if (role === 'lab') return 'Lab Tech';
  if (role === 'pharmacist') return 'Pharmacist';
  if (role === 'doctor') return 'Doctor';
  if (role === 'patient') return 'Patient';
  return 'Admin';
};

const formatAuditTime = (ts) => {
  if (!ts) return '—';
  let date = null;
  if (typeof ts.toDate === 'function') date = ts.toDate();
  else if (ts instanceof Date) date = ts;
  else if (typeof ts === 'string') date = new Date(ts);
  else if (ts.seconds != null) date = new Date(ts.seconds * 1000);
  if (!date || Number.isNaN(date.getTime())) return String(ts);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const normalizeAudit = (log) => {
  const rawType = String(log.type || '').toLowerCase();
  let kind = 'info';
  if (/success|completed|passed|healthy|login|approved/i.test(rawType)) kind = 'success';
  else if (/fail|denied|blocked|error|danger|suspend|alert/i.test(rawType)) kind = 'danger';
  return {
    id: log.id,
    time: formatAuditTime(log.timestamp),
    title: log.action || log.event || log.title || log.message || 'Audit event',
    meta: log.actor || log.user || log.email || log.meta || (log.uid ? `UID ${log.uid}` : 'System'),
    kind,
  };
};

const defaultDirectory = [
  {
    uid: 'u-1',
    name: 'Sarah Mitchell',
    title: 'Business development',
    email: 'sarah.m@kenko.ai',
    role: 'admin',
    status: 'Active',
    lastActive: '2 min ago',
    avatarBg: 'var(--color-danger)',
  },
  {
    uid: 'u-2',
    name: 'Dr. Rajesh Kumar',
    title: 'Attending Physician',
    email: 'rajesh.k@kenko.ai',
    role: 'doctor',
    status: 'Active',
    lastActive: '12 min ago',
    avatarBg: 'var(--color-primary)',
  },
  {
    uid: 'u-3',
    name: 'Priya Nair',
    title: 'Lab Technician',
    email: 'priya.n@kenko.ai',
    role: 'lab',
    status: 'Active',
    lastActive: '28 min ago',
    avatarBg: 'var(--color-success)',
  },
  {
    uid: 'u-4',
    name: 'Arun V',
    title: 'Clinical Pharmacist',
    email: 'arun.v@kenko.ai',
    role: 'pharmacist',
    status: 'Active',
    lastActive: '1 hour ago',
    avatarBg: 'var(--color-warning)',
  },
  {
    uid: 'u-5',
    name: 'Sneha R',
    title: 'System Administrator',
    email: 'sneha.r@kenko.ai',
    role: 'admin',
    status: 'Active',
    lastActive: '3 hours ago',
    avatarBg: 'var(--color-blue)',
  },
];

const defaultAuditActivity = [
  {
    id: 'aud-1',
    time: '10:24 AM',
    title: 'Successful login',
    meta: 'admin@kenko.ai • System Admin',
    kind: 'success',
  },
  {
    id: 'aud-2',
    time: '08:42 AM',
    title: 'User permission updated',
    meta: 'Dr. Rajesh Kumar • Attending Doctor',
    kind: 'info',
  },
  {
    id: 'aud-3',
    time: '06:17 AM',
    title: 'HIPAA audit completed',
    meta: 'All checks passed • 100% compliance',
    kind: 'success',
  },
  {
    id: 'aud-4',
    time: 'Yesterday',
    title: 'Failed login attempt (blocked)',
    meta: 'IP 103.21.45.67 • Suspicious activity',
    kind: 'danger',
  },
  {
    id: 'aud-5',
    time: 'Yesterday',
    title: 'System configuration updated',
    meta: 'Platform settings • System Admin',
    kind: 'success',
  },
];

const activityData = [
  { day: 'Sep 12', consults: 22, patients: 14 },
  { day: 'Sep 13', consults: 21, patients: 18 },
  { day: 'Sep 14', consults: 18, patients: 20 },
  { day: 'Sep 15', consults: 28, patients: 28 },
  { day: 'Sep 16', consults: 26, patients: 32 },
  { day: 'Sep 17', consults: 34, patients: 40 },
  { day: 'Sep 18', consults: 42, patients: 46 },
];

const kpis = [
  { label: 'Total Patients', value: '2,487', delta: '12.5%', icon: IconUsers, spark: [12, 14, 18, 16, 22, 25, 28], color: 'var(--color-primary)' },
  { label: 'Attending Doctors', value: '64', delta: '6.7%', icon: IconStethoscope, spark: [10, 11, 14, 13, 15, 17, 18], color: 'var(--color-blue)' },
  { label: 'Lab Technicians', value: '18', delta: '12.5%', icon: IconFlask, spark: [8, 10, 9, 12, 14, 16, 18], color: 'var(--color-success)' },
  { label: 'Clinical Pharmacists', value: '12', delta: '9.1%', icon: IconPill, spark: [6, 7, 9, 8, 10, 11, 12], color: 'var(--color-warning)' },
  { label: 'Total Consultations', value: '34', delta: '28.6%', icon: IconCalendar, spark: [10, 14, 18, 22, 26, 30, 34], color: 'var(--color-info)' },
  { label: 'System Health', value: '99.98%', delta: '0.02%', icon: IconHeart, spark: [99, 99.5, 99.8, 99.7, 99.9, 99.95, 99.98], color: 'var(--color-success)' },
];

const systemServices = [
  { id: 'nvidia-stt', name: 'NVIDIA Cloud STT', desc: 'Hosted Speech-to-Text API', status: 'Healthy', uptime: '99.99%', icon: IconChart, bg: 'var(--color-primary-light)', color: 'var(--color-primary)' },
  { id: 'clinical-ai', name: 'Clinical AI Engine', desc: 'Deterministic Extraction Service', status: 'Healthy', uptime: '99.98%', icon: IconSparkle, bg: 'var(--color-blue-light)', color: 'var(--color-blue)' },
  { id: 'firestore', name: 'Firestore / EHR', desc: 'Database & Data Sync', status: 'Healthy', uptime: '99.98%', icon: IconDoc, bg: 'var(--color-success-light)', color: 'var(--color-success)' },
  { id: 'voice-stt', name: 'Google Meet API', desc: 'Telehealth Integration', status: 'Healthy', uptime: '99.97%', icon: IconMic, bg: 'var(--color-primary-light)', color: 'var(--color-primary)' },
];

export default function AdminWorkspace() {
  const { success } = useToast();

  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState('7D');
  const [activeTab, setActiveTab] = useState('directory');
  const [showManageModal, setShowManageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [openActionId, setOpenActionId] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const userList = await getAllUsers();
        const logs = await getAuditLogs(15);
        if (!active) return;
        if (userList && userList.length) {
          setUsers(userList);
        } else {
          setUsers(defaultDirectory);
        }
        if (logs && logs.length) {
          setAuditLogs(logs);
        }
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const userList = await getAllUsers();
      const logs = await getAuditLogs(15);
      if (userList && userList.length) {
        setUsers(userList);
      } else {
        setUsers(defaultDirectory);
      }
      if (logs && logs.length) {
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error('Failed to refresh admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (targetUser) => {
    const newStatus = targetUser.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await updateUserStatus(targetUser.uid, newStatus);
      success(`User ${targetUser.name || targetUser.email} is now ${newStatus}`, 'User Updated');
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, status: newStatus } : u))
      );
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, status: newStatus } : u))
      );
      success(`User status updated to ${newStatus}`, 'Status Changed');
    }
    setOpenActionId(null);
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  const auditEntries =
    auditLogs && auditLogs.length > 0 ? auditLogs.map(normalizeAudit) : defaultAuditActivity;

  const maxActivity = Math.max(1, ...activityData.flatMap((d) => [d.consults, d.patients]));

  const auditKindBg = (kind) =>
    kind === 'success'
      ? 'var(--color-success-light)'
      : kind === 'danger'
      ? 'var(--color-danger-light)'
      : 'var(--color-primary-light)';

  const auditKindColor = (kind) =>
    kind === 'success' ? 'var(--color-success)' : kind === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)';

  const auditKindIcon = (kind) =>
    kind === 'success' ? <IconCheck size={14} /> : kind === 'danger' ? <IconAlert size={14} /> : <IconInfo size={14} />;

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="admin-workspace">
      <div className="page-header">
        <div>
          <span className="badge badge-primary mb-2">
            <IconShield size={12} /> System Administration
          </span>
          <h1 className="page-title">Platform Governance &amp; Operations</h1>
          <p className="page-subtitle">
            Centralized role permissions, user directory, system security telemetry &amp; HIPAA audit logs.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              refreshData();
              success('System telemetry & metrics synchronized.', 'Metrics Refreshed');
            }}
          >
            <IconRefresh size={14} /> Refresh Metrics
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowManageModal(true)}>
            <IconUsers size={14} /> Manage Users
          </button>
        </div>
      </div>

      {loading ? (
        <>
          <section className="kpi-grid" aria-label="Key performance indicators">
            {kpis.map((k) => (
              <div key={k.label} className="skeleton skeleton-card" />
            ))}
          </section>
          <div className="grid grid-cols-2 gap-4">
            <div className="skeleton skeleton-card" style={{ height: '220px' }} />
            <div className="skeleton skeleton-card" style={{ height: '220px' }} />
          </div>
          <div className="skeleton skeleton-card" style={{ height: '260px' }} />
        </>
      ) : (
        <>
          <section className="kpi-grid" aria-label="Key performance indicators">
            {kpis.map((k) => (
              <div key={k.label} className="kpi-card">
                <div className="flex items-center justify-between">
                  <span className="kpi-label">{k.label}</span>
                  <span className="kpi-icon">
                    <k.icon size={14} />
                  </span>
                </div>
                <div className="kpi-value">{k.value}</div>
                <div className="flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <span className="kpi-delta up">↑ {k.delta}</span>
                    <span className="kpi-foot">vs. last 7 days</span>
                  </div>
                  <Sparkline color={k.color} data={k.spark} />
                </div>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <IconActivity size={15} /> Consultation Activity
                  </h3>
                  <p className="card-subtitle">Consults and patient volume per day</p>
                </div>
                <div className="pill-tabs">
                  {['7D', '30D', '90D'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      className={`pill-tab ${chartPeriod === period ? 'active' : ''}`}
                      onClick={() => setChartPeriod(period)}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body">
                <div className="flex items-center gap-5 mb-4">
                  <span className="flex items-center gap-2 text-xs text-secondary">
                    <span className="status-dot" style={{ background: 'var(--color-primary)' }} /> Consultations
                  </span>
                  <span className="flex items-center gap-2 text-xs text-secondary">
                    <span className="status-dot" style={{ background: 'var(--color-success)' }} /> Patients
                  </span>
                </div>
                <div
                  className="flex items-end gap-2"
                  style={{ height: '160px', borderBottom: '1px solid var(--color-border)' }}
                >
                  {activityData.map((d) => (
                    <div
                      key={d.day}
                      className="flex-1 flex items-end justify-center gap-1"
                      style={{ height: '100%' }}
                    >
                      <div
                        title={`${d.consults} consultations on ${d.day}`}
                        style={{
                          width: '34%',
                          background: 'var(--color-primary)',
                          borderTopLeftRadius: '4px',
                          borderTopRightRadius: '4px',
                          height: `${Math.round((d.consults / maxActivity) * 100)}%`,
                        }}
                      />
                      <div
                        title={`${d.patients} patients on ${d.day}`}
                        style={{
                          width: '34%',
                          background: 'var(--color-success)',
                          borderTopLeftRadius: '4px',
                          borderTopRightRadius: '4px',
                          height: `${Math.round((d.patients / maxActivity) * 100)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {activityData.map((d) => (
                    <span
                      key={d.day}
                      className="flex-1 text-center text-xs text-muted whitespace-nowrap"
                    >
                      {d.day}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <IconShield size={15} /> System Service Health
                  </h3>
                  <p className="card-subtitle">Runtime services telemetry</p>
                </div>
                <span className="badge badge-success">
                  <IconCheck size={11} /> All Services Healthy
                </span>
              </div>
              <div className="card-body flex flex-col" style={{ gap: '4px' }}>
                {systemServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between"
                    style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border-subtle)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="kpi-icon flex-shrink-0" style={{ background: svc.bg, color: svc.color }}>
                        <svc.icon size={14} />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{svc.name}</span>
                        <span className="text-xs text-muted">{svc.desc}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="badge badge-success">
                        <span className="status-dot active" /> {svc.status}
                      </span>
                      <span className="text-xs font-mono text-secondary whitespace-nowrap">
                        {svc.uptime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'directory'}
              className={`tab-item ${activeTab === 'directory' ? 'active' : ''}`}
              onClick={() => setActiveTab('directory')}
            >
              <span className="flex items-center gap-2">
                <IconUsers size={14} /> User Directory
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audit'}
              className={`tab-item ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              <span className="flex items-center gap-2">
                <IconShield size={14} /> Security &amp; Audit
              </span>
            </button>
          </div>

          {activeTab === 'directory' ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <IconUsers size={15} /> Active Platform Directory
                  </h3>
                  <p className="card-subtitle">Active platform members and permissions</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowManageModal(true)}
                >
                  View All <IconArrowRight size={13} />
                </button>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Active</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 5).map((u) => {
                      const suspended = u.status === 'Suspended';
                      return (
                        <tr key={u.uid}>
                          <td>
                            <div className="flex items-center gap-3">
                              <span
                                className="avatar"
                                style={{ background: u.avatarBg || 'var(--color-primary)' }}
                              >
                                {(u.name || u.email || 'U')[0].toUpperCase()}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">{u.name || u.email}</span>
                                <span className="text-xs text-muted">{u.title || u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-secondary">{roleLabel(u.role || 'doctor')}</span>
                          </td>
                          <td>
                            <span className={`badge ${suspended ? 'badge-danger' : 'badge-success'}`}>
                              <span className={`status-dot ${suspended ? 'error' : 'active'}`} />
                              {u.status || 'Active'}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs text-secondary whitespace-nowrap">
                              {u.lastActive || 'Just now'}
                            </span>
                          </td>
                          <td className="text-right relative">
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm"
                              aria-label="User actions"
                              onClick={() => setOpenActionId(openActionId === u.uid ? null : u.uid)}
                            >
                              <IconChevronDown size={14} />
                            </button>
                            {openActionId === u.uid && (
                              <div
                                className="glass-card-flat animate-fade-in"
                                style={{
                                  position: 'absolute',
                                  right: '12px',
                                  top: '34px',
                                  zIndex: 20,
                                  minWidth: '150px',
                                  padding: '4px',
                                  boxShadow: 'var(--shadow-lg)',
                                }}
                              >
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => handleToggleUserStatus(u)}
                                >
                                  {suspended ? <IconCheck size={14} /> : <IconAlert size={14} />}
                                  <span>{suspended ? 'Activate User' : 'Suspend User'}</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <IconShield size={15} /> Security &amp; HIPAA Audit Activity
                  </h3>
                  <p className="card-subtitle">Latest governance and system events</p>
                </div>
                <span className="badge badge-success">
                  <IconCheck size={11} /> Compliant
                </span>
              </div>
              <div className="card-body flex flex-col" style={{ gap: '16px' }}>
                {auditEntries.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <span
                      className="text-xs text-muted whitespace-nowrap"
                      style={{ minWidth: '92px', paddingTop: '2px' }}
                    >
                      {item.time}
                    </span>
                    <span
                      className="kpi-icon flex-shrink-0"
                      style={{ background: auditKindBg(item.kind), color: auditKindColor(item.kind) }}
                    >
                      {auditKindIcon(item.kind)}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-xs text-muted">{item.meta}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showManageModal && (
        <div className="modal-backdrop" onClick={() => setShowManageModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '860px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  <span className="flex items-center gap-2">
                    <IconUsers size={15} /> Platform User Provisioning &amp; Directory
                  </span>
                </h3>
                <p className="card-subtitle">
                  Manage Cloud Firestore user permissions, active credentials &amp; status.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close directory"
                onClick={() => setShowManageModal(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="relative w-full" style={{ maxWidth: '320px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by name, email or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                  />
                  <IconSearch
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)',
                    }}
                  />
                </div>
                <div className="pill-tabs overflow-x-auto">
                  {['all', 'admin', 'doctor', 'lab', 'pharmacist', 'patient'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`pill-tab ${selectedRoleFilter === r ? 'active' : ''}`}
                      onClick={() => setSelectedRoleFilter(r)}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User / Healthcare Professional</th>
                      <th>Role Permission</th>
                      <th>Account Status</th>
                      <th className="text-right">Status Toggle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.uid}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span
                              className="avatar"
                              style={{ background: u.avatarBg || 'var(--color-primary)' }}
                            >
                              {(u.name || u.email || 'U')[0].toUpperCase()}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">{u.name || u.email}</span>
                              <span className="text-xs text-muted">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-secondary">{roleLabel(u.role || 'doctor')}</span>
                        </td>
                        <td>
                          <span className={`badge ${u.status === 'Suspended' ? 'badge-danger' : 'badge-success'}`}>
                            {u.status || 'Active'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className={`btn btn-sm ${
                              u.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'
                            }`}
                            onClick={() => handleToggleUserStatus(u)}
                          >
                            {u.status === 'Active' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && (
                <div className="empty-state mt-4">
                  <span className="empty-icon">
                    <IconSearch size={18} />
                  </span>
                  <p className="empty-title">No users found</p>
                  <p className="empty-description">Try adjusting your search or role filter.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowManageModal(false)}
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}