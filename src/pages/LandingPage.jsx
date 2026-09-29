import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  // Simulated live telemetry state
  const [bpm, setBpm] = useState(72);
  const [spo2, setSpo2] = useState(98);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setBpm(prev => 70 + Math.floor(Math.random() * 6));
      setSpo2(prev => 97 + Math.floor(Math.random() * 3));
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const soapSteps = [
    { tag: 'S', label: 'Subjective', text: 'Patient reports mild acute rhinitis and fatigue for 3 days.' },
    { tag: 'O', label: 'Objective', text: 'Temp: 98.6°F, HR: 74 bpm, clear lung sounds bilaterally.' },
    { tag: 'A', label: 'Assessment', text: 'Acute viral upper respiratory tract infection.' },
    { tag: 'P', label: 'Plan', text: 'Hydration, rest, OTC antipyretic. Follow-up if symptoms worsen.' }
  ];

  return (
    <div className="kenko-landing">
      {/* ─── NAVIGATION BAR ─── */}
      <header className="kenko-nav">
        <Link to="/" className="kenko-logo">
          <div className="kenko-logo-icon">K</div>
          <span>kenkoai <span style={{ color: '#38bdf8', fontWeight: 500, fontSize: '0.85em' }}>Clinical Platform</span></span>
        </Link>

        <nav className="kenko-nav-links">
          <a href="#about" className="kenko-nav-link">About kenkoai</a>
          <a href="#cockpit" className="kenko-nav-link">Live Cockpit</a>
          <a href="#telehealth" className="kenko-nav-link">Google Meet Telehealth</a>
          <a href="#features" className="kenko-nav-link">Ambient AI</a>
          <Link to="/privacy" className="kenko-nav-link" style={{ color: '#94a3b8' }}>Privacy Policy</Link>
          <Link to="/terms" className="kenko-nav-link" style={{ color: '#94a3b8' }}>Terms</Link>
          <Link to="/demo" className="kenko-nav-link" style={{ color: '#2dd4bf' }}>Interactive Demo</Link>
        </nav>

        <div className="kenko-nav-actions">
          <Link to="/login" className="btn-ghost-sm">Sign In</Link>
          <Link to="/demo" className="btn-primary-pill">
            <span>Launch Cockpit</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>

      {/* ─── HERO SECTION (Asymmetric Split Architecture) ─── */}
      <section className="kenko-hero" id="cockpit">
        <div className="hero-left">
          <div className="hero-badge">
            <span className="pulse-dot"></span>
            <span>LIVE TELEHEALTH COCKPIT</span>
          </div>

          <h1 className="hero-title">
            NEXT-GEN <br />
            <span className="hero-title-highlight">CLINICAL</span> <br />
            INTELLIGENCE
          </h1>

          <p className="hero-subtitle">
            Zero-friction telehealth consultations powered by ambient AI medical transcription, real-time biometric telemetry, and automated clinical SOAP notes.
          </p>

          <div className="hero-cta-group">
            <Link to="/demo" className="hero-cta-main">
              <span>Start Live Consultation</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link to="/login" className="hero-cta-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
              </svg>
              <span>Doctor Portal</span>
            </Link>
          </div>
        </div>

        {/* Hero Right: Interactive Cockpit Preview */}
        <div className="hero-right">
          <div className="cockpit-preview-card">
            <div className="cockpit-header">
              <div className="cockpit-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                <span>Live Telemedicine Consultation</span>
              </div>
              <div className="cockpit-badge-live">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }}></span>
                REC 04:12
              </div>
            </div>

            {/* Video Feeds */}
            <div className="video-feeds-grid">
              <div className="video-box">
                <div style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>👨‍⚕️</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>Dr. Sarah Jenkins, MD</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Cardiology Specialist</div>
                </div>
                <div className="video-tag">Doctor (Host)</div>
              </div>

              <div className="video-box">
                <div style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>👩</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2dd4bf' }}>Elena Rostova</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Patient (Connected)</div>
                </div>
                <div className="video-tag">Patient</div>
              </div>
            </div>

            {/* Dynamic ECG Visualizer */}
            <div className="ecg-visualizer-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2dd4bf' }}>ECG</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Lead II</span>
              </div>
              <svg className="ecg-svg" viewBox="0 0 300 40">
                <path
                  className="ecg-path"
                  d="M0,20 L40,20 L50,10 L60,30 L70,5 L80,35 L90,20 L150,20 L160,10 L170,30 L180,5 L190,35 L200,20 L300,20"
                />
              </svg>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                {bpm} BPM
              </span>
            </div>

            {/* Real-Time Telemetry HUD */}
            <div className="telemetry-mini-grid" id="telemetry">
              <div className="telemetry-pill-card">
                <div className="telemetry-label">Heart Rate</div>
                <div className="telemetry-val" style={{ color: '#2dd4bf' }}>{bpm} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>bpm</span></div>
              </div>

              <div className="telemetry-pill-card">
                <div className="telemetry-label">Oxygen (SpO2)</div>
                <div className="telemetry-val" style={{ color: '#38bdf8' }}>{spo2}%</div>
              </div>

              <div className="telemetry-pill-card">
                <div className="telemetry-label">Latency (WebRTC)</div>
                <div className="telemetry-val" style={{ color: '#22c55e' }}>18 <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ms</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BENTO GRID SECTION (Ambient Intelligence Showcase) ─── */}
      <section className="kenko-bento-section" id="features">
        <div className="bento-header-center">
          <div className="hero-badge">
            <span className="pulse-dot"></span>
            <span>AMBIENT INTELLIGENCE</span>
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 1rem 0' }}>
            ENGINEERED FOR CLINICAL ACCURACY
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0 }}>
            Unified real-time clinical tooling designed with strict ergonomic standards to minimize doctor burnout and streamline diagnoses.
          </p>
        </div>

        <div className="bento-grid">
          {/* Card 1: ECG Telemetry */}
          <div className="bento-card">
            <div>
              <div className="bento-card-top">
                <div className="bento-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <span className="metric-badge-ok">● LIVE HUD</span>
              </div>
              <h3 className="bento-card-title">ECG & Biometrics</h3>
              <p className="bento-card-desc">Continuous waveform streaming with automated anomaly & arrhythmia detection.</p>
            </div>
            <div className="bento-card-preview">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Pulse Waveform</span>
                <span style={{ fontSize: '0.7rem', color: '#2dd4bf', fontWeight: 700 }}>Optimal</span>
              </div>
              <div className="metric-huge" style={{ fontSize: '1.75rem', color: '#38bdf8' }}>
                {bpm} <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>BPM</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>HRV: 48ms • RR: 16/min</div>
            </div>
          </div>

          {/* Card 2: SOAP Notes Auto-Generation */}
          <div className="bento-card">
            <div>
              <div className="bento-card-top">
                <div className="bento-card-icon" style={{ background: 'rgba(45, 212, 191, 0.1)', borderColor: 'rgba(45, 212, 191, 0.25)', color: '#2dd4bf' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#2dd4bf', fontWeight: 700 }}>AI SYNC</span>
              </div>
              <h3 className="bento-card-title">Automated SOAP Notes</h3>
              <p className="bento-card-desc">Ambient dialogue parsing into structured Subjective, Objective, Assessment & Plan notes.</p>
            </div>
            <div className="bento-card-preview">
              {soapSteps.map((step, idx) => (
                <div key={idx} className="soap-line">
                  <span className="soap-tag">[{step.tag}]</span> {step.label}: <span style={{ color: '#94a3b8' }}>{step.text.substring(0, 32)}…</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Interactive Prescription & Safety Scanner */}
          <div className="bento-card">
            <div>
              <div className="bento-card-top">
                <div className="bento-card-icon" style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.25)', color: '#fbbf24' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                    <path d="M8.5 8.5l7 7" />
                  </svg>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700 }}>SAFETY GUARD</span>
              </div>
              <h3 className="bento-card-title">Prescription Studio</h3>
              <p className="bento-card-desc">Automated dosage calculation and instant contraindication drug interaction warnings.</p>
            </div>
            <div className="bento-card-preview" style={{ borderLeft: '3px solid #fbbf24' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>Amoxicillin 500mg</div>
              <div style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: '0.2rem' }}>⚠️ Check Penicillin Allergy Flag</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>E-Signature Ready</div>
            </div>
          </div>

          {/* Card 4: WebRTC Real-Time Latency */}
          <div className="bento-card">
            <div>
              <div className="bento-card-top">
                <div className="bento-card-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.25)', color: '#22c55e' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <span className="metric-badge-ok">● 100% HEALTH</span>
              </div>
              <h3 className="bento-card-title">Zero-Latency WebRTC</h3>
              <p className="bento-card-desc">Sub-second encrypted end-to-end audio/video stream with jitter compensation.</p>
            </div>
            <div className="bento-card-preview">
              <div className="metric-huge">18 <span style={{ fontSize: '1rem', color: '#94a3b8' }}>ms</span></div>
              <div style={{ fontSize: '0.7rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span>● Loss: 0.0%</span>
                <span>● Jitter: 1.1ms</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ABOUT KENKOAI & APPLICATION PURPOSE SECTION ─── */}
      <section id="about" style={{ padding: '4.5rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 840, margin: '0 auto 3rem auto' }}>
          <div className="section-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.9rem', borderRadius: 999, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            <span className="pulse-dot"></span>
            <span>Application Overview &amp; Purpose</span>
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#fff', margin: '0 0 1rem 0' }}>
            What is <span style={{ color: '#38bdf8' }}>kenkoai</span>?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.7, margin: 0 }}>
            <strong>kenkoai</strong> is an enterprise-grade clinical intelligence and telehealth consultation platform designed to empower healthcare providers and streamline patient care. By integrating seamless video consultations with ambient medical transcription and structured electronic health records (EHR), kenkoai eliminates administrative documentation overhead so clinicians can focus on what matters most — their patients.
          </p>
        </div>

        {/* 3 Core Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 700 }}>
              1
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
              Google Meet Telehealth Integration
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Physicians securely authenticate using Google OAuth to instantly generate dedicated Google Meet video consultation spaces directly from the clinical schedule, enabling high-definition, encrypted doctor-patient encounters without third-party plugins.
            </p>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 700 }}>
              2
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
              Ambient Medical Transcription &amp; SOAP Notes
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Real-time, HIPAA-aware speech recognition automatically transcribes clinical dialogues, extracting critical symptoms, diagnoses, vitals, and treatment plans into standardized Subjective, Objective, Assessment, and Plan (SOAP) records.
            </p>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 700 }}>
              3
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
              Connected Care &amp; Follow-Up Intelligence
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Generates digital prescriptions with contraindication safety checks, routes orders to pharmacies and laboratories, and schedules automated patient condition check-ins and recovery timelines.
            </p>
          </div>
        </div>
      </section>

      {/* ─── GOOGLE MEET TELEHEALTH SECTION ─── */}
      <section id="telehealth" style={{ padding: '4rem 2rem', background: 'rgba(15, 23, 42, 0.5)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', borderRadius: 999, background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '1rem' }}>
              <span>Google Meet REST API v2 Integration</span>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '1rem', lineHeight: 1.2 }}>
              Seamless, One-Click Google Meet Teleconsultations
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              <strong>kenkoai</strong> connects with the official Google Meet REST API v2 to allow authorized clinicians to schedule, launch, and manage patient video calls directly inside the workspace.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: '#2dd4bf' }}>✔</span> Instant space provisioning via <code>meetings.space.created</code>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: '#2dd4bf' }}>✔</span> Automatic patient join links sent via email and SMS
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: '#2dd4bf' }}>✔</span> Full adherence to Google API Services User Data Policy
              </li>
            </ul>
          </div>
          <div style={{ background: 'rgba(2, 6, 23, 0.8)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 16, padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#eab308' }}></div>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }}></div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto' }}>Google Meet REST API v2</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#38bdf8', lineHeight: 1.6 }}>
              <p style={{ color: '#94a3b8', margin: '0 0 0.5rem 0' }}>// Provision Telehealth Space</p>
              <p style={{ margin: 0 }}>POST /v2/spaces</p>
              <p style={{ color: '#2dd4bf', margin: '0.25rem 0' }}>&#123; "config": &#123; "accessType": "TRUSTED" &#125; &#125;</p>
              <p style={{ color: '#a855f7', margin: '0.5rem 0 0 0' }}>✔ Meeting Space: meet.google.com/xyz-med-kenko</p>
              <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>Status: READY • Doctor &amp; Patient Connected</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER & LAUNCH STRIP ─── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '4rem 2rem 2rem 2rem', background: 'rgba(2, 6, 23, 0.9)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2.5rem', marginBottom: '3rem', textAlign: 'left' }}>
            {/* Column 1: Brand & Purpose */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>K</div>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>kenkoai</span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                Next-generation clinical intelligence platform providing ambient medical transcription, automated SOAP documentation, and Google Meet telehealth integration for modern healthcare.
              </p>
            </div>

            {/* Column 2: Navigation & Workspaces */}
            <div>
              <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                <li><a href="#about" style={{ color: '#94a3b8', textDecoration: 'none' }}>About kenkoai</a></li>
                <li><a href="#telehealth" style={{ color: '#94a3b8', textDecoration: 'none' }}>Google Meet Telehealth</a></li>
                <li><a href="#cockpit" style={{ color: '#94a3b8', textDecoration: 'none' }}>Live Cockpit HUD</a></li>
                <li><Link to="/demo" style={{ color: '#2dd4bf', textDecoration: 'none' }}>Interactive Demo</Link></li>
                <li><Link to="/login" style={{ color: '#94a3b8', textDecoration: 'none' }}>Clinician Portal</Link></li>
              </ul>
            </div>

            {/* Column 3: Legal, Privacy & Compliance */}
            <div>
              <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legal &amp; Compliance</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                <li>
                  <Link to="/privacy" style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 600 }}>
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 600 }}>
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>
                    Google API User Data Policy ↗
                  </a>
                </li>
                <li>
                  <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>
                    Google Account Permissions ↗
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact & Security */}
            <div>
              <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Support</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 0.5rem 0' }}>
                Security, Compliance &amp; Verification Team:
              </p>
              <p style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                support@kenkoai.com
              </p>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Response time: &lt; 24 hours
              </p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
            <div>
              © 2026 <strong>kenkoai</strong>. All Rights Reserved. Built for secure, connected clinical care.
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <Link to="/privacy" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Privacy Policy</Link>
              <Link to="/terms" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

