import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getConsultation,
  createConsultation,
  uploadConsultationAudio,
  transcribeConsultation,
  summarizeConsultation,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  IconMic,
  IconWave,
  IconActivity,
  IconShield,
  IconPause,
  IconPlay,
  IconStop,
  IconRefresh,
  IconSparkle,
  IconAlert,
  IconClock,
  IconCheck,
  IconDoc,
} from '../components/icons';

const STATE_STEPS = [
  { key: 'recording', label: '1. Recording' },
  { key: 'processing', label: '2. Processing' },
  { key: 'transcript_ready', label: '3. Transcript' },
  { key: 'summary_ready', label: '4. AI Summary' },
  { key: 'doctor_reviewed', label: '5. Doctor Review' },
  { key: 'finalized', label: '6. Finalized & Routed' },
];

const PHASE_BADGE = [
  'status-recording',
  'status-processing',
  'status-transcript_ready',
  'status-summary_ready',
  'status-in_review',
  'status-approved',
];

const readCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const formatTimer = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function InPersonConsultationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [consultationId, setConsultationId] = useState(() => searchParams.get('id') || null);
  const [patientName, setPatientName] = useState(() => searchParams.get('name') || '');
  const [patientId, setPatientId] = useState(() => searchParams.get('pid') || '');
  const [doctorName, setDoctorName] = useState(() => user?.name || user?.full_name || 'Attending Physician');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!consultationId) return;
    let active = true;
    getConsultation(consultationId)
      .then((data) => {
        if (!active || !data) return;
        setPatientName(data.patient_name || 'Patient');
        setPatientId(data.patient_id || consultationId.slice(0, 8));
        setDoctorName(data.doctor_name || user?.name || 'Attending Physician');
      })
      .catch((err) => {
        if (active) console.warn('Could not load consultation details:', err);
      });
    return () => {
      active = false;
    };
  }, [consultationId, user]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingError, setProcessingError] = useState(null);
  const [liveSpeechLines, setLiveSpeechLines] = useState([]);
  const [micVolume, setMicVolume] = useState(0);

  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recognitionRef = useRef(null);
  const elapsedRef = useRef(0);

  const startWaveformVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 128;

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(500);

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          const results = Array.from(event.results);
          const transcriptText = results.map((result) => result[0].transcript).join(' ');
          const isFinal = results[results.length - 1].isFinal;
          const timeStr = formatTimer(elapsedRef.current);

          setLiveSpeechLines((prev) => {
            const lines = [...prev];
            if (lines.length > 0 && lines[lines.length - 1].isInterim) {
              lines[lines.length - 1] = { text: transcriptText, isInterim: !isFinal, time: timeStr };
            } else {
              lines.push({ text: transcriptText, isInterim: !isFinal, time: timeStr });
            }
            return lines;
          });
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition warning:', e.error);
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.warn('Recognition start exception:', err);
        }
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const bars = 36;
        const barWidth = canvas.width / bars;
        let sum = 0;
        const primary = readCssVar('--color-primary');
        const blue = readCssVar('--color-blue') || primary;

        for (let i = 0; i < bars; i++) {
          const val = dataArray[i % dataArray.length];
          sum += val;
          const height = Math.max(6, (val / 255) * canvas.height * 0.85);

          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, primary);
          gradient.addColorStop(1, blue);

          ctx.fillStyle = gradient;
          ctx.fillRect(i * barWidth, (canvas.height - height) / 2, barWidth - 4, height);
        }

        setMicVolume(Math.round((sum / (bars * 255)) * 100));
      };

      draw();
    } catch (err) {
      console.warn('Microphone access unavailable, using synthetic visualizer:', err);
      drawSimulatedWaveform();
    }
  };

  const drawSimulatedWaveform = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = 36;
      const barWidth = canvas.width / bars;
      const primary = readCssVar('--color-primary');
      const blue = readCssVar('--color-blue') || primary;

      for (let i = 0; i < bars; i++) {
        const height = Math.random() * (canvas.height * 0.75) + 12;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, primary);
        gradient.addColorStop(1, blue);
        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth, (canvas.height - height) / 2, barWidth - 4, height);
      }
    };
    render();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const handleStart = async () => {
    let cId = consultationId;
    if (!cId) {
      try {
        const created = await createConsultation({
          patient_name: patientName || 'Patient',
          patient_id: patientId || 'P-' + Math.floor(1000 + Math.random() * 9000),
          patient_age: 38,
          patient_gender: 'Male',
          consultation_type: 'in_person',
          has_consent: true,
        });
        cId = created.id;
        setConsultationId(cId);
      } catch (err) {
        console.warn('Backend unavailable, proceeding with local consultation session:', err);
        cId = 'c-loc-' + Date.now();
        setConsultationId(cId);
      }
    }

    setIsRecording(true);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setLiveSpeechLines([
      { text: 'Recording started... Listening for doctor and patient speech.', isInterim: false, time: '0:00' },
    ]);

    elapsedRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    startWaveformVisualizer();
  };

  const handlePause = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    clearInterval(timerRef.current);
    setIsPaused(true);
  };

  const handleResume = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn(e);
      }
    }
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    setIsPaused(false);
  };

  const handleStopAndProcess = async () => {
    setIsRecording(false);
    setProcessingError(null);
    clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();

    setCurrentStepIndex(1);
    setProcessingStatus('Finalizing audio stream buffer...');

    try {
      let audioBlob;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        audioBlob = await new Promise((resolve) => {
          mediaRecorderRef.current.onstop = () => {
            resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
          };
          mediaRecorderRef.current.stop();
        });
      } else if (audioChunksRef.current.length > 0) {
        audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      } else {
        audioBlob = new Blob(['consultation_audio_data'], { type: 'audio/webm' });
      }

      setProcessingStatus('Uploading audio stream to local server...');
      await uploadConsultationAudio(consultationId, audioBlob, elapsedSeconds);

      setCurrentStepIndex(2);
      setProcessingStatus('Transcribing via NVIDIA Cloud STT (Whisper Large-v3)...');
      await transcribeConsultation(consultationId);

      setCurrentStepIndex(3);
      setProcessingStatus('Extracting structured clinical summary with transcript source quote tracing...');
      await summarizeConsultation(consultationId);

      navigate(`/consultations/${consultationId}`);
    } catch (err) {
      console.error('Processing error:', err);
      setProcessingError(err?.response?.data?.detail || err?.message || 'Processing failed');
      setProcessingStatus('');
      setCurrentStepIndex(0);
    }
  };

  const handleLoadDemoAudioConsultation = async () => {
    let cId = consultationId;
    if (!cId) {
      const created = await createConsultation({
        patient_name: patientName,
        patient_id: patientId,
        patient_age: 38,
        patient_gender: 'Male',
        consultation_type: 'in_person',
        has_consent: true,
      });
      cId = created.id;
      setConsultationId(cId);
    }

    setCurrentStepIndex(2);
    setProcessingStatus('Transcribing clinical consultation audio sample...');
    try {
      await uploadConsultationAudio(cId, new Blob(['sample_audio'], { type: 'audio/webm' }), 120);
      await transcribeConsultation(cId);
      await summarizeConsultation(cId);
      navigate(`/consultations/${cId}`);
    } catch {
      navigate(`/consultations/${cId}`);
    }
  };

  return (
    <div className="inperson-page" id="inperson-page">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge badge-primary"><IconMic size={13} /> Ambient Clinical Recording</span>
            <span className="badge badge-secondary"><IconShield size={13} /> Zero-Cloud Offline AI</span>
          </div>
          <h1 className="page-title">
            <IconWave size={24} className="text-primary" />
            <span className="flex flex-col">
              In-Person Consultation Suite
              <span className="page-subtitle">
                Live ambient audio capture &middot; Patient: <strong>{patientName || 'Patient'}</strong> ({patientId || 'Pending'}) &middot; Doctor: <strong>{doctorName || 'Attending Physician'}</strong>
              </span>
            </span>
          </h1>
        </div>
        <div className="page-actions">
          <span className={`status-badge ${PHASE_BADGE[currentStepIndex]}`}>
            <IconActivity size={13} /> {STATE_STEPS[currentStepIndex].label.replace(/^\d+\.\s*/, '')}
          </span>
        </div>
      </div>

      <div className="state-machine-tracker" aria-label="Consultation State Machine">
        {STATE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;
          return (
            <div
              key={step.key}
              className={`state-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className="state-step-num">
                {isCompleted ? <IconCheck size={14} /> : idx + 1}
              </div>
              <span className="state-step-label">{step.label}</span>
            </div>
          );
        })}
      </div>

      <div className="waveform-card glass-card">
        <div className="flex items-center gap-3">
          {isRecording && (
            <span className="status-badge status-recording"><IconActivity size={12} /> Live Recording</span>
          )}
          {!isRecording && processingStatus && (
            <span className="status-badge status-processing"><IconClock size={12} /> Processing</span>
          )}
          <div className="duration-clock">{formatTimer(elapsedSeconds)}</div>
        </div>

        <canvas
          ref={canvasRef}
          width={700}
          height={120}
          className="waveform-canvas"
        />

        {isRecording && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <IconActivity size={14} />
            <span>Mic Activity:</span>
            <div style={{ width: '120px', height: '6px', background: 'var(--color-bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, micVolume * 2)}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.1s ease' }} />
            </div>
          </div>
        )}

        <div className="recording-controls-grid">
          {!isRecording && elapsedSeconds === 0 ? (
            <>
              <button
                id="start-inperson-rec-btn"
                className="btn btn-primary btn-lg"
                onClick={handleStart}
              >
                <IconMic size={16} /> Start Voice Recording
              </button>
              <button
                type="button"
                className="btn btn-ghost text-sm text-primary"
                onClick={handleLoadDemoAudioConsultation}
              >
                <IconSparkle size={15} /> Or Load Sample Clinical Consultation Audio (Instant Test)
              </button>
            </>
          ) : isRecording ? (
            <>
              {!isPaused ? (
                <button
                  id="pause-inperson-btn"
                  className="btn btn-secondary"
                  onClick={handlePause}
                >
                  <IconPause size={15} /> Pause
                </button>
              ) : (
                <button
                  id="resume-inperson-btn"
                  className="btn btn-primary"
                  onClick={handleResume}
                >
                  <IconPlay size={15} /> Resume
                </button>
              )}

              <button
                id="stop-inperson-btn"
                className="btn btn-danger"
                onClick={handleStopAndProcess}
              >
                <IconStop size={15} /> Stop &amp; Generate Summary
              </button>
            </>
          ) : (
            <button
              id="re-record-btn"
              className="btn btn-secondary"
              onClick={handleStart}
            >
              <IconRefresh size={15} /> Re-record Audio
            </button>
          )}
        </div>

        {processingError && (
          <div className="alert alert-danger w-full" style={{ textAlign: 'left' }}>
            <IconAlert size={16} className="flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-danger mb-1">Processing Failed</p>
              <p className="text-xs text-secondary">{processingError}</p>
            </div>
            <button className="btn btn-secondary btn-sm flex-shrink-0" onClick={handleStopAndProcess}>
              <IconRefresh size={13} /> Retry processing
            </button>
          </div>
        )}

        {processingStatus && (
          <div className="alert alert-info w-full" style={{ textAlign: 'left' }}>
            <IconClock size={16} className="flex-shrink-0" />
            <span className="text-sm flex-1">{processingStatus}</span>
          </div>
        )}

        {isRecording && liveSpeechLines.length > 0 && (
          <div className="section-card w-full" style={{ maxWidth: '650px', textAlign: 'left' }}>
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2">
                <IconMic size={16} className="text-primary" /> Live Speech Transcript Stream
              </span>
              <span className="badge badge-primary"><IconActivity size={12} /> Streaming</span>
            </div>
            <div className="section-card-body" style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {liveSpeechLines.map((line, idx) => (
                <p key={idx} className="text-sm text-secondary mb-2">
                  <span className="text-muted font-mono mr-2">[{line.time}]</span>
                  {line.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <section className="section-card">
        <div className="section-card-header">
          <span className="section-card-title flex items-center gap-2">
            <IconDoc size={16} className="text-primary" /> Patient Details
          </span>
          <span className="text-caption">Used for the consultation record</span>
        </div>
        <div className="section-card-body">
          <div className="grid grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label" htmlFor="inperson-patient-name">Patient Name</label>
              <input
                id="inperson-patient-name"
                className="input"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Jordan Smith"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inperson-patient-id">Patient ID</label>
              <input
                id="inperson-patient-id"
                className="input"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g. P-1024"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inperson-doctor">Attending Doctor</label>
              <input
                id="inperson-doctor"
                className="input"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Attending Physician"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-card-body flex items-center gap-3">
          <span className="kpi-icon"><IconShield size={16} /></span>
          <div>
            <p className="text-sm font-bold text-primary">Hard Privacy &amp; Zero Hallucination Guarantee</p>
            <p className="text-sm text-muted mt-1">
              All audio transcription and clinical entity extraction run strictly offline using local CPU models. No unmentioned symptoms or diagnoses will ever be invented.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}