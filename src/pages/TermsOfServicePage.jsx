import React from 'react';
import { Link } from 'react-router-dom';
import { IconShield, IconExternalLink } from '../components/icons';

export default function TermsOfServicePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#090d16',
        color: '#f1f5f9',
        padding: '48px 20px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '920px',
          margin: '0 auto',
          padding: '44px 36px',
          borderRadius: '20px',
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '24px',
            marginBottom: '32px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22c55e',
              }}
            >
              <IconShield size={28} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Terms of Service for kenkoai
              </h1>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Application Name: <strong>kenkoai</strong> · Effective Date: September 2026
              </p>
            </div>
          </div>
          <Link
            to="/"
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            ← Back to Home
          </Link>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontSize: '0.925rem', lineHeight: 1.75, color: '#cbd5e1' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the <strong>kenkoai</strong> application and associated services ("kenkoai", "the Platform", or "the Service"), including our telehealth video consultation tools, ambient transcription suite, and clinical workflow features, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not access or use the application.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              2. Clinical &amp; Professional Use Disclaimer
            </h2>
            <p>
              <strong>kenkoai</strong> provides productivity, transcription, and telehealth coordination tools to support licensed medical practitioners and healthcare institutions. The platform does not replace independent medical judgment. Healthcare practitioners retain full professional responsibility for all clinical diagnoses, medical assessments, prescriptions, and treatment plans provided to patients.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              3. Telehealth &amp; Google Meet Integration Terms
            </h2>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>Authorized Google Account Use:</strong> Healthcare practitioners who link their Google accounts authorize kenkoai to access the Google Meet REST API v2 solely to schedule, initiate, and manage encrypted video consultation spaces.
              </li>
              <li>
                <strong>Informed Consent:</strong> Clinicians are responsible for obtaining appropriate patient consent prior to initiating telehealth video visits or enabling live ambient transcription features.
              </li>
              <li>
                <strong>Google API Policy Compliance:</strong> Our use of Google API Services complies with the Google API Services User Data Policy, ensuring patient and clinician data is protected and never sold or misused.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              4. User Accounts &amp; Security
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your credentials and access tokens. You must immediately notify our security response team if you suspect any unauthorized access to your account or workspace.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              5. Contact Information
            </h2>
            <p>
              For any legal or terms inquiries, please contact our support team at <span style={{ color: '#38bdf8', fontWeight: 600 }}>support@kenkoai.com</span> or <span style={{ color: '#38bdf8', fontWeight: 600 }}>legal@kenkoai.com</span>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '24px',
            marginTop: '36px',
            fontSize: '0.825rem',
            color: '#64748b',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span>© 2026 <strong>kenkoai</strong>. All Rights Reserved.</span>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link to="/privacy" style={{ color: '#94a3b8', textDecoration: 'underline' }}>
              Privacy Policy
            </Link>
            <Link to="/" style={{ color: '#94a3b8', textDecoration: 'underline' }}>
              Home Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
