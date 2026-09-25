/**
 * Doctor Consultation Workspace Page
 * Route: /doctor/consultations/:id and /consultations/:id
 * Tabs: Overview | Transcript | Clinical Notes | Prescription | Follow-Up
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getClinicalWorkspace,
  addTranscriptNote,
  generateAiClinicalSummary,
  saveDraftClinicalNote,
  approveClinicalNote,
  savePrescriptionDraft,
  approvePrescription,
  issuePrescription,
  createFollowUpPlan,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  IconDoc, IconSparkle, IconCheck, IconClock, IconPlus,
  IconRx, IconShield, IconUsers, IconActivity,
  IconVideo, IconMic, IconFileText, IconCalendar, IconAlert
} from '../../components/icons';

export default function DoctorConsultationWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Transcript states
  const [searchQuery, setSearchQuery] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('ALL');
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [inlineNoteText, setInlineNoteText] = useState('');

  // Clinical note form states
  const [clinicalForm, setClinicalForm] = useState({
    chief_complaint: '',
    hpi: '',
    duration: '',
    relevant_history: '',
    examination: '',
    investigations: '',
    assessment: '',
    plan: '',
    doctor_notes: '',
    soap_subjective: '',
    soap_objective: '',
    soap_assessment: '',
    soap_plan: '',
  });
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Prescription states
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [internalNotes, setInternalNotes] = useState('');
  const [patientInstructions, setPatientInstructions] = useState('');
  const [newMed, setNewMed] = useState({
    medicine_name: '',
    dosage: '500mg',
    frequency: '1-0-1',
    duration: '5 days',
    route: 'Oral',
    instructions: 'After food',
  });

  // Follow-up states
  const [followUpForm, setFollowUpForm] = useState({
    instruction: 'Review in clinical practice after 7 days or upon test completion.',
    interval_days: 7,
    condition_monitoring: 'Standard recovery monitoring',
    recommended_test_name: '',
    test_reason: 'Evaluation',
    test_instructions: 'Complete before follow-up consultation.',
  });

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getClinicalWorkspace(id);
      setWorkspace(data);

      if (data.clinical_note) {
        setClinicalForm({
          chief_complaint: data.clinical_note.chief_complaint || '',
          hpi: data.clinical_note.hpi || '',
          duration: data.clinical_note.duration || '',
          relevant_history: data.clinical_note.relevant_history || '',
          examination: data.clinical_note.examination || '',
          investigations: data.clinical_note.investigations || '',
          assessment: data.clinical_note.assessment || '',
          plan: data.clinical_note.plan || '',
          doctor_notes: data.clinical_note.doctor_notes || '',
          soap_subjective: data.clinical_note.soap?.subjective || '',
          soap_objective: data.clinical_note.soap?.objective || '',
          soap_assessment: data.clinical_note.soap?.assessment || '',
          soap_plan: data.clinical_note.soap?.plan || '',
        });
      }

      if (data.prescription?.items) {
        setPrescriptionItems(data.prescription.items);
        setInternalNotes(data.prescription.internal_doctor_notes || '');
        setPatientInstructions(data.prescription.patient_instructions || '');
      }

      if (data.follow_up_plan) {
        setFollowUpForm((prev) => ({
          ...prev,
          instruction: data.follow_up_plan.instruction || prev.instruction,
          recommended_test_name: data.follow_up_plan.recommended_test_name || '',
        }));
      }
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to load consultation workspace.');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Handle adding transcript note
  const handleSaveTranscriptNote = async (entryId) => {
    if (!inlineNoteText.trim()) return;
    try {
      await addTranscriptNote(id, { transcript_entry_id: entryId, note: inlineNoteText });
      success('Clinical note added to transcript segment.');
      setSelectedSegmentId(null);
      setInlineNoteText('');
      loadWorkspace();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to add transcript note.');
    }
  };

  // AI summary generation
  const handleGenerateSummary = async () => {
    try {
      setIsAiGenerating(true);
      info('AI reading approved consultation transcript...');
      const res = await generateAiClinicalSummary(id);
      success(res.message || 'AI Clinical Summary generated. Doctor review required.');
      await loadWorkspace();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to generate AI summary.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Save draft note
  const handleSaveDraftNote = async () => {
    try {
      setIsSavingNote(true);
      await saveDraftClinicalNote(id, clinicalForm);
      success('Clinical note draft saved.');
      loadWorkspace();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to save draft.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Approve note
  const handleApproveNote = async () => {
    if (!window.confirm('Approve and sign this clinical note? This will record your doctor approval audit event.')) return;
    try {
      await approveClinicalNote(id);
      success('Clinical note approved and signed.');
      loadWorkspace();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to approve note.');
    }
  };

  // Prescription functions
  const handleAddMedicine = () => {
    if (!newMed.medicine_name.trim()) {
      toastError('Please enter medicine name.');
      return;
    }
    setPrescriptionItems((prev) => [...prev, { ...newMed, is_ai_suggested: false, doctor_confirmed: true }]);
    setNewMed({
      medicine_name: '',
      dosage: '500mg',
      frequency: '1-0-1',
      duration: '5 days',
      route: 'Oral',
      instructions: 'After food',
    });
  };

  const handleRemoveMedicine = (idx) => {
    setPrescriptionItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePrescriptionDraft = async () => {
    try {
      await savePrescriptionDraft(id, {
        items: prescriptionItems,
        internal_doctor_notes: internalNotes,
        patient_instructions: patientInstructions,
      });
      success('Prescription draft saved.');
      loadWorkspace();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to save prescription draft.');
    }
  };

  const handleApprovePrescription = async () => {
    try {
      await handleSavePrescriptionDraft();
      await approvePrescription(id);
      success('Prescription approved.');
      loadWorkspace();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to approve prescription.');
    }
  };

  const handleIssuePrescription = async () => {
    if (!window.confirm('Issue prescription to patient? Daily medication tasks will be scheduled automatically.')) return;
    try {
      await issuePrescription(id);
      success('Prescription issued! Daily patient medication reminders created.');
      loadWorkspace();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to issue prescription.');
    }
  };

  // Follow-up plan creation
  const handleCreateFollowUp = async () => {
    try {
      await createFollowUpPlan(id, followUpForm);
      success('Follow-up plan & patient care tasks created.');
      loadWorkspace();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to create follow-up plan.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="spinner mr-3" />
        <span>Loading clinical workspace...</span>
      </div>
    );
  }

  const consult = workspace?.consultation;
  const filteredTranscript = (workspace?.transcript || []).filter((s) => {
    const matchesSpeaker = speakerFilter === 'ALL' || s.speaker.toUpperCase().includes(speakerFilter);
    const matchesText = !searchQuery || s.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSpeaker && matchesText;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="glass-card p-6 flex flex-wrap items-center justify-between gap-4 border-l-4 border-primary">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="badge badge-primary text-xs font-semibold uppercase">
              {consult?.consultation_type === 'video' ? 'Google Meet Telehealth' : 'In-Person Consultation'}
            </span>
            <span className="text-xs text-muted">ID: {consult?.id?.slice(0, 8)}</span>
            {workspace?.clinical_note?.status === 'APPROVED' ? (
              <span className="badge badge-success text-xs font-semibold">✓ Note Approved</span>
            ) : (
              <span className="badge badge-warning text-xs font-semibold">Review Required</span>
            )}
          </div>
          <h1 className="text-2xl font-black text-white">
            {consult?.patient_name} <span className="text-sm font-normal text-muted">({consult?.patient_gender || 'Patient'}, {consult?.patient_age || '—'} yrs)</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            Doctor: <strong className="text-white">{consult?.doctor_name}</strong> • Duration: {Math.floor((consult?.duration_seconds || 0) / 60)}m {(consult?.duration_seconds || 0) % 60}s
          </p>
        </div>

        {/* Quick Tabs Navigation */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: IconDoc },
            { id: 'transcript', label: `Transcript (${workspace?.transcript?.length || 0})`, icon: IconMic },
            { id: 'notes', label: 'Clinical Notes & SOAP', icon: IconFileText },
            { id: 'prescription', label: `Prescription (${prescriptionItems.length})`, icon: IconRx },
            { id: 'followup', label: 'Follow-Up Intelligence', icon: IconClock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary shadow-lg' : 'btn-outline'}`}
            >
              <tab.icon size={14} className="mr-1.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <IconUsers size={18} className="text-primary" /> Patient Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted">Patient ID</span>
                <span className="font-mono">{consult?.patient_id}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted">Consultation Date</span>
                <span>{consult?.created_at?.slice(0, 10) || 'Today'}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted">Audio / Language</span>
                <span>{consult?.detected_language || 'English'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Consent Status</span>
                <span className="text-success font-semibold">✓ Verified & Recorded</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <IconActivity size={18} className="text-success" /> Care Workflow Status
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center font-bold">✓</span>
                <span>Conference Completed ({Math.floor((consult?.duration_seconds || 0) / 60)} mins)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${consult?.has_transcript ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                  {consult?.has_transcript ? '✓' : '•'}
                </span>
                <span>Google Meet Transcript Ingested</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${workspace?.clinical_note?.status === 'APPROVED' ? 'bg-success/20 text-success' : 'bg-muted/20 text-muted'}`}>
                  {workspace?.clinical_note?.status === 'APPROVED' ? '✓' : '•'}
                </span>
                <span>Clinical Documentation Signed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${workspace?.prescription?.status === 'ISSUED' ? 'bg-success/20 text-success' : 'bg-muted/20 text-muted'}`}>
                  {workspace?.prescription?.status === 'ISSUED' ? '✓' : '•'}
                </span>
                <span>Prescription & Medication Tasks Issued</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${workspace?.follow_up_plan ? 'bg-success/20 text-success' : 'bg-muted/20 text-muted'}`}>
                  {workspace?.follow_up_plan ? '✓' : '•'}
                </span>
                <span>Follow-Up Intelligence Plan Active</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <IconSparkle size={18} className="text-warning" /> Next Clinical Action
              </h2>
              <p className="text-xs text-muted mt-2">
                {workspace?.clinical_note?.status !== 'APPROVED'
                  ? 'Review the conversation transcript and approve the structured SOAP clinical note.'
                  : workspace?.prescription?.status !== 'ISSUED'
                  ? 'Review medications and issue the prescription to the patient.'
                  : 'Follow-up plan is scheduled. Monitor patient check-in responses.'}
              </p>
            </div>
            <button
              onClick={() => setActiveTab(workspace?.clinical_note?.status !== 'APPROVED' ? 'notes' : 'prescription')}
              className="btn btn-primary w-full shadow-lg"
            >
              Continue Clinical Workflow →
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: TRANSCRIPT */}
      {activeTab === 'transcript' && (
        <div className="space-y-4">
          <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search transcript phrases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-sm w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Speaker:</span>
              <select
                value={speakerFilter}
                onChange={(e) => setSpeakerFilter(e.target.value)}
                className="select select-sm"
              >
                <option value="ALL">All Speakers</option>
                <option value="DOCTOR">Doctor</option>
                <option value="PATIENT">Patient</option>
              </select>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4 max-h-[600px] overflow-y-auto">
            {filteredTranscript.length === 0 ? (
              <p className="text-muted text-sm text-center py-8">No transcript segments match filter.</p>
            ) : (
              filteredTranscript.map((seg) => (
                <div
                  key={seg.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    seg.speaker.toLowerCase().includes('doctor')
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-surface/40 border-border/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs font-bold ${seg.speaker.toLowerCase().includes('doctor') ? 'badge-primary' : 'badge-info'}`}>
                        {seg.speaker}
                      </span>
                      <span className="text-xs font-mono text-muted">{seg.timestamp}</span>
                    </div>
                    <button
                      onClick={() => setSelectedSegmentId(selectedSegmentId === seg.id ? null : seg.id)}
                      className="btn btn-ghost btn-xs text-primary"
                    >
                      + Add Clinical Note
                    </button>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed">{seg.text}</p>

                  {/* Existing Doctor Note */}
                  {seg.note && (
                    <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                      <strong>Doctor Note:</strong> {seg.note}
                    </div>
                  )}

                  {/* Inline Note Composer */}
                  {selectedSegmentId === seg.id && (
                    <div className="mt-3 p-3 rounded-lg bg-surface border border-primary/40 space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Add doctor observation or clinical commentary for this segment..."
                        value={inlineNoteText}
                        onChange={(e) => setInlineNoteText(e.target.value)}
                        className="textarea textarea-sm w-full"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setSelectedSegmentId(null)} className="btn btn-ghost btn-xs">
                          Cancel
                        </button>
                        <button onClick={() => handleSaveTranscriptNote(seg.id)} className="btn btn-primary btn-xs">
                          Save Note
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CLINICAL NOTES & SOAP */}
      {activeTab === 'notes' && (
        <div className="space-y-6">
          <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-primary/10 to-transparent">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                <IconSparkle className="text-warning" size={18} /> AI Clinical Extraction & SOAP Documentation
              </h3>
              <p className="text-xs text-muted">
                Extracts chief complaints, vitals, and SOAP notes directly from Google Meet transcript. Zero autonomous diagnosis.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateSummary}
                disabled={isAiGenerating}
                className="btn btn-warning btn-sm shadow"
              >
                {isAiGenerating ? 'Extracting...' : '✨ Generate Clinical Summary'}
              </button>
            </div>
          </div>

          {/* AI Banner Notice */}
          <div className="p-3 rounded-lg bg-info/10 border border-info/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <IconShield className="text-info" size={16} />
              <span>
                <strong>CLINICAL SAFETY NOTICE:</strong> AI outputs are labeled <em>AI GENERATED</em>. The consulting doctor must review, edit, and sign before finalization.
              </span>
            </div>
            {workspace?.clinical_note?.status === 'APPROVED' && (
              <span className="badge badge-success font-bold">Signed by {workspace.clinical_note.approved_by}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Structured Clinical Sections */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="font-bold text-base border-b border-border/40 pb-2">Structured Clinical Fields</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Chief Complaint</label>
                  <input
                    type="text"
                    value={clinicalForm.chief_complaint}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, chief_complaint: e.target.value })}
                    className="input input-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">History of Present Illness (HPI)</label>
                  <textarea
                    rows={3}
                    value={clinicalForm.hpi}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, hpi: e.target.value })}
                    className="textarea textarea-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Duration</label>
                  <input
                    type="text"
                    value={clinicalForm.duration}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, duration: e.target.value })}
                    className="input input-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Examination / Observations</label>
                  <textarea
                    rows={2}
                    value={clinicalForm.examination}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, examination: e.target.value })}
                    className="textarea textarea-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Internal Doctor Notes (Private)</label>
                  <textarea
                    rows={2}
                    placeholder="Private clinical notes not visible to patient..."
                    value={clinicalForm.doctor_notes}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, doctor_notes: e.target.value })}
                    className="textarea textarea-sm w-full"
                  />
                </div>
              </div>
            </div>

            {/* SOAP Notes */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="font-bold text-base border-b border-border/40 pb-2">SOAP Format Documentation</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-primary block mb-1">S — Subjective (Patient Reported)</label>
                  <textarea
                    rows={3}
                    value={clinicalForm.soap_subjective}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, soap_subjective: e.target.value })}
                    className="textarea textarea-sm w-full font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-info block mb-1">O — Objective (Vitals & Clinical Data)</label>
                  <textarea
                    rows={2}
                    value={clinicalForm.soap_objective}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, soap_objective: e.target.value })}
                    className="textarea textarea-sm w-full font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-warning block mb-1">A — Assessment</label>
                  <textarea
                    rows={2}
                    value={clinicalForm.soap_assessment}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, soap_assessment: e.target.value })}
                    className="textarea textarea-sm w-full font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-success block mb-1">P — Plan (Care & Instructions)</label>
                  <textarea
                    rows={2}
                    value={clinicalForm.soap_plan}
                    onChange={(e) => setClinicalForm({ ...clinicalForm, soap_plan: e.target.value })}
                    className="textarea textarea-sm w-full font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="glass-card p-4 flex justify-between items-center">
            <button
              onClick={handleSaveDraftNote}
              disabled={isSavingNote}
              className="btn btn-outline btn-sm"
            >
              {isSavingNote ? 'Saving...' : '💾 Save Draft'}
            </button>
            <button
              onClick={handleApproveNote}
              className="btn btn-success btn-sm font-bold shadow-lg"
            >
              ✓ Approve Clinical Note
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: PRESCRIPTION */}
      {activeTab === 'prescription' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <IconRx size={20} className="text-primary" /> Prescription Studio
                </h3>
                <p className="text-xs text-muted">
                  Add medicines, verify dosage schedules, and issue digital prescription.
                </p>
              </div>
              <span className={`badge font-semibold ${workspace?.prescription?.status === 'ISSUED' ? 'badge-success' : 'badge-warning'}`}>
                Status: {workspace?.prescription?.status || 'DRAFT'}
              </span>
            </div>

            {/* Medicine Add Form */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 rounded-lg bg-surface/50 border border-border/40">
              <div className="md:col-span-2">
                <label className="text-xs text-muted block mb-1">Medicine Name</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol"
                  value={newMed.medicine_name}
                  onChange={(e) => setNewMed({ ...newMed, medicine_name: e.target.value })}
                  className="input input-sm w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Dosage</label>
                <input
                  type="text"
                  value={newMed.dosage}
                  onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                  className="input input-sm w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Frequency</label>
                <input
                  type="text"
                  placeholder="1-0-1"
                  value={newMed.frequency}
                  onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                  className="input input-sm w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Duration</label>
                <input
                  type="text"
                  value={newMed.duration}
                  onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                  className="input input-sm w-full"
                />
              </div>
              <div className="flex items-end">
                <button onClick={handleAddMedicine} className="btn btn-primary btn-sm w-full">
                  + Add Medicine
                </button>
              </div>
            </div>

            {/* Current Medicines Table */}
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="border-b border-border/40 text-xs text-muted">
                    <th>#</th>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Instructions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptionItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-muted text-xs">
                        No medicines added yet.
                      </td>
                    </tr>
                  ) : (
                    prescriptionItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/20">
                        <td>{idx + 1}</td>
                        <td className="font-bold text-white">{item.medicine_name}</td>
                        <td>{item.dosage}</td>
                        <td>
                          <span className="badge badge-sm badge-info font-mono">{item.frequency}</span>
                        </td>
                        <td>{item.duration}</td>
                        <td className="text-xs text-muted">{item.instructions}</td>
                        <td>
                          <button
                            onClick={() => handleRemoveMedicine(idx)}
                            className="btn btn-ghost btn-xs text-error"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Patient Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/40">
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Patient Instructions (Visible on Prescription)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Take medicines after meals with warm water. Avoid dairy with antibiotic."
                  value={patientInstructions}
                  onChange={(e) => setPatientInstructions(e.target.value)}
                  className="textarea textarea-sm w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Internal Doctor Notes (Private)</label>
                <textarea
                  rows={2}
                  placeholder="Doctor's clinical rationale..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="textarea textarea-sm w-full"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-between items-center pt-4">
              <button onClick={handleSavePrescriptionDraft} className="btn btn-outline btn-sm">
                Save Draft
              </button>
              <div className="flex gap-2">
                <button onClick={handleApprovePrescription} className="btn btn-info btn-sm">
                  Approve Prescription
                </button>
                <button onClick={handleIssuePrescription} className="btn btn-success btn-sm font-bold shadow-lg">
                  ✓ Issue Prescription to Patient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FOLLOW-UP INTELLIGENCE */}
      {activeTab === 'followup' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2 border-b border-border/40 pb-3">
              <IconClock size={20} className="text-warning" /> Follow-Up Intelligence Plan
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Follow-Up Instruction</label>
                <textarea
                  rows={3}
                  value={followUpForm.instruction}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, instruction: e.target.value })}
                  className="textarea textarea-sm w-full"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Interval Days</label>
                  <select
                    value={followUpForm.interval_days}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, interval_days: Number(e.target.value) })}
                    className="select select-sm w-full"
                  >
                    <option value={3}>3 Days (Urgent)</option>
                    <option value={7}>7 Days (Standard)</option>
                    <option value={14}>14 Days (Bi-weekly)</option>
                    <option value={30}>30 Days (Monthly)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Recommended Investigation / Test (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Complete Blood Count (CBC) or Fasting Blood Sugar"
                    value={followUpForm.recommended_test_name}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, recommended_test_name: e.target.value })}
                    className="input input-sm w-full"
                  />
                </div>
              </div>
            </div>

            <button onClick={handleCreateFollowUp} className="btn btn-primary btn-sm font-bold shadow">
              ✓ Save Follow-Up Plan & Assign Patient Tasks
            </button>
          </div>

          {/* Patient Check-in History */}
          {workspace?.follow_up_plan?.checkins?.length > 0 && (
            <div className="glass-card p-6 space-y-3">
              <h4 className="font-bold text-sm text-white">Patient Reported Condition Check-Ins</h4>
              <div className="space-y-2">
                {workspace.follow_up_plan.checkins.map((chk, i) => (
                  <div key={i} className="p-3 rounded-lg bg-surface/50 border border-border/40 flex justify-between items-center">
                    <div>
                      <span className={`badge text-xs font-bold mr-2 ${chk.condition_status === 'WORSENING' ? 'badge-error' : chk.condition_status === 'SAME' ? 'badge-warning' : 'badge-success'}`}>
                        {chk.condition_status}
                      </span>
                      <span className="text-xs text-muted">{chk.submitted_at?.slice(0, 10)}</span>
                      {chk.notes && <p className="text-xs text-white/80 mt-1">{chk.notes}</p>}
                    </div>
                    <span className="text-xs text-muted font-mono">{chk.flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
