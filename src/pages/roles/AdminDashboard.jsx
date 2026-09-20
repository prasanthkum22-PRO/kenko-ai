import { useState, useEffect } from 'react';
import { getAdminOverview } from '../../services/api';
import {
  IconUsers,
  IconVideo,
  IconActivity,
  IconFlask,
  IconRefresh,
  IconShield,
  IconCheck,
} from '../../components/icons';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadOverview = async () => {
      setLoading(true);
      try {
        const res = await getAdminOverview();
        if (active) setData(res);
      } catch (err) {
        console.error('Failed to load admin overview:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadOverview();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const metrics = data?.metrics || {};
  const users = data?.users || [];
  const activity = data?.recent_activity || [];
  const roleBreakdown = metrics?.users_by_role || {};

  if (loading) {
    return (
      <div className="flex flex-col gap-6" id="admin-dashboard">
        <div className="page-header">
          <div className="flex flex-col gap-2" style={{ width: '100%' }}>
            <div className="skeleton skeleton-text" style={{ width: '32%' }} />
            <div className="skeleton skeleton-text" style={{ width: '46%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
          <div className="page-actions">
            <div className="skeleton" style={{ width: '150px', height: '36px' }} />
          </div>
        </div>
        <div className="kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kpi-card">
              <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              <div className="skeleton skeleton-text" style={{ width: '42%' }} />
              <div className="skeleton skeleton-text" style={{ width: '72%' }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="admin-dashboard">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge badge-primary">
              <IconShield size={12} />
              System Administration
            </span>
            <span className="text-xs text-muted">MediBridge AI Command Center</span>
          </div>
          <h1 className="page-title">Clinical Operations &amp; Governance</h1>
          <p className="page-subtitle">
            User directory, permission roles, HIPAA audit trail &amp; system health monitor.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary text-xs"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <IconRefresh size={14} />
            Refresh Activity
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconUsers size={16} />
          </div>
          <span className="kpi-label">Total Registered Users</span>
          <span className="kpi-value">{metrics.total_users || 0}</span>
          <span className="kpi-foot">Doctors, Patients, Staff</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconVideo size={16} />
          </div>
          <span className="kpi-label">Total Consultations</span>
          <span className="kpi-value">{metrics.total_consultations || 0}</span>
          <span className="kpi-foot">In-Person &amp; Video</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconActivity size={16} />
          </div>
          <span className="kpi-label">Active Follow-ups</span>
          <span className="kpi-value">{metrics.total_followups || 0}</span>
          <span className="kpi-foot">Action intelligence items</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconFlask size={16} />
          </div>
          <span className="kpi-label">Pathology Orders</span>
          <span className="kpi-value">{metrics.total_labs || 0}</span>
          <span className="kpi-foot">Diagnostic requisitions</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-card-title">User Accounts &amp; Roles</h2>
          </div>
          <div className="section-card-body">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-semibold text-primary">{u.full_name}</td>
                      <td className="text-muted font-mono">{u.email}</td>
                      <td>
                        <span className="badge badge-secondary">{u.role}</span>
                      </td>
                      <td>
                        <span className="badge badge-success">
                          <IconCheck size={12} />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-muted">
                        No user accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {Object.keys(roleBreakdown).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-label">Users by Role</span>
                {Object.entries(roleBreakdown).map(([role, count]) => (
                  <span key={role} className="badge badge-secondary">
                    <IconUsers size={12} />
                    {role}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-card-title">System Activity &amp; Audit Trail</h2>
          </div>
          <div className="section-card-body">
            <div className="flex flex-col gap-3" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {activity.map((log) => (
                <div
                  key={log.id}
                  className="glass-card-flat p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="flex-shrink-0 text-primary">
                      <IconActivity size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">
                        {log.action.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <p className="text-xs text-muted">
                        By: {log.user_id} ({log.user_role}) &bull; Target: {log.resource_type}
                      </p>
                    </div>
                  </div>
                  <span className="text-muted font-mono flex-shrink-0" style={{ fontSize: '0.7rem' }}>
                    {log.timestamp}
                  </span>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="text-xs text-muted text-center p-4">No audit logs recorded.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}