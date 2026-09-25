import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getConsultationFull,
  updateTranscript,
  summarizeConsultation,
  finalizeConsultation,
  askConsultationChat,
} from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import GoogleMeetCard from '../components/GoogleMeetCard';
import GoogleMeetTranscriptViewer from '../components/GoogleMeetTranscriptViewer';
import {
  IconMic,
  IconVideo,
  IconCheck,
  IconX,
  IconAlert,
  IconRefresh,
  IconClipboard,
  IconSparkle,
  IconSend,
  IconArrowRight,
  IconStethoscope,
  IconActivity,
  IconFlask,
  IconPill,
  IconClock,
  IconPlus,
  IconInfo,
  IconDoc,
} from '../components/icons';

export default function ConsultationWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [transcriptViewMode, setTranscriptViewMode] = useState('structured'); // 'structured' | 'editor'


  const [consultation, setConsultation] = useState(null);
  const [segments, setSegments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);

  const [editableAssessment, setEditableAssessment] = useState('');
  const [editablePlan, setEditablePlan] = useState('');
  const [editableSymptoms, setEditableSymptoms] = useState([]);
  const [editableMedications, setEditableMedications] = useState([]);
  const [editableTests, setEditableTests] = useState([]);
  const [editableInstructions, setEditableInstructions] = useState([]);
  const [editableFollowUp, setEditableFollowUp] = useState({});
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizedSuccess, setFinalizedSuccess] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Consultation Assistant. Ask me anything about what was discussed, tests advised, medications prescribed, or follow-up instructions in this visit.',
    },
  ]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getConsultationFull(id);
        if (!active) return;
        setConsultation(data.consultation || data);
        setSegments(data.transcript || []);
        if (data.summary) {
          setSummary(data.summary);
          setEditableAssessment(data.summary.assessment || '');
          setEditablePlan(data.summary.treatment_plan || '');
          setEditableSymptoms(data.summary.symptoms || []);
          setEditableMedications(data.summary.medications || []);
          setEditableTests(data.summary.investigations || []);
          setEditableInstructions(data.summary.doctor_instructions || []);
          setEditableFollowUp(data.summary.follow_up || {});
        }
      } catch (err) {
        console.error('Failed to load consultation:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const handleSpeakerToggle = (segId, idx) => {
    setSegments((prev) =>
      prev.map((s, i) => {
        if (segId != null ? s.id === segId : i === idx) {
          return {
            ...s,
            speaker: s.speaker === 'Doctor' ? 'Patient' : 'Doctor',
            is_edited: true,
          };
        }
        return s;
      })
    );
  };

  const handleTextChange = (segId, idx, text) => {
    setSegments((prev) =>
      prev.map((s, i) => {
        if (segId != null ? s.id === segId : i === idx) {
          return {
            ...s,
            text,
            is_edited: true,
          };
        }
        return s;
      })
    );
  };

  const handleSaveTranscript = async () => {
    try {
      await updateTranscript(id, segments);
      success('Transcript changes saved successfully.', 'Transcript Saved');
    } catch (err) {
      console.error('Failed to save transcript:', err);
    }
  };

  const handleRegenerateSummary = async () => {
    setLoading(true);
    info('Extracting structured clinical summary with NVIDIA AI...', 'AI Extraction');
    try {
      await updateTranscript(id, segments);
      const newSummary = await summarizeConsultation(id);
      setSummary(newSummary);
      setEditableAssessment(newSummary.assessment);
      setEditablePlan(newSummary.treatment_plan);
      setEditableSymptoms(newSummary.symptoms || []);
      setEditableMedications(newSummary.medications || []);
      setEditableTests(newSummary.investigations || []);
      setEditableInstructions(newSummary.doctor_instructions || []);
      setEditableFollowUp(newSummary.follow_up || {});
      success('AI Clinical Summary extracted successfully!', 'Summary Ready');
    } catch (err) {
      console.error('Failed to regenerate summary:', err);
      toastError('Failed to extract summary from transcript.', 'AI Error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      await finalizeConsultation(id, {
        chief_complaint: summary?.chief_complaint,
        symptoms: editableSymptoms,
        investigations: editableTests,
        assessment: editableAssessment,
        treatment_plan: editablePlan,
        doctor_instructions: editableInstructions,
        medications: editableMedications,
        follow_up: {
          ...editableFollowUp,
          status: 'CONFIRMED',
        },
        approved_by: user?.name || consultation?.doctor_name || 'Attending Physician',
      });
      setFinalizedSuccess(true);
      success('Consultation approved & follow-up intelligence routed!', 'Doctor Verification Complete');
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to finalize:', err);
      toastError('Failed to finalize consultation records.', 'Verification Error');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleMedChange = (idx, field, val) => {
    const updated = [...editableMedications];
    updated[idx] = { ...updated[idx], [field]: val };
    setEditableMedications(updated);
  };

  const handleRemoveMed = (idx) => {
    setEditableMedications(editableMedications.filter((_, i) => i !== idx));
  };

  const handleAddMed = () => {
    setEditableMedications([
      ...editableMedications,
      { name: '', dosage: '500mg', frequency: '1-0-1', duration: '5 days', instructions: 'Take after food' },
    ]);
  };

  const handleHighlightSegment = (quote) => {
    if (!quote) return;
    const match = segments.find(
      (s) => s.text.toLowerCase().includes(quote.toLowerCase()) || quote.toLowerCase().includes(s.text.toLowerCase())
    );
    if (match) {
      setHighlightedId(match.id);
      const el = document.getElementById(`seg-${match.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedId(null), 3000);
    }
  };

  const handleCopyTranscript = () => {
    const full = segments.map((s) => `[${s.speaker}]: ${s.text}`).join('\n');
    navigator.clipboard.writeText(full);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleDownloadTranscript = () => {
    const full = segments.map((s) => `[${s.start_time.toFixed(1)}s] ${s.speaker}: ${s.text}`).join('\n');
    const blob = new Blob([full], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MediBridge_Transcript_${consultation?.patient_name || id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAskChat = async (e) => {
    e.preventDefault();
    if (!chatQuestion.trim()) return;

    const q = chatQuestion.trim();
    setChatQuestion('');
    setChatHistory((prev) => [...prev, { sender: 'user', text: q }]);
    setChatLoading(true);

    try {
      const res = await askConsultationChat(id, q);
      setChatHistory((prev) => [
        ...prev,
        { sender: 'ai', text: res.answer, source: res.source },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { sender: 'ai', text: 'I could not find that information in your consultation.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="loading-spinner" />
      </div>
    );
  }

  const filteredSegments = segments.filter((s) =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isVideo = consultation?.consultation_type === 'video';

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="workspace-page">
      <div className="section-card">
        <div className="section-card-header flex-wrap">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/consultations')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
                Back to Hub
              </button>
              <span className="badge badge-primary">
                {isVideo ? <IconVideo size={13} /> : <IconMic size={13} />}
                {isVideo ? 'Video' : 'In-Person'}
              </span>
              <span className="badge badge-secondary">
                <IconActivity size={13} /> Detected Language: {consultation?.detected_language || 'English'}
              </span>
              {consultation?.is_demo && (
                <span className="badge badge-warning">
                  <IconSparkle size={13} /> DEMO DATA
                </span>
              )}
              {consultation?.is_approved ? (
                <span className="badge badge-success">
                  <IconCheck size={13} /> Doctor Approved &amp; Routed
                </span>
              ) : (
                <span className="badge badge-warning">
                  <IconAlert size={13} /> Pending Doctor Verification
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold">
              {consultation?.patient_name}{' '}
              <span className="text-sm font-normal text-muted">
                ({consultation?.patient_gender}, {consultation?.patient_age} yrs • ID: {consultation?.patient_id})
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn btn-secondary text-xs" onClick={handleRegenerateSummary}>
              <IconRefresh size={14} /> Re-Extract
            </button>
            {!consultation?.is_approved ? (
              <button
                id="approve-finalize-btn"
                className="btn btn-primary"
                onClick={handleFinalize}
                disabled={isFinalizing}
              >
                <IconCheck size={14} /> {isFinalizing ? 'Confirming & Routing...' : 'Approve & Finalize Consultation'}
              </button>
            ) : (
              <button className="btn btn-outline text-xs" onClick={() => navigate('/roles/doctor')}>
                View on Doctor Portal <IconArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {finalizedSuccess && (
        <div className="alert alert-success animate-fade-in" role="status">
          <IconCheck size={16} className="flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-success">Consultation Finalized &amp; Follow-up Confirmed!</p>
            <p className="text-xs">
              Prescriptions were added to Patient Medication view, Lab tasks were dispatched, and Follow-up status
              was transitioned to CONFIRMED.
            </p>
          </div>
        </div>
      )}

      {/* ── Google Meet Space & Telehealth Orchestration ── */}
      <GoogleMeetCard
        consultation={consultation}
        onTranscriptReady={(transcriptData) => {
          setReloadKey((prev) => prev + 1);
          handleRegenerateSummary();
        }}
        onConsultationUpdated={() => setReloadKey((prev) => prev + 1)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Transcript Column (Structured Viewer or Segment Editor) ── */}
        <div className="flex flex-col gap-3">
          {/* Transcript View Mode Switcher */}
          <div className="flex items-center justify-between gap-2 p-1.5 bg-surface rounded border border-subtle">
            <span className="text-xs font-semibold text-muted px-2">TRANSCRIPT VIEW</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`btn btn-xs ${transcriptViewMode === 'structured' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setTranscriptViewMode('structured')}
              >
                Structured Clinical View
              </button>
              <button
                type="button"
                className={`btn btn-xs ${transcriptViewMode === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setTranscriptViewMode('editor')}
              >
                Inline Segment Editor
              </button>
            </div>
          </div>

          {transcriptViewMode === 'structured' ? (
            <GoogleMeetTranscriptViewer
              consultation={consultation}
              segments={segments}
              onGenerateSummary={handleRegenerateSummary}
              onMarkReviewed={() => {
                success('Transcript verified and marked as reviewed.', 'Reviewed');
              }}
              isSummarizing={loading}
            />
          ) : (
            <div className="glass-card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <IconDoc size={16} /> Verifiable Audio Transcript
                </h2>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-sm" onClick={handleCopyTranscript} title="Copy to clipboard">
                    <IconClipboard size={12} /> {copyStatus ? 'Copied!' : 'Copy'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleDownloadTranscript} title="Download text">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v12" />
                      <path d="m7 10 5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                    TXT
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleSaveTranscript}>
                    <IconCheck size={12} /> Save Edits
                  </button>
                </div>
              </div>

              <input
                type="text"
                className="input text-xs"
                placeholder="Search transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />


          <div className="flex flex-col gap-2">
            {segments.length === 0 ? (
              <p className="text-xs text-muted text-center p-6">
                No transcript segments were saved for this consultation. Please check the backend logs or re-record
                the audio.
              </p>
            ) : filteredSegments.length === 0 ? (
              <p className="text-xs text-muted text-center p-6">No transcript segments match &quot;{searchQuery}&quot;.</p>
            ) : (
              filteredSegments.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  id={`seg-${seg.id}`}
                  className="glass-card-flat p-3 flex flex-col gap-2"
                  style={
                    highlightedId === seg.id
                      ? {
                          borderColor: 'var(--color-primary)',
                          boxShadow: '0 0 0 2px var(--color-primary-light)',
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${seg.speaker === 'Doctor' ? 'btn-outline-primary' : 'btn-ghost'}`}
                      onClick={() => handleSpeakerToggle(seg.id, idx)}
                      title="Click to toggle speaker tag (Doctor <-> Patient)"
                    >
                      {seg.speaker} <IconRefresh size={11} />
                    </button>
                    <span className="text-xs text-muted">
                      {typeof seg.start_time === 'number' ? seg.start_time.toFixed(1) : '0.0'}s -{' '}
                      {typeof seg.end_time === 'number' ? seg.end_time.toFixed(1) : '0.0'}s
                    </span>
                  </div>
                  <textarea
                    className="input text-xs"
                    rows={2}
                    value={seg.text}
                    onChange={(e) => handleTextChange(seg.id, idx, e.target.value)}
                  />
                </div>
              ))
            )}
          </div>

          <div className="glass-card-flat p-3 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-primary flex items-center gap-2">
              <IconSparkle size={14} /> Ask My Consultation (Grounded Q&amp;A)
            </h3>

            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 160 }}>
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className="text-xs"
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.sender === 'user' ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                    color: msg.sender === 'user' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    maxWidth: '85%',
                  }}
                >
                  <div>{msg.text}</div>
                  {msg.source && (
                    <span className="flex items-center gap-1" style={{ fontSize: '0.65rem', opacity: 0.85, marginTop: 2 }}>
                      <IconInfo size={11} /> Source: {msg.source}
                    </span>
                  )}
                </div>
              ))}
              {chatLoading && <p className="text-xs text-muted">Consulting medical record...</p>}
            </div>

            <form onSubmit={handleAskChat} className="flex gap-2">
              <input
                type="text"
                className="input text-xs"
                placeholder="e.g. What tests did the doctor advise?"
                value={chatQuestion}
                onChange={(e) => setChatQuestion(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={chatLoading}>
                <IconSend size={12} /> Ask
              </button>
            </form>
          </div>
        </div>
        )}
      </div>

        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <IconStethoscope size={16} /> Doctor Review &amp; Edit Interface
            </h2>
            <span className="text-xs text-muted">NVIDIA Cloud AI — Zero-Hallucination</span>
          </div>

          <div className="glass-card-flat p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <IconActivity size={14} className="text-danger" /> Chief Concern &amp; Reported Symptoms
            </h3>
            {editableSymptoms.length > 0 ? (
              <div className="flex flex-col gap-3">
                {editableSymptoms.map((sym, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{sym.name}</p>
                      <p className="text-xs text-muted">Duration: {sym.duration || 'Not mentioned'}</p>
                    </div>
                    {sym.quote && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm flex-shrink-0"
                        onClick={() => handleHighlightSegment(sym.quote)}
                      >
                        <IconArrowRight size={12} /> Quote: &quot;{sym.quote.substring(0, 32)}...&quot;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No symptoms extracted.</p>
            )}
          </div>

          <div className="glass-card-flat p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <IconActivity size={14} /> Recorded Vital Signs
            </h3>
            <div className="grid grid-cols-4 gap-2">
              <div className="glass-card-flat p-2 text-center flex flex-col gap-1">
                <span className="kpi-label">BP</span>
                <span className="text-sm font-bold">{summary?.vitals?.bp || 'Not documented'}</span>
              </div>
              <div className="glass-card-flat p-2 text-center flex flex-col gap-1">
                <span className="kpi-label">Pulse</span>
                <span className="text-sm font-bold">{summary?.vitals?.pulse || 'Not documented'}</span>
              </div>
              <div className="glass-card-flat p-2 text-center flex flex-col gap-1">
                <span className="kpi-label">Temp</span>
                <span className="text-sm font-bold">{summary?.vitals?.temperature || 'Not documented'}</span>
              </div>
              <div className="glass-card-flat p-2 text-center flex flex-col gap-1">
                <span className="kpi-label">SpO2</span>
                <span className="text-sm font-bold">{summary?.vitals?.spo2 || 'Not documented'}</span>
              </div>
            </div>
          </div>

          <div className="glass-card-flat p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <IconFlask size={14} /> Tests &amp; Investigations Mentioned
            </h3>
            {editableTests.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {editableTests.map((inv, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{inv.test_name || inv.name}</p>
                      <p className="text-xs text-muted">{inv.reason || 'Diagnostic evaluation'}</p>
                    </div>
                    {inv.quote && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm flex-shrink-0"
                        onClick={() => handleHighlightSegment(inv.quote)}
                      >
                        <IconArrowRight size={12} /> Quote
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No lab tests requested in consultation.</p>
            )}
          </div>

          <div className="glass-card-flat p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <IconPill size={14} /> Prescribed Medications
              </h3>
              <button type="button" className="btn btn-ghost btn-sm text-primary" onClick={handleAddMed}>
                <IconPlus size={14} /> Add Med
              </button>
            </div>
            {editableMedications.length > 0 ? (
              <div className="table-container">
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Dose</th>
                      <th>Schedule</th>
                      <th>Duration</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {editableMedications.map((med, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="text"
                            className="rx-med-input font-semibold"
                            value={med.name || ''}
                            onChange={(e) => handleMedChange(i, 'name', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="rx-med-input"
                            style={{ width: 72 }}
                            value={med.dosage || ''}
                            onChange={(e) => handleMedChange(i, 'dosage', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="rx-med-input"
                            style={{ width: 72 }}
                            value={med.frequency || ''}
                            onChange={(e) => handleMedChange(i, 'frequency', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="rx-med-input"
                            style={{ width: 72 }}
                            value={med.duration || ''}
                            onChange={(e) => handleMedChange(i, 'duration', e.target.value)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => handleRemoveMed(i)}
                          >
                            <IconX size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted">No medications prescribed.</p>
            )}
          </div>

          <div className="glass-card-flat p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <IconClock size={14} /> Follow-Up Intelligence &amp; Assessment
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted">Clinical Assessment / Diagnosis</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={editableAssessment}
                  onChange={(e) => setEditableAssessment(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted">Treatment Plan &amp; Advice</label>
                <textarea
                  className="input text-xs"
                  rows={2}
                  value={editablePlan}
                  onChange={(e) => setEditablePlan(e.target.value)}
                />
              </div>

              <div className="glass-card-flat p-3 flex flex-col gap-1">
                <p className="text-xs font-bold text-primary flex items-center gap-1">
                  <IconClock size={12} /> Follow-up Action:{' '}
                  {editableFollowUp?.action || editableFollowUp?.reason || 'Clinical Review'}
                </p>
                <p className="text-xs text-secondary">
                  Time Reference: <strong>{editableFollowUp?.date_str || 'In 7 days'}</strong> • Status:{' '}
                  <span className="badge badge-warning text-xs">
                    {editableFollowUp?.status || 'PENDING_DOCTOR_CONFIRMATION'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}