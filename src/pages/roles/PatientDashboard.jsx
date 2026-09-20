import { useState, useEffect } from 'react';
import { getPatientTimeline, askConsultationChat } from '../../services/api';
import {
  IconDoc,
  IconStethoscope,
  IconPill,
  IconCalendar,
  IconFlask,
  IconSparkle,
  IconSend,
  IconAlert,
  IconClock,
} from '../../components/icons';

export default function PatientDashboard() {
  const [selectedPatientId, setSelectedPatientId] = useState('DEMO-P101');
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);

  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your consultation assistant. Ask me anything about your doctor visit, advised tests, medications, or follow-ups.',
    },
  ]);

  useEffect(() => {
    let active = true;
    const loadData = async (patId) => {
      setLoading(true);
      try {
        const data = await getPatientTimeline(patId);
        if (active) setTimeline(data);
      } catch (err) {
        console.error('Failed to load patient timeline:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData(selectedPatientId);
    return () => {
      active = false;
    };
  }, [selectedPatientId]);

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
        { sender: 'ai', text: 'I could not find that information in your consultation.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const pv = timeline?.patient_view || {};
  const meds = timeline?.active_medications || [];
  const tests = timeline?.pending_tests || [];
  const followups = timeline?.upcoming_follow_ups || [];
  const events = timeline?.timeline_events || [];

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton skeleton-text" style={{ width: 280, height: 30 }} />
        <div className="skeleton skeleton-card" style={{ height: 200 }} />
        <div className="skeleton skeleton-card" style={{ height: 300 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="patient-dashboard">
      <div className="page-header">
        <div>
          <span className="badge badge-primary">Patient Portal</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Hello, {timeline?.patient_name || 'there'}
          </h1>
          <p className="page-subtitle">
            A clear summary of your consultation, medications, tests and next steps.
          </p>
        </div>

        <div className="pill-tabs" role="group" aria-label="Switch patient">
          <button
            type="button"
            className={`pill-tab ${selectedPatientId === 'DEMO-P101' ? 'active' : ''}`}
            onClick={() => setSelectedPatientId('DEMO-P101')}
          >
            Aarav Sharma
          </button>
          <button
            type="button"
            className={`pill-tab ${selectedPatientId === 'DEMO-P102' ? 'active' : ''}`}
            onClick={() => setSelectedPatientId('DEMO-P102')}
          >
            Ananya Kumar
          </button>
        </div>
      </div>

      {pv.urgent_guidance && (
        <div className="alert alert-danger" role="alert">
          <IconAlert />
          <div className="flex-1">
            <strong>When to seek urgent care</strong>
            <div className="text-sm" style={{ marginTop: 2 }}>{pv.urgent_guidance}</div>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-5)' }}>
        <div className="flex flex-col gap-5">
          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">
                <IconDoc size={16} /> What we discussed
              </h2>
            </div>
            <div className="section-card-body">
              <p className="text-secondary leading-relaxed">
                {pv.what_we_discussed || 'Your recent consultation information is being organized.'}
              </p>
            </div>
          </section>

          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">
                <IconStethoscope size={16} /> What the doctor found
              </h2>
            </div>
            <div className="section-card-body">
              <p className="text-secondary leading-relaxed">
                {pv.doctor_findings || 'Vital signs and clinical assessment recorded in your electronic chart.'}
              </p>
            </div>
          </section>

          <section className="section-card">
            <div className="section-card-header">
              <div>
                <h2 className="section-card-title">
                  <IconPill size={16} /> Your medicines &amp; daily schedule
                </h2>
                <p className="card-subtitle">Prescribed during your consultation and verified by your physician</p>
              </div>
            </div>
            <div className="section-card-body">
              <div className="flex flex-col gap-3">
                {meds.length === 0 && <p className="text-sm text-muted">No active medications recorded.</p>}
                {meds.map((m) => (
                  <div key={m.id} className="glass-card-flat" style={{ padding: '12px 14px', borderLeft: '3px solid var(--color-primary)' }}>
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold">
                        {m.drug_name} <span className="text-secondary font-normal">{m.dosage}</span>
                      </p>
                      <span className="badge badge-success">Active</span>
                    </div>
                    <p className="text-xs text-secondary" style={{ marginTop: 4 }}>
                      <IconClock size={12} style={{ verticalAlign: '-2px' }} /> Schedule: {m.frequency} &middot; Duration: {m.duration}
                    </p>
                    <p className="text-xs text-muted" style={{ marginTop: 2 }}>{m.instructions}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">
                <IconCalendar size={16} /> Verified care timeline
              </h2>
            </div>
            <div className="section-card-body">
              <div className="flex flex-col gap-3">
                {events.length === 0 && <p className="text-sm text-muted">No timeline events recorded yet.</p>}
                {events.map((ev, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="status-dot active" style={{ marginTop: 14 }} />
                    <div className="glass-card-flat" style={{ flex: 1, padding: '10px 14px' }}>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{ev.title || ev.type}</p>
                        <span className="text-muted text-xs font-mono">{ev.date}</span>
                      </div>
                      <p className="text-xs text-secondary" style={{ marginTop: 4 }}>{ev.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">
                <IconFlask size={16} /> Tests you need to get done
              </h2>
            </div>
            <div className="section-card-body">
              <div className="flex flex-col gap-3">
                {tests.length === 0 && <p className="text-sm text-muted">No pending tests required.</p>}
                {tests.map((t) => (
                  <div key={t.id} className="glass-card-flat" style={{ padding: '12px 14px' }}>
                    <p className="font-semibold">{t.test_name}</p>
                    <p className="text-xs text-secondary" style={{ marginTop: 2 }}>Reason: {t.reason}</p>
                    <span className="badge badge-secondary" style={{ marginTop: 8 }}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">
                <IconCalendar size={16} /> Next appointment &amp; follow-up
              </h2>
            </div>
            <div className="section-card-body">
              <p className="text-sm text-secondary">{pv.follow_up || 'Follow-up date recorded in your record.'}</p>
              <div className="flex flex-col gap-3" style={{ marginTop: 10 }}>
                {followups.map((fu) => (
                  <div key={fu.id} className="glass-card-flat" style={{ padding: '12px 14px' }}>
                    <p className="font-semibold">{fu.action}</p>
                    <p className="text-xs text-primary font-medium" style={{ marginTop: 4 }}>Scheduled for: {fu.due_date}</p>
                    <span className={`badge ${fu.status === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}`} style={{ marginTop: 8 }}>
                      {fu.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="section-card-header">
              <div>
                <h2 className="section-card-title">
                  <IconSparkle size={16} /> Ask my consultation
                </h2>
                <p className="card-subtitle">Answers grounded strictly in your doctor consultation</p>
              </div>
            </div>
            <div className="section-card-body">
              <div className="flex flex-col gap-2" style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className="text-sm"
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.sender === 'user' ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                      color: msg.sender === 'user' ? '#FFFFFF' : 'var(--color-text-primary)',
                      padding: '8px 12px',
                      borderRadius: 10,
                      maxWidth: '88%',
                      border: msg.sender === 'user' ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    {msg.text}
                  </div>
                ))}
                {chatLoading && <p className="text-xs text-muted">Checking your consultation record...</p>}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  className="input"
                  placeholder="Ask about your visit, medicines or tests"
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={chatLoading}>
                  <IconSend size={15} /> Send
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}