import React from 'react';
import { Link } from 'react-router-dom';
import { IconShield, IconCheck, IconExternalLink } from '../components/icons';

export default function PrivacyPolicyPage() {
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
              background: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
            }}
          >
            <IconShield size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-primary" style={{ margin: 0 }}>
              Privacy Policy
            </h1>
            <p className="text-xs text-muted mt-1">
              KENKO AI Clinical Intelligence Platform · Last updated: September 2026
            </p>
          </div>
          <Link to="/" className="btn btn-secondary btn-sm ml-auto">
            Back to Home
          </Link>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6 text-sm text-secondary" style={{ lineHeight: 1.7 }}>
          <section>
            <h2 className="text-lg font-bold text-primary mb-2">1. Overview &amp; Scope</h2>
            <p>
              KENKO AI ("we", "our", or "the Platform") provides an intelligent clinical workspace and telehealth consultation bridge designed for licensed medical doctors and patients. We are committed to protecting the privacy, security, and confidentiality of all clinical, personal, and health-related data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">2. Google API Services &amp; OAuth 2.0 Disclosure</h2>
            <p>
              KENKO AI integrates with Google OAuth 2.0 and Google Meet REST API v2 (<code>meet.googleapis.com</code>) to allow authenticated healthcare providers to create and manage secure telehealth video consultation spaces.
            </p>
            <div
              className="p-4 rounded-xl border border-subtle my-3"
              style={{ background: 'var(--color-bg-base)' }}
            >
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                Requested Google OAuth Scopes &amp; Usage:
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-secondary">
                <li>
                  <strong><code>https://www.googleapis.com/auth/meetings.space.created</code></strong>: Exclusively used to generate real-time Google Meet video consultation spaces for scheduled doctor-patient telehealth sessions.
                </li>
                <li>
                  <strong><code>https://www.googleapis.com/auth/meetings.space.readonly</code></strong>: Used to verify conference session status and conference records for clinical verification.
                </li>
                <li>
                  <strong><code>openid</code>, <code>email</code>, <code>profile</code></strong>: Used to identify the authorized physician and display account association status in the clinical workspace.
                </li>
              </ul>
            </div>
            <p className="text-xs text-muted">
              KENKO AI's use and transfer of information received from Google APIs to any other app will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                Google API Services User Data Policy <IconExternalLink size={12} />
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">3. Data Protection &amp; Security</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Server-Side Credentials:</strong> OAuth Client Secrets, tokens, and refresh tokens are stored strictly encrypted on backend servers and are never exposed to browser clients or public databases.
              </li>
              <li>
                <strong>No Data Selling:</strong> We do not sell, rent, or trade patient health records, doctor credentials, or consultation data to third-party advertisers or data brokers.
              </li>
              <li>
                <strong>Clinical Informed Consent:</strong> Telehealth sessions and transcription features are only activated with explicit clinical participant consent.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">4. Data Retention &amp; Revocation</h2>
            <p>
              Healthcare providers can disconnect their Google account at any time directly through the Telehealth Consultation settings screen or via{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google Account Permissions
              </a>
              . Disconnecting immediately revokes active tokens.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">5. Contact Information</h2>
            <p>
              If you have any questions regarding this Privacy Policy or clinical data security, contact our compliance team at:{' '}
              <span className="font-semibold text-primary">support@kenkoai.com</span> or{' '}
              <span className="font-semibold text-primary">compliance@medibridge.ai</span>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 mt-8 border-t border-subtle text-xs text-muted">
          <span>© 2026 KENKO AI · All Rights Reserved</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-primary underline">
              Terms of Service
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
