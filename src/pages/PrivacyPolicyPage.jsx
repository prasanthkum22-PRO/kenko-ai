import React from 'react';
import { Link } from 'react-router-dom';
import { IconShield, IconExternalLink } from '../components/icons';

export default function PrivacyPolicyPage() {
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
        {/* Top Header */}
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
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <IconShield size={28} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Privacy Policy for kenkoai
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

        {/* Policy Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontSize: '0.925rem', lineHeight: 1.75, color: '#cbd5e1' }}>
          {/* Section 1 */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              1. Introduction &amp; Application Identity
            </h2>
            <p>
              This Privacy Policy describes how <strong>kenkoai</strong> ("we", "our", or "the Application") collects, uses, processes, and protects personal and clinical information when you use our web application, telehealth video tools, and clinical intelligence services accessible at our primary web portal.
            </p>
            <p>
              <strong>kenkoai</strong> is designed to support healthcare practitioners, medical clinics, and patients by facilitating high-quality telehealth consultations, ambient medical transcription, structured SOAP documentation, and connected clinical care. We hold data privacy, clinical confidentiality, and user security to the highest ethical and regulatory standards.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              2. Google API Services &amp; OAuth 2.0 User Data Policy
            </h2>
            <p>
              <strong>kenkoai</strong> provides Google OAuth 2.0 and Google Meet REST API v2 integrations to allow licensed clinicians to conduct remote medical appointments. When you connect your Google Account with kenkoai, we request access only to the minimal scopes strictly necessary to deliver telehealth services:
            </p>

            <div
              style={{
                background: 'rgba(2, 6, 23, 0.6)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '12px',
                padding: '20px',
                margin: '16px 0',
              }}
            >
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                Specific Google OAuth Scopes Requested &amp; Their Purpose:
              </h3>
              <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
                <li>
                  <strong style={{ color: '#38bdf8' }}><code>https://www.googleapis.com/auth/meetings.space.created</code></strong>:
                  <br />
                  Exclusively used to create and configure real-time Google Meet video consultation spaces for scheduled appointments between healthcare providers and patients.
                </li>
                <li>
                  <strong style={{ color: '#38bdf8' }}><code>https://www.googleapis.com/auth/meetings.space.readonly</code></strong>:
                  <br />
                  Used to read conference space metadata and conference records to confirm participant connection status and appointment completion.
                </li>
                <li>
                  <strong style={{ color: '#38bdf8' }}><code>openid</code>, <code>email</code>, <code>profile</code></strong>:
                  <br />
                  Used strictly to verify the identity of the authenticated physician and associate their Google account with their verified clinical workspace.
                </li>
              </ul>
            </div>

            <div
              style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '12px',
                padding: '16px 20px',
                margin: '16px 0',
              }}
            >
              <h4 style={{ margin: '0 0 8px 0', color: '#22c55e', fontSize: '0.95rem', fontWeight: 700 }}>
                Google API Services User Data Policy Compliance (Limited Use)
              </h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#e2e8f0' }}>
                <strong>kenkoai's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.</strong>
              </p>
            </div>

            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
              <li><strong>No Data Brokering or Advertising:</strong> Google user data and consultation records are NEVER sold, rented, or transferred to third-party data brokers, advertising platforms, or marketing organizations.</li>
              <li><strong>No Foundation Model Training:</strong> Google user data and clinical conversation data are NOT used to train generalized artificial intelligence or machine learning models without explicit participant authorization.</li>
              <li><strong>Secure Server-Side Token Handling:</strong> OAuth refresh tokens and client credentials are encrypted at rest using industry-standard cryptography and are never sent to browser clients or public code repositories.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              3. Information We Collect &amp; How We Use It
            </h2>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Account &amp; Profile Data:</strong> Practitioner names, email addresses, specialized clinical roles, and contact credentials necessary for secure account management.</li>
              <li><strong>Consultation &amp; Appointment Logs:</strong> Appointment timestamps, duration, participant identifiers, and clinical notes generated during patient visits.</li>
              <li><strong>Clinical Transcription Data:</strong> With explicit practitioner and patient consent, audio streams are transcribed during active consultations solely to assist the doctor in generating clinical SOAP documentation.</li>
              <li><strong>Technical Logs:</strong> Server logs, browser types, and IP addresses used solely for system diagnostic and cyber-security protection purposes.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              4. Data Security &amp; Storage Protections
            </h2>
            <p>
              We implement comprehensive technical and organizational safeguards to ensure patient and clinician data remains protected:
            </p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Encryption in Transit:</strong> All web traffic and API communications are strictly encrypted using TLS 1.3 / HTTPS.</li>
              <li><strong>Encryption at Rest:</strong> Database records, authentication secrets, and clinical storage buckets are protected with AES-256 encryption.</li>
              <li><strong>Strict Role-Based Access Controls (RBAC):</strong> Clinical data is partitioned so only authorized physicians and assigned patients can access corresponding clinical files.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              5. User Control, Revocation &amp; Data Deletion
            </h2>
            <p>
              You maintain total control over your data and connected Google services:
            </p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>Revoking Google Permissions:</strong> Healthcare providers can disconnect their Google account at any time in the kenkoai clinical settings or directly through the{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  Google Account Permissions Manager
                </a>
                . Revocation immediately renders all stored OAuth tokens invalid.
              </li>
              <li>
                <strong>Requesting Data Deletion:</strong> You have the right to request deletion of your account and associated records by emailing our Data Protection Officer at <span style={{ color: '#38bdf8', fontWeight: 600 }}>privacy@kenkoai.com</span>. We fulfill verified deletion requests within 30 business days in compliance with statutory medical record retention laws.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
              6. Contact Information
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or kenkoai's compliance with Google API policies, please reach out to our team:
            </p>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'inline-block',
              }}
            >
              <p style={{ margin: '0 0 6px 0' }}><strong>Application:</strong> kenkoai</p>
              <p style={{ margin: '0 0 6px 0' }}><strong>Compliance &amp; Privacy Officer:</strong> support@kenkoai.com / privacy@kenkoai.com</p>
              <p style={{ margin: 0 }}><strong>Website:</strong> <Link to="/" style={{ color: '#38bdf8' }}>kenkoai Home</Link></p>
            </div>
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
            <Link to="/terms" style={{ color: '#94a3b8', textDecoration: 'underline' }}>
              Terms of Service
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
