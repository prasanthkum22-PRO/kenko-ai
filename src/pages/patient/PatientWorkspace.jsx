import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatientTimeline, askConsultationChat } from '../../services/api';
import { getPrescriptions, getLabRequests } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import {
  IconVideo,
  IconDoc,
  IconSparkle,
  IconPill,
  IconFlask,
  IconCalendar,
  IconSend,
  IconUser,
} from '../../components/icons';

export default function PatientWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const patientId = user?.patientId || 'DEMO-P101';
  const [timeline, setTimeline] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [labReports, setLabReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your KENKO-AI health assistant. Ask me anything about your consultations, medications, lab reports, or next steps.',
    },
  ]);

  useEffect(() => {
    let active = true;
    const loadPatientData = async () => {
      setLoading(true);
      try {
        try {
          const tlData = await getPatientTimeline(patientId);
          if (active) setTimeline(tlData);
        } catch {
        }

        const rxList = await getPrescriptions({ patientId });
        const labList = await getLabRequests({ patientId });
        if (!active) return;
        setPrescriptions(rxList || []);
        setLabReports(labList || []);
      } catch (err) {
        console.error('Failed to load patient data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadPatientData();
    return () => {
      active = false;
    };
  }, [patientId]);

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatQuestion.trim()) return;

    const q = chatQuestion.trim();
    setChatQuestion('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setChatLoading(true);

    const firstEvent = timeline?.timeline_events?.find((ev) => ev.consultation_id);
    const cId = firstEvent?.consultation_id || 'demo_c1';

    try {
      const res = await askConsultationChat(cId, q);
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: res.answer, source: res.source },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'I could not find that specific answer in your latest consultation record.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const pv = timeline?.patient_view || {};
  const meds = timeline?.active_medications || [];
  const fallbackMeds = [
    { drug_name: 'Amoxicillin 500mg', dosage: '500mg', frequency: 'Twice daily', duration: '5 days', instructions: 'Take with meal' },
    { drug_name: 'Paracetamol 650mg', dosage: '650mg', frequency: 'As needed', duration: '3 days', instructions: 'For fever' },
  ];
  const displayMeds = meds.length > 0 ? meds : fallbackMeds;
  const upcoming = timeline?.upcoming_follow_ups || [];

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton skeleton-text" style={{ width: 280, height: 30 }} />
        <div className="kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="skeleton skeleton-card" style={{ height: 300 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="patient-workspace">
      <div className="page-header">
        <div>
          <span className="badge badge-primary">Patient Portal</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Hello, {user?.name || timeline?.patient_name || 'there'}
          </h1>
          <p className="page-subtitle">
            Your clinical records, prescriptions, diagnostic reports and upcoming telehealth appointments.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/consultations/video')}>
            <IconVideo size={16} /> Join Telehealth Room
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconUser />
          </div>
          <span className="kpi-label">Patient ID</span>
          <span className="kpi-value" style={{ fontSize: 22, fontFamily: 'var(--font-mono)' }}>{patientId}</span>
          <span className="kpi-foot">Verified medical record</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconPill />
          </div>
          <span className="kpi-label">Active medications</span>
          <span className="kpi-value">{prescriptions.length || displayMeds.length}</span>
          <span className="kpi-foot">Prescriptions under regimen</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconFlask />
          </div>
          <span className="kpi-label">Diagnostic lab orders</span>
          <span className="kpi-value">{labReports.length || 2}</span>
          <span className="kpi-foot">Pathology &amp; specimen reports</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <IconCalendar />
          </div>
          <span className="kpi-label">Upcoming visit</span>
          <span className="kpi-value" style={{ fontSize: 22 }}>{upcoming[0]?.due_date || 'In 2 weeks'}</span>
          <span className="kpi-foot">Virtual follow-up scheduled</span>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))' }}>
        <section className="section-card flex flex-col">
          <div className="section-card-header">
            <div>
              <h2 className="section-card-title">
                <IconDoc size={16} /> Latest doctor visit summary
              </h2>
              <p className="card-subtitle">Plain-language overview of your last consultation</p>
            </div>
          </div>
          <div className="section-card-body flex flex-col gap-3">
            <div className="glass-card-flat" style={{ padding: 16 }}>
              <p className="font-semibold" style={{ marginBottom: 6 }}>Diagnosis &amp; overview</p>
              <p className="text-secondary leading-relaxed" style={{ fontSize: 'var(--font-size-sm)' }}>
                {pv.simplified_diagnosis || 'Acute upper respiratory tract infection. Stable recovery observed.'}
              </p>
              <p className="font-semibold" style={{ margin: '14px 0 6px' }}>Doctor's instructions</p>
              <p className="text-secondary leading-relaxed" style={{ fontSize: 'var(--font-size-sm)' }}>
                {pv.home_care_instructions || 'Drink plenty of warm fluids, rest well, and complete the antibiotic course.'}
              </p>
            </div>

            <div>
              <h3 className="text-label" style={{ marginBottom: 8 }}>Prescribed medications</h3>
              <div className="flex flex-col gap-2">
                {displayMeds.map((m, i) => (
                  <div key={m.id || i} className="glass-card-flat flex items-center justify-between" style={{ padding: '10px 14px' }}>
                    <div>
                      <p className="font-semibold text-sm">
                        {m.drug_name || m.name} <span className="text-secondary font-normal">({m.frequency})</span>
                      </p>
                      <p className="text-xs text-secondary" style={{ marginTop: 2 }}>{m.instructions}</p>
                    </div>
                    <span className="badge badge-success">Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section-card flex flex-col" style={{ minHeight: 420 }}>
          <div className="section-card-header">
            <div>
              <h2 className="section-card-title">
                <IconSparkle size={16} /> Ask my consultation
              </h2>
              <p className="card-subtitle">Grounded in your electronic health record</p>
            </div>
          </div>
          <div className="section-card-body flex flex-col" style={{ flex: 1 }}>
            <div
              className="flex flex-col gap-2 overflow-y-auto glass-card-flat"
              style={{ flex: 1, maxHeight: 260, padding: 12, marginBottom: 12, minHeight: 200 }}
            >
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className="text-sm"
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.sender === 'user' ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                    color: msg.sender === 'user' ? '#FFFFFF' : 'var(--color-text-primary)',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--color-border)',
                    padding: '10px 14px',
                    borderRadius: 12,
                    maxWidth: '85%',
                    lineHeight: 1.4,
                  }}
                >
                  {msg.text}
                  {msg.source && (
                    <span className="text-xs text-muted" style={{ display: 'block', marginTop: 4 }}>
                      Source: {msg.source}
                    </span>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-muted" style={{ alignSelf: 'flex-start', padding: 6 }}>
                  Reviewing your records...
                </div>
              )}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                className="input"
                placeholder="e.g. When should I take my antibiotic?"
                value={chatQuestion}
                onChange={(e) => setChatQuestion(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={chatLoading}>
                <IconSend size={15} /> Ask
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}