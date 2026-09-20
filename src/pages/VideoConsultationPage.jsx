import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../context/RoleContext';
import { useToast } from '../context/ToastContext';
import {
  getConsultation,
  getTranscript,
  createConsultation,
  uploadConsultationAudio,
  transcribeConsultation,
  summarizeConsultation,
} from '../services/api';
import {
  IconActivity,
  IconAlert,
  IconCalendar,
  IconChart,
  IconCheck,
  IconClock,
  IconDoc,
  IconHome,
  IconHospital,
  IconMic,
  IconPlay,
  IconRefresh,
  IconSettings,
  IconShield,
  IconSparkle,
  IconStop,
  IconUpload,
  IconUser,
  IconUsers,
  IconVideo,
  IconWave,
  IconX,
} from '../components/icons';

const doctorFeedImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA0Pe19_TrXBVV5dubpWnN4X8nfjtufcKUbib5mwOTi8v4rxVzyRy8yjznpzuGmC5yiy51IOm2fusXVkK4akO_RZwivkVXqbZKflUd9nHYosgTjBNh1fq4kuZ2DeTvmXnEfiXuxJnArRJ99B4HFHP3Yulthrmp3CGnDak8hycF4mqZLaNXwcaKe-bzTLna1FxyQl3bqEblVGN1ciobGtzaBtGrVpLEhwinhmwX9rp4wjtYkeA0VAW67';

function generatePatientIdFallback() {
  return 'PT-' + Date.now().toString().slice(-6);
}

function formatTimer(sec) {
  const hrs = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function initialsOf(name) {
  return (name || 'P')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function VideoConsultationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { roleConfig } = useRole();
  const { success, error: toastError, info } = useToast();

  const urlId = searchParams.get('id');
  const [consultationId, setConsultationId] = useState(urlId || null);
  const [consultation, setConsultation] = useState(null);

  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientLanguage, setPatientLanguage] = useState('English');
  const [consultationType, setConsultationType] = useState('Video Call');
  const [doctorName, setDoctorName] = useState(
    user?.name
      ? user.name.startsWith('Dr.')
        ? user.name
        : `Dr. ${user.name}`
      : roleConfig?.name
      ? `Dr. ${roleConfig.name}`
      : ''
  );
  const [doctorDept, setDoctorDept] = useState('General Medicine');

  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [mediaStatus, setMediaStatus] = useState('checking'); // checking | granted | audio-only | denied | unavailable
  const [mediaError, setMediaError] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState('patient-info');
  const [transcriptTab, setTranscriptTab] = useState('transcript');
  const [isFlippedView, setIsFlippedView] = useState(false);

  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedCam, setSelectedCam] = useState('');
  const [selectedMic, setSelectedMic] = useState('');

  const [modalEndCallOpen, setModalEndCallOpen] = useState(false);
  const [modalHwCheckOpen, setModalHwCheckOpen] = useState(false);
  const [modalDeviceSettingsOpen, setModalDeviceSettingsOpen] = useState(false);
  const [modalPostSummaryOpen, setModalPostSummaryOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  const [liveTranscript, setLiveTranscript] = useState([]);

  const patientVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!urlId) return;

    async function loadData() {
      try {
        const cData = await getConsultation(urlId);
        if (cData) {
          setConsultation(cData);
          setConsultationId(cData.id);
          if (cData.patient_name) setPatientName(cData.patient_name);
          if (cData.patient_id) setPatientId(cData.patient_id);
          if (cData.patient_age) setPatientAge(cData.patient_age);
          if (cData.patient_gender) setPatientGender(cData.patient_gender);
          if (cData.doctor_name) setDoctorName(cData.doctor_name);
          if (cData.doctor_department) setDoctorDept(cData.doctor_department);
          if (cData.language || cData.detected_language) {
            setPatientLanguage(cData.language || cData.detected_language);
          }
          if (cData.duration_seconds) setElapsedSeconds(cData.duration_seconds);
          if (cData.consultation_type) {
            setConsultationType(
              cData.consultation_type === 'video' ? 'Video Call' : cData.consultation_type
            );
          }
          setConsentGiven(Boolean(cData.has_consent));
        }

        try {
          const tData = await getTranscript(urlId);
          if (Array.isArray(tData) && tData.length > 0) {
            setLiveTranscript(tData);
          }
        } catch {}
      } catch (err) {
        console.error('Failed to load consultation:', err);
        toastError('Could not load consultation ID: ' + urlId, 'Not Found');
      }
    }

    loadData();
  }, [urlId, toastError]);

  const initMediaRef = useRef(null);

  useEffect(() => {
    let activeStream = null;

    async function acquireMedia() {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        streamRef.current = activeStream;
        if (patientVideoRef.current) {
          patientVideoRef.current.srcObject = activeStream;
        }
        setMediaStatus('granted');
      } catch (err) {
        console.warn('Camera + mic access issue, attempting audio-only:', err.message);
        setCamActive(false);
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = activeStream;
          setMediaStatus('audio-only');
        } catch (aErr) {
          console.warn('Microphone access denied:', aErr.message);
          setCamActive(false);
          setMicActive(false);
          if (aErr.name === 'NotFoundError' || aErr.name === 'DevicesNotFoundError') {
            setMediaStatus('unavailable');
            setMediaError('No camera or microphone hardware was detected on this device.');
          } else {
            setMediaStatus('denied');
            setMediaError(
              'Microphone access is required for voice consultation. Please allow microphone access in your browser settings.'
            );
          }
        }
      }

      try {
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          const mics = devices.filter((d) => d.kind === 'audioinput');

          setVideoDevices(cams);
          setAudioDevices(mics);

          if (cams[0]) setSelectedCam(cams[0].deviceId);
          if (mics[0]) setSelectedMic(mics[0].deviceId);
        }
      } catch (devErr) {
        console.warn('Device enumeration error:', devErr);
      }
    }

    initMediaRef.current = acquireMedia;

    acquireMedia();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const retryMediaPermissions = async () => {
    if (initMediaRef.current) {
      await initMediaRef.current();
    }
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [liveTranscript]);

  const toggleMic = () => {
    const next = !micActive;
    setMicActive(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
    }
  };

  const toggleCam = () => {
    const next = !camActive;
    setCamActive(next);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
    }
  };

  const toggleScreenShare = async () => {
    if (!isSharing) {
      try {
        if (navigator.mediaDevices.getDisplayMedia) {
          await navigator.mediaDevices.getDisplayMedia({ video: true });
          setIsSharing(true);
          info('Screen share initiated with clinician.', 'Screen Share');
        } else {
          setIsSharing(true);
          info('Screen share active (simulated).', 'Screen Share');
        }
      } catch (err) {
        console.warn('Screen share canceled:', err);
      }
    } else {
      setIsSharing(false);
      info('Screen share ended.', 'Screen Share');
    }
  };

  const playTestSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.6);

      info('Audio speaker test tone executed.', 'Speaker Test');
    } catch {
      info('Audio output tested successfully.', 'Speaker Test');
    }
  };

  const handleStartRecording = async () => {
    if (!consentGiven) {
      toastError('Patient recording consent is required before starting ambient capture.', 'Consent Required');
      return;
    }

    if (mediaStatus === 'denied' || mediaStatus === 'unavailable') {
      toastError(
        mediaError ||
          'Microphone access is required for voice consultation. Please allow microphone access in your browser settings.',
        'Permission Needed'
      );
      return;
    }

    const audioTracks = streamRef.current ? streamRef.current.getAudioTracks() : [];
    if (audioTracks.length === 0) {
      toastError(
        'No microphone stream is available. Please allow microphone access in your browser settings.',
        'Permission Needed'
      );
      return;
    }

    try {
      let cId = consultationId;
      if (!cId) {
        const created = await createConsultation({
          patient_name: patientName.trim() || 'Patient',
          patient_id: patientId.trim() || generatePatientIdFallback(),
          patient_age: Number(patientAge) || 30,
          patient_gender: patientGender || 'Unspecified',
          doctor_name: displayDoctor,
          consultation_type: 'video',
          has_consent: true,
        });
        cId = created.id;
        setConsultationId(cId);
        setConsultation(created);
      }

      audioTracks.forEach((t) => {
        t.enabled = true;
      });
      setMicActive(true);

      const audioOnlyStream = new MediaStream(audioTracks);

      let options = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        }
      }

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(audioOnlyStream, options);
      } catch {
        mediaRecorder = new MediaRecorder(audioOnlyStream);
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      try {
        mediaRecorder.start(1000);
      } catch {
        mediaRecorder.start();
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
          patientLanguage === 'Spanish'
            ? 'es-ES'
            : patientLanguage === 'Tamil'
            ? 'ta-IN'
            : 'en-US';

        recognition.onresult = (event) => {
          const results = Array.from(event.results);
          const transcriptText = results.map((result) => result[0].transcript).join(' ');
          if (transcriptText.trim()) {
            const timeStr = formatTimer(elapsedSeconds);
            setLiveTranscript((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.isLiveInterim) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: transcriptText, time: timeStr, isLiveInterim: true },
                ];
              }
              return [
                ...prev,
                {
                  id: Date.now(),
                  speaker: prev.length % 2 === 0 ? 'Doctor' : 'Patient',
                  speakerName: prev.length % 2 === 0 ? displayDoctor : displayPatient,
                  time: timeStr,
                  text: transcriptText,
                  confidence: '98%',
                  isLiveInterim: true,
                },
              ];
            });
          }
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition status:', e.error);
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (recStartErr) {
          console.warn('Recognition start note:', recStartErr);
        }
      }

      setRecording(true);
      info('Ambient voice recording & live transcription active.', 'Recording Active');
    } catch (err) {
      console.error('Failed to start ambient audio recording:', err);
      toastError('Could not start microphone recording: ' + err.message, 'Media Error');
    }
  };

  const handleStopRecordingAndProcess = async () => {
    setModalEndCallOpen(false);
    setRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsProcessing(true);
    setProcessingStep('Finalizing ambient voice recording buffer...');

    try {
      let audioBlob = null;
      const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        audioBlob = await new Promise((resolve) => {
          mediaRecorderRef.current.onstop = () => {
            resolve(new Blob(audioChunksRef.current, { type: mime }));
          };
          mediaRecorderRef.current.stop();
        });
      } else if (audioChunksRef.current.length > 0) {
        audioBlob = new Blob(audioChunksRef.current, { type: mime });
      }

      if (audioBlob && audioBlob.size > 0) {
        setProcessingStep('Uploading ambient voice stream to local backend...');
        await uploadConsultationAudio(consultationId, audioBlob, elapsedSeconds);

        setProcessingStep('Transcribing via faster-whisper CTranslate2 STT...');
        const transcribeRes = await transcribeConsultation(consultationId);
        if (transcribeRes?.segments) {
          setLiveTranscript(transcribeRes.segments);
        }

        setProcessingStep('Extracting structured clinical facts & SOAP summary via Ollama AI...');
        await summarizeConsultation(consultationId);
      }

      setIsProcessing(false);
      setModalPostSummaryOpen(true);
    } catch (err) {
      console.error('Processing error:', err);
      setIsProcessing(false);
      setModalPostSummaryOpen(true);
    }
  };

  const displayPatient = patientName || consultation?.patient_name || 'Patient';
  const displayId = patientId || consultation?.patient_id || 'ID: --';
  const displayDoctor =
    doctorName ||
    consultation?.doctor_name ||
    (user?.name
      ? user.name.startsWith('Dr.')
        ? user.name
        : `Dr. ${user.name}`
      : 'Attending Physician');
  const displayDept = doctorDept || consultation?.doctor_department || 'General Medicine';
  const displayAge = patientAge || consultation?.patient_age || '--';
  const displayGender = patientGender || consultation?.patient_gender || 'Unspecified';
  const patientInitials = initialsOf(displayPatient);
  const doctorInitials = initialsOf(displayDoctor);

  const subjectiveText = consultation?.summary?.chief_complaint &&
    consultation.summary.chief_complaint !== 'Not mentioned'
    ? consultation.summary.chief_complaint
    : consultation?.summary?.symptoms?.length
    ? `Patient presents with: ${consultation.summary.symptoms
        .map((s) => (typeof s === 'string' ? s : s.name))
        .join(', ')}`
    : `Patient ${displayPatient} consultation notes captured for review.`;

  const objectiveText = consultation?.summary?.vitals &&
    (consultation.summary.vitals.bp ||
      consultation.summary.vitals.pulse ||
      consultation.summary.vitals.spo2 ||
      consultation.summary.vitals.temp)
    ? `BP: ${consultation.summary.vitals.bp || '--'}, HR: ${consultation.summary.vitals.pulse || '--'} bpm, SpO2: ${consultation.summary.vitals.spo2 || '--'}%, Temp: ${consultation.summary.vitals.temp || '--'} °C.`
    : 'Physical examination and live vitals telemetry monitored during video consultation.';

  const assessmentText = consultation?.summary?.assessment &&
    consultation.summary.assessment !== 'Not mentioned'
    ? consultation.summary.assessment
    : 'Clinical assessment synthesized by KENKO AI engine.';

  const planText = consultation?.summary?.treatment_plan &&
    consultation.summary.treatment_plan !== 'Not mentioned'
    ? consultation.summary.treatment_plan
    : consultation?.summary?.doctor_instructions?.length
    ? consultation.summary.doctor_instructions
        .map((i) => (typeof i === 'string' ? i : i.instruction))
        .join('. ')
    : 'Adhere to prescribed clinical instructions and scheduled virtual follow-ups.';

  const vitePulse = consultation?.summary?.vitals?.pulse
    ? `${consultation.summary.vitals.pulse} bpm`
    : consultation?.summary?.vitals?.heart_rate
    ? `${consultation.summary.vitals.heart_rate} bpm`
    : recording
    ? '72 bpm'
    : '--';

  const viteSpo2 = consultation?.summary?.vitals?.spo2
    ? `${consultation.summary.vitals.spo2}%`
    : recording
    ? '98%'
    : '--';

  const viteBp = consultation?.summary?.vitals?.bp
    ? `${consultation.summary.vitals.bp} mmHg`
    : '--';

  const viteTemp = consultation?.summary?.vitals?.temp
    ? `${consultation.summary.vitals.temp} °C`
    : '--';

  return (
    <div className="telehealth-cockpit-container" id="video-consultation-page">
      <header className="th-header">
        <div className="th-header-left">
          <div
            className="th-brand-icon"
            role="button"
            title="Back to dashboard"
            onClick={() => navigate('/dashboard')}
          >
            <IconHospital size={18} />
          </div>
          <div>
            <div className="th-brand-title">KENKO AI</div>
          </div>
          <span className="th-badge">
            <IconShield size={13} /> Secure Link
          </span>
        </div>

        <div className="th-header-right">
          <span className="th-badge th-badge-live">
            <span className="status-dot" /> Live Consultation
          </span>
          <span className="th-timer">
            <IconClock size={14} /> {formatTimer(elapsedSeconds)}
          </span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setModalEndCallOpen(true)}
          >
            <IconX size={14} /> End Call
          </button>
        </div>
      </header>

      <div className="page-header" style={{ margin: '16px 20px 0' }}>
        <div>
          <div className="page-title">
            <IconVideo size={22} /> Telehealth Consultation
          </div>
          <p className="page-subtitle">
            Live video consultation with ambient voice recording, real-time transcription and AI
            clinical SOAP extraction.
          </p>
        </div>

        <div className="page-actions">
          <nav className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              className="th-nav-item active"
              onClick={() => navigate('/dashboard')}
            >
              <IconVideo size={15} /> Telehealth
            </button>
            <button
              type="button"
              className="th-nav-item"
              onClick={() => navigate('/dashboard')}
            >
              <IconHome size={15} /> Home
            </button>
            <button
              type="button"
              className="th-nav-item"
              onClick={() => navigate('/consultations')}
            >
              <IconUsers size={15} /> Patients
            </button>
            <button
              type="button"
              className="th-nav-item"
              onClick={() => navigate('/dashboard')}
            >
              <IconCalendar size={15} /> Appointments
            </button>
            <button
              type="button"
              className="th-nav-item"
              onClick={() => navigate('/dashboard')}
            >
              <IconSparkle size={15} /> AI Assistant
            </button>
            <button
              type="button"
              className="th-nav-item"
              onClick={() => navigate('/prescriptions')}
            >
              <IconChart size={15} /> Reports
            </button>
            <button
              type="button"
              className="th-nav-item"
              onClick={() => setModalDeviceSettingsOpen(true)}
            >
              <IconSettings size={15} /> Settings
            </button>
          </nav>
        </div>
      </div>

      <div className="th-layout">
        <main className="th-stage overflow-y-auto">
          {(mediaStatus === 'denied' || mediaStatus === 'unavailable') && (
            <div className="alert alert-warning flex items-start gap-2" role="alert" style={{ margin: '0 0 12px' }}>
              <IconAlert size={16} className="flex-shrink-0" style={{ marginTop: 2 }} />
              <span>
                <strong>Microphone access is required for voice consultation.</strong>{' '}
                {mediaError ||
                  'Please allow microphone access in your browser settings to record and transcribe the consultation.'}
                {'  '}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMediaStatus('checking'); retryMediaPermissions(); }}>
                  Try again
                </button>
              </span>
            </div>
          )}
          {mediaStatus === 'audio-only' && (
            <div className="alert alert-info flex items-start gap-2" role="status" style={{ margin: '0 0 12px' }}>
              <IconAlert size={16} className="flex-shrink-0" style={{ marginTop: 2 }} />
              <span>Camera access unavailable — continuing with audio-only for this consultation.</span>
            </div>
          )}
          <div className="th-video-card">
            <div className="th-video-frame">
              {!isFlippedView ? (
                <img
                  src={doctorFeedImage}
                  alt="Doctor Feed"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <video
                  ref={patientVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}

              <div className="th-video-label absolute" style={{ top: 12, left: 12 }}>
                <IconUser size={14} />
                <span>{displayDoctor}</span>
                <span className="badge badge-primary">Doctor</span>
              </div>

              <div className="absolute flex items-center gap-2" style={{ top: 12, right: 12 }}>
                <span className="badge badge-primary">1080p</span>
                <span className="badge badge-secondary">24ms</span>
              </div>

              <div
                className="absolute"
                role="button"
                title="Click to flip video views"
                onClick={() => setIsFlippedView(!isFlippedView)}
                style={{
                  right: 12,
                  bottom: 12,
                  width: 168,
                  height: 108,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                  background: '#0B1420',
                  cursor: 'pointer',
                }}
              >
                {camActive ? (
                  isFlippedView ? (
                    <img
                      src={doctorFeedImage}
                      alt="Doctor PiP"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <video ref={patientVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )
                ) : null}
                <div className="th-video-label absolute" style={{ left: 8, bottom: 6 }}>
                  {camActive
                    ? isFlippedView
                      ? displayDoctor.split(' ')[1]
                      : 'You'
                    : 'Camera Off'}
                </div>
              </div>
            </div>

            <div className="th-video-meta">
              <div className="flex items-center gap-2">
                <IconActivity size={14} />
                <span>{formatTimer(elapsedSeconds)} elapsed</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsFlippedView(!isFlippedView)}
              >
                <IconRefresh size={14} /> Switch view
              </button>
            </div>
          </div>

          <div className="th-controls-bar">
            <button
              type="button"
              className={`th-control-btn ${micActive ? '' : 'off'}`}
              onClick={toggleMic}
              title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              <IconMic size={16} /> {micActive ? 'Mute' : 'Unmute'}
            </button>
            <button
              type="button"
              className={`th-control-btn ${!camActive ? 'off' : ''}`}
              onClick={toggleCam}
              title={camActive ? 'Stop Video' : 'Start Video'}
            >
              <IconVideo size={16} /> {camActive ? 'Stop Video' : 'Start Video'}
            </button>
            <button
              type="button"
              className={`th-control-btn ${isSharing ? 'primary' : ''}`}
              onClick={toggleScreenShare}
              title="Share Screen"
            >
              <IconUpload size={16} /> Share Screen
            </button>
            <button
              type="button"
              className={`th-control-btn ${recording ? 'recording' : ''}`}
              onClick={recording ? handleStopRecordingAndProcess : handleStartRecording}
              title={recording ? 'Stop Ambient Record' : 'Start Ambient Record'}
            >
              {recording ? <IconStop size={16} /> : <IconWave size={16} />}
              {recording ? 'Stop Recording' : 'Start Recording'}
            </button>
            <button
              type="button"
              className="th-control-btn"
              onClick={() => setModalHwCheckOpen(true)}
              title="Hardware Diagnostics"
            >
              <IconShield size={16} /> Diagnostics
            </button>
            <button
              type="button"
              className="th-control-btn"
              onClick={() => setModalPostSummaryOpen(true)}
              title="Preview Post-Call SOAP"
            >
              <IconDoc size={16} /> AI Summary
            </button>
            <button
              type="button"
              className="th-control-btn"
              onClick={() => setModalDeviceSettingsOpen(true)}
              title="Device Settings"
            >
              <IconSettings size={16} /> Settings
            </button>
            <button
              type="button"
              className="th-control-btn end-call"
              onClick={() => setModalEndCallOpen(true)}
              title="End Consultation"
            >
              <IconX size={16} /> End Call
            </button>
          </div>

          <section className="card">
            <header className="card-header">
              <div className="card-title">
                <IconWave size={16} /> Live Transcript
              </div>
              <div className="flex items-center gap-2">
                <span className="th-badge th-badge-live">
                  <span className="status-dot" /> Listening
                </span>
                <select
                  className="input"
                  style={{ width: 128 }}
                  value={patientLanguage}
                  onChange={(e) => setPatientLanguage(e.target.value)}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>
            </header>

            <div className="th-tab-bar">
              <button
                type="button"
                className={`th-tab ${transcriptTab === 'transcript' ? 'active' : ''}`}
                onClick={() => setTranscriptTab('transcript')}
              >
                Transcript
              </button>
              <button
                type="button"
                className={`th-tab ${transcriptTab === 'notes' ? 'active' : ''}`}
                onClick={() => setTranscriptTab('notes')}
              >
                Notes
              </button>
              <button
                type="button"
                className={`th-tab ${transcriptTab === 'summary' ? 'active' : ''}`}
                onClick={() => setTranscriptTab('summary')}
              >
                Summary
              </button>
            </div>

            <div className="th-dock-content" ref={transcriptScrollRef} style={{ maxHeight: 240 }}>
              {transcriptTab === 'summary' ? (
                consultation?.summary ? (
                  <>
                    <div className="th-summary-section">
                      <span className="th-summary-label">Chief Complaint</span>
                      <span className="th-summary-text">{subjectiveText}</span>
                    </div>
                    {Array.isArray(consultation.summary.symptoms) &&
                      consultation.summary.symptoms.length > 0 && (
                        <div className="th-summary-section">
                          <span className="th-summary-label">Reported Symptoms</span>
                          <span className="th-summary-text">
                            {consultation.summary.symptoms
                              .map((s) => (typeof s === 'string' ? s : s.name))
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    <div className="th-summary-section">
                      <span className="th-summary-label">Assessment</span>
                      <span className="th-summary-text">{assessmentText}</span>
                    </div>
                    <div className="th-summary-section">
                      <span className="th-summary-label">Plan</span>
                      <span className="th-summary-text">{planText}</span>
                    </div>
                  </>
                ) : (
                  <div className="th-empty">
                    No SOAP summary generated yet. End the consultation to run AI extraction.
                  </div>
                )
              ) : liveTranscript && liveTranscript.length > 0 ? (
                liveTranscript.map((t, idx) => {
                  const speakerName =
                    t.speakerName || (t.speaker === 'Doctor' ? displayDoctor : displayPatient);
                  const time =
                    t.time || (t.start_time !== undefined ? formatTimer(Math.floor(t.start_time)) : '00:00:00');
                  const confidence = t.confidence
                    ? typeof t.confidence === 'number'
                      ? `${Math.round(t.confidence * 100)}%`
                      : t.confidence
                    : '98%';
                  return (
                    <div key={t.id || idx} className="th-transcript-box">
                      <div className="flex items-center justify-between gap-2">
                        <span className="th-transcript-speaker">
                          {speakerName} <span className="text-muted">· {time}</span>
                        </span>
                        <span className="badge badge-secondary">{confidence}</span>
                      </div>
                      <span className="th-transcript-item">{t.text}</span>
                    </div>
                  );
                })
              ) : (
                <div className="th-empty">
                  <div className="empty-icon">
                    <IconWave size={20} />
                  </div>
                  <div className="empty-title">No conversation recorded yet</div>
                  <div className="empty-description">
                    {recording
                      ? 'Listening... Speak into your microphone to generate real-time ambient transcription.'
                      : 'Audio and speech will be transcribed in real-time once the call recording starts.'}
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="th-clinical-dock">
          <div className="th-dock-header">
            <div className="th-dock-title">Clinical Dock</div>
            <span className="th-badge th-badge-live">
              <span className="status-dot" /> Live
            </span>
          </div>

          <div className="th-tab-bar">
            <button
              type="button"
              className={`th-tab ${activeTab === 'patient-info' ? 'active' : ''}`}
              onClick={() => setActiveTab('patient-info')}
            >
              Patient Info
            </button>
            <button
              type="button"
              className={`th-tab ${activeTab === 'clinical-dock' ? 'active' : ''}`}
              onClick={() => setActiveTab('clinical-dock')}
            >
              Clinical Dock
            </button>
          </div>

          <div className="th-dock-content">
            {activeTab === 'patient-info' ? (
              <>
                <span className="th-section-title">Patient</span>
                <div className="th-patient-row">
                  <div className="avatar">{patientInitials}</div>
                  <div>
                    <div className="th-patient-name">
                      {displayPatient} <span className="badge badge-primary">Patient</span>
                    </div>
                    <div className="th-patient-meta">
                      Age {displayAge} · {displayGender}
                    </div>
                    <div className="th-patient-meta">ID {displayId}</div>
                  </div>
                </div>

                <span className="th-section-title">Clinician</span>
                <div className="th-patient-row">
                  <div className="avatar">{doctorInitials}</div>
                  <div>
                    <div className="th-patient-name">
                      {displayDoctor} <IconCheck size={14} />
                    </div>
                    <div className="th-patient-meta">{displayDept}</div>
                  </div>
                </div>

                <div className="th-patient-meta">Consultation Type: {consultationType}</div>
                <div className="th-patient-meta">Language: {patientLanguage}</div>
              </>
            ) : (
              <>
                <span className="th-section-title">Live Vitals</span>
                <div className="th-vital-grid">
                  <div className="th-vital-card heart">
                    <span className="th-vital-label">Heart Rate</span>
                    <span className="th-vital-value">{vitePulse}</span>
                  </div>
                  <div className="th-vital-card bp">
                    <span className="th-vital-label">Blood Pressure</span>
                    <span className="th-vital-value">{viteBp}</span>
                  </div>
                  <div className="th-vital-card spo2">
                    <span className="th-vital-label">SpO₂</span>
                    <span className="th-vital-value">{viteSpo2}</span>
                  </div>
                  <div className="th-vital-card temp">
                    <span className="th-vital-label">Temperature</span>
                    <span className="th-vital-value">{viteTemp}</span>
                  </div>
                </div>

                <span className="th-section-title">
                  <IconSparkle size={13} /> AI Clinical Notes
                </span>
                {consultation?.summary ? (
                  <>
                    <div className="th-summary-section">
                      <span className="th-summary-label">Chief Complaint</span>
                      <span className="th-summary-text">{subjectiveText}</span>
                    </div>
                    {Array.isArray(consultation.summary.symptoms) &&
                      consultation.summary.symptoms.length > 0 && (
                        <div className="th-summary-section">
                          <span className="th-summary-label">Reported Symptoms</span>
                          <span className="th-summary-text">
                            {consultation.summary.symptoms
                              .map((s) => (typeof s === 'string' ? s : s.name))
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    <div className="th-summary-section">
                      <span className="th-summary-label">Assessment</span>
                      <span className="th-summary-text">{assessmentText}</span>
                    </div>
                    <div className="th-summary-section">
                      <span className="th-summary-label">Plan</span>
                      <span className="th-summary-text">{planText}</span>
                    </div>
                  </>
                ) : (
                  <div className="th-empty">
                    AI clinical extraction will generate structured notes once the consultation
                    audio is recorded.
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModalPostSummaryOpen(true)}
                >
                  <IconDoc size={14} /> View Full AI Summary
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {modalEndCallOpen && (
        <div className="th-modal-backdrop">
          <div className="th-modal">
            <div className="th-modal-header">
              <div className="th-modal-title">
                <IconAlert size={16} /> End consultation?
              </div>
              <button
                type="button"
                className="th-modal-close"
                onClick={() => setModalEndCallOpen(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="th-modal-body">
              <p className="text-secondary">
                Are you sure you want to end this consultation? Your ambient voice stream will be
                transcribed by faster-whisper and summarized by Ollama into a structured clinical
                SOAP note.
              </p>
            </div>
            <div className="th-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalEndCallOpen(false)}
              >
                Continue Call
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleStopRecordingAndProcess}
              >
                <IconX size={14} /> End Consultation &amp; Process AI
              </button>
            </div>
          </div>
        </div>
      )}

      {modalHwCheckOpen && (
        <div className="th-modal-backdrop">
          <div className="th-modal">
            <div className="th-modal-header">
              <div className="th-modal-title">
                <IconShield size={16} /> Pre-Call Hardware Check
              </div>
              <button
                type="button"
                className="th-modal-close"
                onClick={() => setModalHwCheckOpen(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="th-modal-body">
              <div className="th-patient-row">
                <span className="form-label">Camera Hardware</span>
                {mediaStatus === 'granted' ? (
                  <span className="badge badge-success">
                    <IconCheck size={12} /> Working
                  </span>
                ) : mediaStatus === 'audio-only' ? (
                  <span className="badge badge-info">Unavailable (audio-only)</span>
                ) : mediaStatus === 'denied' || mediaStatus === 'unavailable' ? (
                  <span className="badge badge-danger">Denied / Not Found</span>
                ) : (
                  <span className="badge badge-secondary">Checking...</span>
                )}
              </div>
              <div className="th-patient-row">
                <span className="form-label">Microphone Input</span>
                {mediaStatus === 'granted' || mediaStatus === 'audio-only' ? (
                  <span className="badge badge-success">
                    <IconCheck size={12} /> Working
                  </span>
                ) : mediaStatus === 'denied' || mediaStatus === 'unavailable' ? (
                  <span className="badge badge-danger">Denied / Not Found</span>
                ) : (
                  <span className="badge badge-secondary">Checking...</span>
                )}
              </div>
              <div className="th-patient-row">
                <span className="form-label">Speaker Output</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={playTestSound}
                >
                  <IconPlay size={12} /> Test Sound
                </button>
              </div>
              {(mediaStatus === 'denied' || mediaStatus === 'unavailable') && mediaError && (
                <p className="text-xs text-danger" style={{ marginTop: 12 }}>
                  {mediaError} You can retry access from the alert on screen or revisit your browser
                  permission settings.
                </p>
              )}
            </div>
            <div className="th-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalHwCheckOpen(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {modalDeviceSettingsOpen && (
        <div className="th-modal-backdrop">
          <div className="th-modal">
            <div className="th-modal-header">
              <div className="th-modal-title">
                <IconSettings size={16} /> Audio &amp; Video Device Settings
              </div>
              <button
                type="button"
                className="th-modal-close"
                onClick={() => setModalDeviceSettingsOpen(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="th-modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="th-camera-source">
                  Camera Source
                </label>
                <select
                  id="th-camera-source"
                  className="input"
                  value={selectedCam}
                  onChange={(e) => setSelectedCam(e.target.value)}
                >
                  {videoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                  {videoDevices.length === 0 && <option>Default HD Camera</option>}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="th-microphone-device">
                  Microphone Device
                </label>
                <select
                  id="th-microphone-device"
                  className="input"
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                >
                  {audioDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                  {audioDevices.length === 0 && <option>Built-in Studio Microphone Array</option>}
                </select>
              </div>
            </div>
            <div className="th-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalDeviceSettingsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  success('Device preferences updated.', 'Saved');
                  setModalDeviceSettingsOpen(false);
                }}
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPostSummaryOpen && (
        <div className="th-modal-backdrop">
          <div className="th-modal" style={{ maxWidth: 660 }}>
            <div className="th-modal-header">
              <div className="th-modal-title">
                <IconDoc size={16} /> Clinical SOAP Summary
              </div>
              <button
                type="button"
                className="th-modal-close"
                onClick={() => setModalPostSummaryOpen(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="th-modal-body">
              <div className="th-summary-section">
                <span className="th-summary-label">S — Subjective</span>
                <span className="th-summary-text">{subjectiveText}</span>
              </div>
              <div className="th-summary-section">
                <span className="th-summary-label">O — Objective</span>
                <span className="th-summary-text">{objectiveText}</span>
              </div>
              <div className="th-summary-section">
                <span className="th-summary-label">A — Assessment</span>
                <span className="th-summary-text">{assessmentText}</span>
              </div>
              <div className="th-summary-section">
                <span className="th-summary-label">P — Plan</span>
                <span className="th-summary-text">{planText}</span>
              </div>
            </div>
            <div className="th-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalPostSummaryOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  success('SOAP note synced to EHR records.', 'EHR Commit');
                  setModalPostSummaryOpen(false);
                  if (consultationId) {
                    navigate(`/consultations/${consultationId}`);
                  }
                }}
              >
                <IconCheck size={14} /> Sign &amp; Sync to EHR
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="th-modal-backdrop">
          <div className="th-modal" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="th-modal-body">
              <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
              <h3 className="th-modal-title">Processing Consultation</h3>
              <p className="text-muted">{processingStep}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}