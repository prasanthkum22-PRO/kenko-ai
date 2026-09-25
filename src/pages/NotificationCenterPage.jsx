import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  IconBell,
  IconVideo,
  IconPill,
  IconClock,
  IconDoc,
  IconCheck,
  IconShield,
} from '../components/icons';
import { subscribeToNotifications, markNotificationAsRead } from '../services/firestoreService';

export default function NotificationCenterPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeCategory, setActiveCategory] = useState('All');
  const [notifications, setNotifications] = useState([
    {
      id: 'notif_1',
      title: 'Consultation Scheduled',
      message: 'Your upcoming telehealth consultation is confirmed.',
      category: 'Appointments',
      read: false,
      created_at: '10 mins ago',
      link: '/patient/calendar',
    },
    {
      id: 'notif_2',
      title: 'Prescription Ready',
      message: 'Your doctor has issued and finalized your prescription.',
      category: 'Prescriptions',
      read: false,
      created_at: '1 hour ago',
      link: '/patient/medications',
    },
    {
      id: 'notif_3',
      title: 'Follow-Up Due',
      message: 'Your scheduled condition check-in is due today.',
      category: 'Follow-Up',
      read: true,
      created_at: 'Yesterday',
      link: '/patient/follow-up',
    },
    {
      id: 'notif_4',
      title: 'Medication Reminder',
      message: 'Time for your afternoon scheduled dose.',
      category: 'Medications',
      read: true,
      created_at: 'Yesterday',
      link: '/patient/medications',
    },
    {
      id: 'notif_5',
      title: 'System Security Update',
      message: 'Firebase authorization credentials verified successfully.',
      category: 'System',
      read: true,
      created_at: '2 days ago',
      link: '/settings/notifications',
    },
  ]);

  useEffect(() => {
    if (!user?.uid && !user?.id) return;
    const userId = user.uid || user.id;

    // Connect Firestore real-time listener if available
    const unsubscribe = subscribeToNotifications(userId, (liveNotifs) => {
      if (liveNotifs && liveNotifs.length > 0) {
        setNotifications((prev) => {
          const combined = [...liveNotifs, ...prev.filter((p) => !liveNotifs.some((l) => l.id === p.id))];
          return combined;
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user]);

  const handleMarkRead = async (id) => {
    try {
      if (user?.uid || user?.id) {
        await markNotificationAsRead(user.uid || user.id, id);
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      addToast('Notification marked as read.', 'success');
    } catch (err) {
      console.error('Failed to mark read:', err);
      // Fallback local update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast('All notifications marked as read.', 'success');
  };

  const categories = ['All', 'Appointments', 'Medications', 'Follow-Up', 'Prescriptions', 'System'];

  const filtered = activeCategory === 'All'
    ? notifications
    : notifications.filter((n) => (n.category || '').toLowerCase() === activeCategory.toLowerCase());

  const getCategoryIcon = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'appointments':
        return <IconVideo style={{ width: 18, height: 18, color: '#60a5fa' }} />;
      case 'medications':
        return <IconPill style={{ width: 18, height: 18, color: '#10b981' }} />;
      case 'follow-up':
        return <IconClock style={{ width: 18, height: 18, color: '#f59e0b' }} />;
      case 'prescriptions':
        return <IconDoc style={{ width: 18, height: 18, color: '#a855f7' }} />;
      default:
        return <IconBell style={{ width: 18, height: 18, color: '#94a3b8' }} />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="workspace-container" style={{ padding: '2rem 1.5rem', maxWidth: 960, margin: '0 auto' }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                position: 'relative',
              }}
            >
              <IconBell style={{ width: 24, height: 24 }} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Notification Center
              </h1>
              <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.95rem', marginTop: 2 }}>
                Real-time alerts, appointment updates, and care reminders.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}>
              Mark all as read
            </button>
            <Link to="/settings/notifications" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              Preferences
            </Link>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 9999, whiteSpace: 'nowrap' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.map((notif) => (
          <div
            key={notif.id}
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              background: notif.read ? 'var(--color-surface, #1e293b)' : 'rgba(59, 130, 246, 0.06)',
              borderRadius: 14,
              border: notif.read ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                  flexShrink: 0,
                }}
              >
                {getCategoryIcon(notif.category)}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    {notif.category}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{notif.created_at}</span>
                  {!notif.read && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                  )}
                </div>

                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: 3 }}>
                  {notif.title}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#cbd5e1', marginTop: 2 }}>
                  {notif.message}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {notif.link && (
                <Link to={notif.link} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                  Open
                </Link>
              )}
              {!notif.read && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleMarkRead(notif.id)}
                  title="Mark as read"
                >
                  <IconCheck style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
