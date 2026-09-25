import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPatientDocuments } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconDoc,
  IconRx,
  IconClock,
  IconShield,
  IconCheck,
} from '../../components/icons';

export default function PatientDocumentsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewDoc, setViewDoc] = useState(null);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    try {
      setLoading(true);
      const res = await getPatientDocuments();
      setDocuments(res || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      addToast('Failed to retrieve authorized clinical documents.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', 'Prescription', 'Consultation Summary', 'Investigation', 'Follow-Up'];

  const filteredDocs = activeCategory === 'All'
    ? documents
    : documents.filter((d) => (d.category || '').toLowerCase().includes(activeCategory.toLowerCase()));

  const handleDownload = (doc) => {
    // Generate authorized downloadable JSON/PDF stub
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(doc, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${doc.title.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast(`Document "${doc.title}" downloaded securely.`, 'success');
  };

  return (
    <div className="workspace-container" style={{ padding: '2rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
          <Link to="/patient" style={{ color: 'var(--color-text-secondary, #94a3b8)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <IconDoc style={{ width: 24, height: 24 }} />
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Patient Document Center
              </h1>
              <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.95rem', marginTop: 2 }}>
                Authorized clinical records, verified prescriptions, and diagnostic summaries.
              </p>
            </div>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 14px', borderRadius: 9999, fontSize: '0.85rem', fontWeight: 600 }}>
            <IconShield style={{ width: 16, height: 16 }} /> RBAC Verified Access
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 9999, whiteSpace: 'nowrap' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
          <div className="spinner-container">
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <p className="text-muted" style={{ marginTop: '1rem' }}>Loading authorized records…</p>
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem',
            textAlign: 'center',
            background: 'var(--color-surface, #1e293b)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <IconDoc style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>No Documents Found</h3>
          <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
            There are no documents matching category "{activeCategory}".
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="card"
              style={{
                padding: '1.5rem',
                background: 'var(--color-surface, #1e293b)',
                borderRadius: 16,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                    }}
                  >
                    {doc.category}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{doc.date}</span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
                  {doc.title}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #94a3b8)', margin: '0 0 1.25rem 0' }}>
                  {doc.summary}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setViewDoc(doc)}
                >
                  View Document
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => handleDownload(doc)}
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Modal Document Viewer ──────────────────────────────── */}
      {viewDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setViewDoc(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 600,
              width: '100%',
              padding: '2rem',
              background: 'var(--color-surface, #1e293b)',
              borderRadius: 18,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                  {viewDoc.category} • Authorized Access
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '4px 0 0 0' }}>{viewDoc.title}</h2>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setViewDoc(null)}
                style={{ fontSize: '1.2rem', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 10, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: 8 }}><strong>Date:</strong> {viewDoc.date}</div>
              <div style={{ marginBottom: 8 }}><strong>Format:</strong> {viewDoc.format}</div>
              <div><strong>Summary Details:</strong> {viewDoc.summary}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setViewDoc(null)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => handleDownload(viewDoc)}>
                Download Certified Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
