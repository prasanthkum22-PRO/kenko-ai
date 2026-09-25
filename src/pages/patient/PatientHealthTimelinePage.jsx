/**
 * Patient Health Timeline Page
 * Route: /patient/health-timeline
 * Displays authorized patient chronological history (Consultations, Prescriptions, Tests, Follow-Ups).
 */
import { useState, useEffect } from 'react';
import { getPatientHealthTimeline } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconActivity, IconRx, IconClock, IconDoc,
  IconHeart, IconCheck, IconShield
} from '../../components/icons';

export default function PatientHealthTimelinePage() {
  const { error: toastError } = useToast();
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTimeline() {
      try {
        setLoading(true);
        const data = await getPatientHealthTimeline();
        setTimeline(data || []);
      } catch (err) {
        toastError(err.response?.data?.detail || 'Failed to load health timeline.');
      } finally {
        setLoading(false);
      }
    }
    loadTimeline();
  }, [toastError]);

  const getIcon = (type) => {
    switch (type) {
      case 'CONSULTATION':
        return <IconDoc size={16} className="text-primary" />;
      case 'PRESCRIPTION':
        return <IconRx size={16} className="text-success" />;
      case 'FOLLOW_UP':
        return <IconClock size={16} className="text-warning" />;
      case 'TEST':
        return <IconActivity size={16} className="text-info" />;
      default:
        return <IconHeart size={16} className="text-primary" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="glass-card p-6 flex items-center justify-between border-l-4 border-primary">
        <div>
          <span className="badge badge-primary text-xs font-semibold mb-1">Personal Health Record</span>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <IconActivity className="text-primary" size={24} /> My Health & Care Timeline
          </h1>
          <p className="text-xs text-muted mt-1">
            Complete history of your consultations, prescriptions, tests, and care plans.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <span className="spinner mr-3" />
          <span>Loading your health timeline...</span>
        </div>
      ) : timeline.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted text-sm">
          No medical records found in your health timeline yet.
        </div>
      ) : (
        <div className="glass-card p-6 space-y-6">
          <div className="relative pl-6 space-y-8 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
            {timeline.map((item, idx) => (
              <div key={idx} className="relative space-y-1">
                <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getIcon(item.type)}
                    <h3 className="font-bold text-white text-sm">{item.title}</h3>
                  </div>
                  <span className="text-xs text-muted font-mono">{item.date}</span>
                </div>
                <p className="text-xs text-muted mt-0.5 bg-surface/40 p-2.5 rounded-lg border border-border/30">
                  {item.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
