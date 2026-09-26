/**
 * GoogleMeetTranscriptViewer — Clean Clinical Transcript Viewer
 *
 * Rules:
 *  - Chat-style transcript with clinical, subtle backgrounds
 *  - Clear states: Not Available, Processing, Ready, Failed
 *  - Compact search and speaker filters (All, Doctor, Patient)
 *  - Real data only (no fake names or simulated ingested claims)
 */
import React, { useState } from 'react';
import {
  IconSearch,
  IconCheck,
  IconClock,
  IconDownload,
  IconDoc,
  IconSparkle,
  IconUser,
  IconStethoscope,
  IconAlert,
  IconRefresh,
} from './icons';
import { useToast } from '../context/ToastContext';

// Normalize speaker to role
function getSpeakerRole(seg) {
  const s = (seg.speakerRole || seg.speaker || '').toUpperCase();
  if (s === 'DOCTOR' || s === 'DR') return 'DOCTOR';
  if (s === 'PATIENT' || s === 'PT') return 'PATIENT';
  return 'UNKNOWN';
}

function formatTime(val) {
  if (val == null) return '--:--';
  if (typeof val === 'number') {
    const mins = Math.floor(val / 60);
    const secs = Math.floor(val % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return String(val);
}

export default function GoogleMeetTranscriptViewer({
  consultation,
  segments = [],
  transcriptStatus = 'pending',
  onGenerateSummary,
  onMarkReviewed,
  onRetrySync,
  isSummarizing = false,
  isDoctor = false,
}) {
  const { success } = useToast();
  const [search, setSearch] = useState('');
  const [filterSpeaker, setFilterSpeaker] = useState('ALL');

  const isReady = transcriptStatus === 'ready' && segments.length > 0;
  const isProcessing = transcriptStatus === 'processing';
  const isFailed = transcriptStatus === 'failed';

  const doctorName = consultation?.doctor_name || null;
  const patientName = consultation?.patient_name || null;

  const handleCopyTranscript = () => {
    const formatted = segments
      .map((s) => {
        const role = getSpeakerRole(s);
        const time = formatTime(s.start_time ?? s.startTime);
        return `[${role} · ${time}]\n${s.text}\n`;
      })
      .join('\n');
    navigator.clipboard.writeText(formatted);
    success('Transcript copied to clipboard.', 'Copied');
  };

  const handleExportTxt = () => {
    const header = [
      '==================================================',
      'KENKO-AI TELEHEALTH TRANSCRIPT',
      doctorName ? `Doctor: ${doctorName}` : '',
      patientName ? `Patient: ${patientName}` : '',
      '==================================================',
      '',
    ]
      .filter(Boolean)
      .join('\n');
    const body = segments
      .map((s) => {
        const role = getSpeakerRole(s);
        const time = formatTime(s.start_time ?? s.startTime);
        return `${role} (${time}):\n${s.text}\n`;
      })
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transcript_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    success('Transcript downloaded.', 'Export');
  };

  const filteredSegments = segments.filter((s) => {
    const role = getSpeakerRole(s);
    if (filterSpeaker === 'DOCTOR' && role !== 'DOCTOR') return false;
    if (filterSpeaker === 'PATIENT' && role !== 'PATIENT') return false;
    if (filterSpeaker === 'UNKNOWN' && role !== 'UNKNOWN') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (s.text || '').toLowerCase().includes(q) || role.toLowerCase().includes(q);
    }
    return true;
  });

  const doctorCount = segments.filter((s) => getSpeakerRole(s) === 'DOCTOR').length;
  const patientCount = segments.filter((s) => getSpeakerRole(s) === 'PATIENT').length;
  const unknownCount = segments.filter((s) => getSpeakerRole(s) === 'UNKNOWN').length;

  return (
    <div
      className="glass-card animate-fade-in flex flex-col gap-4"
      style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Transcript Header & Status */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-subtle">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-primary" style={{ margin: 0 }}>
            Consultation Transcript
          </h3>
          {isReady && (
            <span className="badge badge-success text-xs flex items-center gap-1">
              <IconCheck size={12} />
              <span>Transcript Ready</span>
            </span>
          )}
          {isProcessing && (
            <span className="badge badge-warning text-xs flex items-center gap-1">
              <span className="spinner spinner-xs" style={{ width: 10, height: 10 }} />
              <span>Processing...</span>
            </span>
          )}
        </div>

        {isReady && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-xs text-secondary"
              onClick={handleCopyTranscript}
            >
              Copy
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs text-secondary flex items-center gap-1"
              onClick={handleExportTxt}
            >
              <IconDownload size={12} />
              <span>Export</span>
            </button>
          </div>
        )}
      </div>

      {/* STATE: NOT AVAILABLE */}
      {!isReady && !isProcessing && !isFailed && (
        <div
          className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-subtle"
          style={{ background: 'var(--color-bg-base)' }}
        >
          <IconDoc size={32} className="text-muted mb-2" />
          <p className="text-sm font-medium text-primary">Transcript not available yet.</p>
          <p className="text-xs text-muted max-w-sm mt-1">
            Transcript will appear here after the consultation concludes and has been processed.
          </p>
        </div>
      )}

      {/* STATE: PROCESSING */}
      {isProcessing && (
        <div
          className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-subtle"
          style={{ background: 'var(--color-bg-base)' }}
        >
          <span className="spinner mb-3" style={{ width: 28, height: 28 }} />
          <p className="text-sm font-semibold text-primary">Processing consultation transcript...</p>
          <p className="text-xs text-muted max-w-sm mt-1">
            Google Meet transcript is being generated and formatted for clinical review.
          </p>
        </div>
      )}

      {/* STATE: FAILED */}
      {isFailed && (
        <div
          className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-subtle"
          style={{ background: 'var(--color-bg-base)' }}
        >
          <IconAlert size={28} className="text-danger mb-2" />
          <p className="text-sm font-semibold text-primary">Transcript processing failed.</p>
          <p className="text-xs text-muted max-w-sm mt-1 mb-3">
            Unable to retrieve the transcript from Google Meet.
          </p>
          {onRetrySync && (
            <button
              type="button"
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              onClick={onRetrySync}
            >
              <IconRefresh size={14} />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* STATE: READY */}
      {isReady && (
        <>
          {/* Search & Filters */}
          <div className="flex items-center justify-between flex-wrap gap-2.5">
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                className="input input-sm w-full"
                placeholder="Search transcript..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '32px' }}
              />
              <IconSearch
                size={14}
                className="text-muted"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>

            <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-subtle">
              <button
                type="button"
                className={`btn btn-xs ${filterSpeaker === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterSpeaker('ALL')}
              >
                All ({segments.length})
              </button>
              <button
                type="button"
                className={`btn btn-xs ${filterSpeaker === 'DOCTOR' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterSpeaker('DOCTOR')}
              >
                Doctor ({doctorCount})
              </button>
              <button
                type="button"
                className={`btn btn-xs ${filterSpeaker === 'PATIENT' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterSpeaker('PATIENT')}
              >
                Patient ({patientCount})
              </button>
              {unknownCount > 0 && (
                <button
                  type="button"
                  className={`btn btn-xs ${filterSpeaker === 'UNKNOWN' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setFilterSpeaker('UNKNOWN')}
                >
                  Unknown ({unknownCount})
                </button>
              )}
            </div>
          </div>

          {/* Clean Chat-style Dialogue */}
          <div
            className="flex flex-col gap-3"
            style={{
              maxHeight: 460,
              overflowY: 'auto',
              padding: '8px 4px',
            }}
          >
            {filteredSegments.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                No dialogue matches your search or filter.
              </div>
            ) : (
              filteredSegments.map((seg, idx) => {
                const role = getSpeakerRole(seg);
                const isDoc = role === 'DOCTOR';
                const isPt = role === 'PATIENT';
                const timeStr = formatTime(seg.start_time ?? seg.startTime);

                return (
                  <div
                    key={seg.id || idx}
                    className="flex flex-col gap-1 text-left"
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: isDoc
                        ? 'var(--color-bg-base)'
                        : isPt
                        ? 'rgba(59, 130, 246, 0.05)'
                        : 'var(--color-bg-base)',
                      borderLeft: isDoc
                        ? '3px solid var(--color-primary)'
                        : isPt
                        ? '3px solid #38bdf8'
                        : '3px solid var(--color-text-muted)',
                      borderTop: '1px solid var(--color-border-subtle)',
                      borderRight: '1px solid var(--color-border-subtle)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className="font-bold uppercase tracking-wider flex items-center gap-1.5"
                        style={{
                          fontSize: '0.75rem',
                          color: isDoc
                            ? 'var(--color-primary)'
                            : isPt
                            ? '#0284c7'
                            : 'var(--color-text-muted)',
                        }}
                      >
                        {isDoc ? <IconStethoscope size={13} /> : <IconUser size={13} />}
                        <span>{role}</span>
                      </span>
                      <span className="text-xs text-muted flex items-center gap-1">
                        <IconClock size={11} />
                        <span>{timeStr}</span>
                      </span>
                    </div>
                    <p
                      className="text-sm text-primary mt-1"
                      style={{ margin: '4px 0 0 0', lineHeight: 1.55 }}
                    >
                      {seg.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Doctor Actions */}
          {isDoctor && (
            <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-subtle">
              <span className="text-xs text-muted">
                {segments.length} dialogue entries recorded
              </span>
              <div className="flex items-center gap-2">
                {onGenerateSummary && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex items-center gap-1.5"
                    onClick={onGenerateSummary}
                    disabled={isSummarizing}
                  >
                    <IconSparkle size={14} className={isSummarizing ? 'animate-spin' : ''} />
                    <span>{isSummarizing ? 'Extracting Summary...' : 'Extract Clinical Summary'}</span>
                  </button>
                )}
                {onMarkReviewed && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm flex items-center gap-1"
                    onClick={onMarkReviewed}
                  >
                    <IconCheck size={14} />
                    <span>Mark Reviewed</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

