import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  IconBell,
  IconShield,
  IconCheck,
  IconClock,
} from '../components/icons';

export default function NotificationPreferencesPage() {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [prefs, setPrefs] = useState({
    appointments_push: true,
    appointments_inapp: true,
    medications_push: true,
    medications_inapp: true,
    followup_push: true,
    followup_inapp: true,
    prescriptions_push: true,
    prescriptions_inapp: true,
    general_push: false,
    general_inapp: true,
  });

  const handleToggle = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      addToast('Notification preferences updated.', 'success');
    }, 400);
  };

  const items = [
    {
      id: 'appointments',
      title: 'Appointment Reminders',
      description: 'Alerts at 24 hours, 1 hour, and 15 minutes before your scheduled Google Meet consultation.',
      pushKey: 'appointments_push',
      inAppKey: 'appointments_inapp',
      locked: false,
    },
    {
      id: 'medications',
      title: 'Medication Dosing Reminders',
      description: 'Morning, Afternoon, and Night scheduled prompts for active prescription regimens.',
      pushKey: 'medications_push',
      inAppKey: 'medications_inapp',
      locked: false,
    },
    {
      id: 'followup',
      title: 'Follow-Up Check-In Alerts',
      description: 'Clinician-requested condition check-ins and recovery milestones.',
      pushKey: 'followup_push',
      inAppKey: 'followup_inapp',
      locked: false,
    },
    {
      id: 'prescriptions',
      title: 'Prescription & Clinical Notes Updates',
      description: 'Mandatory clinical safety notifications when a doctor issues or alters a prescription.',
      pushKey: 'prescriptions_push',
      inAppKey: 'prescriptions_inapp',
      locked: true, // Clinically required
    },
    {
      id: 'general',
      title: 'General Platform News & Health Posts',
      description: 'Verified doctor medical posts, tips, and seasonal health alerts.',
      pushKey: 'general_push',
      inAppKey: 'general_inapp',
      locked: false,
    },
  ];

  return (
    <div className="workspace-container" style={{ padding: '2rem 1.5rem', maxWidth: 860, margin: '0 auto' }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
          <Link to="/notifications" style={{ color: 'var(--color-text-secondary, #94a3b8)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to Notification Center
          </Link>
        </div>
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
            }}
          >
            <IconBell style={{ width: 24, height: 24 }} />
          </div>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Notification Preferences
            </h1>
            <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.95rem', marginTop: 2 }}>
              Manage notification channels for clinical workflows and push alerts.
            </p>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: '2rem',
          background: 'var(--color-surface, #1e293b)',
          borderRadius: 18,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ maxWidth: 460 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                    {item.title}
                  </h3>
                  {item.locked && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      <IconShield style={{ width: 10, height: 10 }} /> Clinical Mandatory
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  {item.description}
                </p>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: item.locked ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={prefs[item.inAppKey]}
                    disabled={item.locked}
                    onChange={() => handleToggle(item.inAppKey)}
                  />
                  <span>In-App</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: item.locked ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={prefs[item.pushKey]}
                    disabled={item.locked}
                    onChange={() => handleToggle(item.pushKey)}
                  />
                  <span>Push (FCM)</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving Changes…' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
