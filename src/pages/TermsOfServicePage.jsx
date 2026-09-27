
import React from 'react';
import { Link } from 'react-router-dom';
import { IconShield, IconCheck, IconExternalLink } from '../components/icons';

export default function TermsOfServicePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-base)',
        color: 'var(--color-text-primary)',
        padding: '48px 24px',
      }}
    >
      <div
        className="glass-card animate-fade-in"
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '40px 32px',
          borderRadius: '20px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 pb-6 mb-6 border-b border-subtle">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              background: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-success)',
            }}
          >
            <IconShield size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-primary" style={{ margin: 0 }}>
              Terms of Service
            </h1>
            <p className="text-xs text-muted mt-1">
              KENKO AI Clinical Intelligence Platform · Effective: September 2026
            </p>
          </div>
          <Link to="/" className="btn btn-secondary btn-sm ml-auto">
            Back to Home
          </Link>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6 text-sm text-secondary" style={{ lineHeight: 1.7 }}>
          <section>
            <h2 className="text-lg font-bold text-primary mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the KENKO AI Platform ("KENKO AI", "the Service"), including our telehealth video consultation integrations, prescription studio, and clinical workflow tools, you agree to comply with and be bound by these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">2. Clinical &amp; Professional Use</h2>
            <p>
              KENKO AI is designed to assist licensed physicians, healthcare practitioners, clinics, and patients in facilitating telehealth consultations. The platform provides tools for video meetings, clinical documentation, and scheduling. Practitioners retain full responsibility for all clinical decisions, medical advice, diagnoses, and treatments provided.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">3. Telehealth &amp; Google Meet Integration</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Video Consultation Spaces:</strong> When authorized by a healthcare provider, the service connects to Google Meet REST API v2 to provision dedicated meeting spaces for telehealth appointments.
              </li>
              <li>
                <strong>Participant Conduct:</strong> All video consultations must adhere to applicable professional medical conduct and clinical privacy standards.
              </li>
              <li>
                <strong>Informed Consent:</strong> Doctors are responsible for confirming patient consent prior to initiating recorded or transcribed telehealth sessions.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">4. User Account &amp; Security</h2>
            <p>
              Users are responsible for safeguarding their login credentials and OAuth access tokens. Any unauthorized use or security breach must be reported immediately to our security response team.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">5. Service Availability &amp; Modifications</h2>
            <p>
              We strive for continuous uptime and high reliability. We reserve the right to modify, upgrade, or enhance platform features to meet evolving clinical standards and technological improvements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">6. Contact</h2>
            <p>
              For legal and terms inquiries, reach out to <span className="font-semibold text-primary">legal@kenkoai.com</span>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 mt-8 border-t border-subtle text-xs text-muted">
          <span>© 2026 KENKO AI · All Rights Reserved</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-primary underline">
              Privacy Policy
            </Link>
            <Link to="/consultations" className="hover:text-primary underline">
              Consultations
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
