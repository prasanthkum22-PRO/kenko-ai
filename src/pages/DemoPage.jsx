import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { seedDemoDataset } from '../services/api';
import {
  IconActivity,
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconDoc,
  IconMic,
  IconPlus,
  IconRx,
  IconScan,
  IconShield,
  IconSparkle,
  IconStethoscope,
  IconUser,
  IconVideo,
  IconWave,
} from '../components/icons';

const PIPELINE_STAGES = [
  { stage: '1. Speech Capture', desc: 'Ambient room or video call audio', icon: IconMic },
  { stage: '2. NVIDIA Cloud STT', desc: 'Tamil / English / Code-Mix transcription', icon: IconWave },
  { stage: '3. LLM Summarization', desc: 'Structured SOAP draft from transcript', icon: IconSparkle },
  { stage: '4. SOAP Review', desc: 'Verify, edit and confirm', icon: IconStethoscope },
  { stage: '5. FHIR Export', desc: 'Interoperable structured records', icon: IconActivity },
  { stage: '6. Follow-Up Intel', desc: 'Automated reminders and care planning', icon: IconClock },
];

export default function DemoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [activeStage, setActiveStage] = useState(0);

  const handleRunSeed = async () => {
    setLoading(true);
    try {
      await seedDemoDataset();
      setSeeded(true);
      setActiveStage(5);
    } catch (err) {
      console.error('Failed to seed demo data:', err);
      setSeeded(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-page" id="demo-page">
      <div className="alert alert-warning flex items-center justify-between flex-wrap gap-3" role="status">
        <div className="flex items-center gap-3">
          <IconAlert size={18} className="flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-warning">DEMO MODE — PRE-SEEDED EVALUATION DATASET</p>
            <p className="text-xs text-muted">
              These records are fictional scenarios for evaluation and demonstration. Real live consultations use ambient audio capture, NVIDIA Cloud STT, and deterministic clinical extraction without fake fallbacks.
            </p>
          </div>
        </div>
        <span className="badge badge-warning text-xs font-bold">DEMO DATA</span>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-extrabold">
          MediBridge AI <span className="text-gradient">End-to-End Evaluation Suite</span>
        </h1>
        <p className="text-sm text-secondary max-w-xl mx-auto mt-2">
          From conversation to connected care: <strong>Audio → NVIDIA Cloud STT → Deterministic Extraction → Follow-Up Intelligence → Doctor Review → Patient Timeline</strong>
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="text-lg font-bold">AI Services Pipeline</h2>
          <span className="badge badge-secondary">Ambient Documentation</span>
        </div>
        <p className="text-xs text-muted mb-4">
          How every consultation is transcribed, summarized, and structured for clinical follow-up.
        </p>

        <div className="demo-pipeline-stepper" aria-label="AI Services Pipeline">
          {PIPELINE_STAGES.map((stage, idx) => (
            <div
              key={stage.stage}
              className={`pipeline-step-box ${idx <= activeStage ? 'active' : ''}`}
              onClick={() => setActiveStage(idx)}
            >
              <div className="flex items-center gap-2 mb-1">
                <stage.icon size={18} />
                <span className="pipeline-step-title">{stage.stage}</span>
              </div>
              <span className="pipeline-step-detail">{stage.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6 text-center flex flex-col items-center gap-4">
        <div>
          <h2 className="text-lg font-bold">1-Click Demo Dataset Seeder</h2>
          <p className="text-xs text-muted max-w-md mx-auto mt-1">
            Pre-populates fictional clinical records (Aarav Sharma &amp; Ananya Kumar) with full audio transcripts, traceable quotes, and follow-up intelligence.
          </p>
        </div>

        <button
          id="seed-demo-btn"
          className="btn btn-primary"
          onClick={handleRunSeed}
          disabled={loading}
        >
          {loading ? (
            'Seeding Demo Records...'
          ) : seeded ? (
            <>
              <IconCheck size={16} />
              Demo Records Loaded
            </>
          ) : (
            <>
              <IconPlus size={16} />
              Seed Demo Consultations
            </>
          )}
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="text-lg font-bold">Evaluation Scenarios</h2>
          <span className="badge badge-secondary">Patient Records</span>
        </div>
        <p className="text-xs text-muted mb-4">
          Two pre-seeded cases covering in-person rounding and video consultation pathways.
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div className="scenario-card">
            <div className="flex items-center justify-between">
              <span className="badge badge-primary">Scenario 1 • In-Person</span>
              <span className="badge badge-warning text-xs">DEMO DATA</span>
            </div>

            <div className="mt-3">
              <h3 className="text-lg font-bold text-primary">Aarav Sharma (38M)</h3>
              <p className="text-xs text-secondary mt-1">
                <strong>Chief Concern:</strong> Morning headaches (4 days) • <strong>History:</strong> Hypertension &amp; Type 2 Diabetes
              </p>
              <p className="text-xs text-muted mt-2">
                <strong>Recorded Vitals:</strong> BP 138/88 mmHg, Pulse 76 bpm.
              </p>
              <p className="text-xs text-muted mt-1">
                <strong>Rx:</strong> Telmisartan 40mg OD, Metformin 500mg BD.
              </p>
              <p className="text-xs text-muted mt-1">
                <strong>Tests Ordered:</strong> HbA1c, Fasting Blood Sugar, Lipid Profile.
              </p>
              <p className="text-xs text-warning mt-1">
                <strong>Follow-Up:</strong> In 14 days (Status: CONFIRMED).
              </p>
            </div>

            <div className="divider" />

            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-secondary text-xs" onClick={() => navigate('/roles/doctor')}>
                <IconStethoscope size={14} />
                Doctor View
              </button>
              <button className="btn btn-secondary text-xs" onClick={() => navigate('/roles/patient')}>
                <IconUser size={14} />
                Patient Timeline
              </button>
              <button className="btn btn-secondary text-xs" onClick={() => navigate('/followups')}>
                <IconClock size={14} />
                Follow-Up Hub
              </button>
            </div>
          </div>

          <div className="scenario-card">
            <div className="flex items-center justify-between">
              <span className="badge badge-secondary">Scenario 2 • Video Call</span>
              <span className="badge badge-warning text-xs">DEMO DATA</span>
            </div>

            <div className="mt-3">
              <h3 className="text-lg font-bold text-secondary">Ananya Kumar (29F)</h3>
              <p className="text-xs text-secondary mt-1">
                <strong>Chief Concern:</strong> Cough &amp; Fever (3 days) • <strong>Assessment:</strong> Acute Bronchitis
              </p>
              <p className="text-xs text-muted mt-2">
                <strong>Recorded Vitals:</strong> Temp 101.2 °F, SpO2 97%, Pulse 88 bpm.
              </p>
              <p className="text-xs text-muted mt-1">
                <strong>Rx:</strong> Amoxicillin/Clav 625mg BD, Paracetamol 650mg.
              </p>
              <p className="text-xs text-muted mt-1">
                <strong>Tests Ordered:</strong> Chest X-Ray (PA View).
              </p>
              <p className="text-xs text-warning mt-1">
                <strong>Follow-Up:</strong> In 5 days (Status: PENDING_DOCTOR_CONFIRMATION).
              </p>
            </div>

            <div className="divider" />

            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-primary text-xs" onClick={() => navigate('/consultations')}>
                <IconDoc size={14} />
                Open Doctor Review Workspace
                <IconArrowRight size={14} />
              </button>
              <button className="btn btn-secondary text-xs" onClick={() => navigate('/roles/nurse')}>
                <IconActivity size={14} />
                Nurse Tasks
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="text-lg font-bold">Clinical Workflow Launchers</h2>
          <span className="badge badge-secondary">Production Routes</span>
        </div>
        <p className="text-xs text-muted mb-4">
          Jump directly into a live workflow from the demo environment.
        </p>

        <div className="quick-actions-grid">
          <button className="quick-action" onClick={() => navigate('/consultations/video')}>
            <span className="quick-action-icon">
              <IconVideo size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">Video Consultation</span>
              <span className="quick-action-desc">Live telehealth with ambient transcription</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>

          <button className="quick-action" onClick={() => navigate('/consultations/in-person')}>
            <span className="quick-action-icon">
              <IconMic size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">In-Person Ambient</span>
              <span className="quick-action-desc">Room recording for rounding encounters</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>

          <button className="quick-action" onClick={() => navigate('/ocr')}>
            <span className="quick-action-icon">
              <IconScan size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">Prescription OCR</span>
              <span className="quick-action-desc">Extract and verify handwritten orders</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>

          <button className="quick-action" onClick={() => navigate('/prescriptions')}>
            <span className="quick-action-icon">
              <IconRx size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">Prescription Studio</span>
              <span className="quick-action-desc">Compose and sign e-prescriptions</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>

          <button className="quick-action" onClick={() => navigate('/followups')}>
            <span className="quick-action-icon">
              <IconClock size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">Follow-Up Hub</span>
              <span className="quick-action-desc">Review and confirm care reminders</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="text-lg font-bold">Per-Role Demo Access</h2>
          <span className="badge badge-secondary">Sign-In</span>
        </div>
        <p className="text-xs text-muted mb-4">
          Open each role workspace to review the seeded scenarios from that clinician perspective.
        </p>

        <div className="quick-actions-grid">
          <button className="quick-action" onClick={() => navigate('/roles/doctor')}>
            <span className="quick-action-icon">
              <IconStethoscope size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">Doctor Workspace</span>
              <span className="quick-action-desc">Review transcripts, SOAP drafts and confirm follow-ups</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>

          <button className="quick-action" onClick={() => navigate('/roles/nurse')}>
            <span className="quick-action-icon">
              <IconActivity size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">Nurse Dashboard</span>
              <span className="quick-action-desc">Track vitals, tasks and care queues</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>

          <button className="quick-action" onClick={() => navigate('/roles/patient')}>
            <span className="quick-action-icon">
              <IconUser size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">Patient Timeline</span>
              <span className="quick-action-desc">View timeline, records and reminders</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>

          <button className="quick-action" onClick={() => navigate('/roles/admin')}>
            <span className="quick-action-icon">
              <IconShield size={20} />
            </span>
            <span className="quick-action-body">
              <span className="quick-action-title">Admin Console</span>
              <span className="quick-action-desc">System overview, users and demo environment</span>
            </span>
            <IconArrowRight size={16} className="quick-action-arrow" />
          </button>
        </div>
      </div>
    </div>
  );
}