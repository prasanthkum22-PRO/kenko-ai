import React, { useState } from 'react';
import {
  IconSearch,
  IconFilter,
  IconCheck,
  IconClock,
  IconDownload,
  IconExternalLink,
  IconDoc,
  IconSparkle,
  IconShield,
  IconUser,
  IconStethoscope,
  IconAlert,
  IconGoogleMeet,
} from './icons';
import { useToast } from '../context/ToastContext';

export default function GoogleMeetTranscriptViewer({
  consultation,
  segments = [],
  onGenerateSummary,
  onMarkReviewed,
  isSummarizing = false,
}) {
  const { success, info } = useToast();
  const [search, setSearch] = useState('');
  const [filterSpeaker, setFilterSpeaker] = useState('ALL'); // ALL | DOCTOR | PATIENT
  const [copiedLink, setCopiedLink] = useState(false);

  const doctorName = consultation?.doctor_name || 'Dr. Aarav Patel';
  const patientName = consultation?.patient_name || 'Patient';
  const consultationDate = consultation?.created_at
    ? new Date(consultation.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString();

  const handleCopyTranscript = () => {
    const formatted = segments
      .map((s) => {
        const time = `${Math.floor(s.start_time / 60)}:${Math.floor(s.start_time % 60).toString().padStart(2, '0')}`;
        return `[${s.speaker.toUpperCase()} - ${time}]\n${s.text}\n`;
      })
      .join('\n');

    navigator.clipboard.writeText(formatted);
    success('Consultation transcript copied to clipboard.', 'Transcript Copied');
  };

  const handleExportTxt = () => {
    const header = `==================================================\nCONSULTATION TRANSCRIPT\nDoctor: ${doctorName}\nPatient: ${patientName} (ID: ${consultation?.patient_id || 'N/A'})\nDate: ${consultationDate}\nGoogle Meet Space: ${consultation?.google_space_name || 'N/A'}\nGoogle Meet URI: ${consultation?.google_meeting_uri || 'N/A'}\nStatus: System Generated - Clinical Review Pending\n==================================================\n\n`;
    
    const body = segments
      .map((s) => {
        const time = `${Math.floor(s.start_time / 60)}:${Math.floor(s.start_time % 60).toString().padStart(2, '0')}`;
        return `${s.speaker.toUpperCase()} [${time}]\n${s.text}\n`;
      })
      .join('\n');

    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Consultation_Transcript_${consultation?.patient_id || 'patient'}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    success('Transcript exported successfully as .txt document.', 'Export Complete');
  };

  const handleExportJson = () => {
    const dataObj = {
      consultationId: consultation?.id,
      patientId: consultation?.patient_id,
      patientName: patientName,
      doctorName: doctorName,
      consultationDate: consultationDate,
      googleSpaceName: consultation?.google_space_name,
      googleMeetingUri: consultation?.google_meeting_uri,
      totalEntries: segments.length,
      entries: segments.map((s) => ({
        speakerRole: s.speaker?.toUpperCase() === 'DOCTOR' ? 'DOCTOR' : (s.speaker?.toUpperCase() === 'PATIENT' ? 'PATIENT' : 'UNKNOWN'),
        speakerName: s.speaker,
        startTime: `${Math.floor(s.start_time / 60)}:${Math.floor(s.start_time % 60).toString().padStart(2, '0')}`,
        endTime: `${Math.floor(s.end_time / 60)}:${Math.floor(s.end_time % 60).toString().padStart(2, '0')}`,
        text: s.text,
      })),
    };

    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Consultation_Transcript_${consultation?.patient_id || 'patient'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success('Transcript exported as structured JSON.', 'JSON Export Complete');
  };

  // Filtered segments
  const filteredSegments = segments.filter((s) => {
    if (filterSpeaker === 'DOCTOR' && s.speaker?.toLowerCase() !== 'doctor') return false;
    if (filterSpeaker === 'PATIENT' && s.speaker?.toLowerCase() !== 'patient') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const textMatch = (s.text || '').toLowerCase().includes(q);
      const speakerMatch = (s.speaker || '').toLowerCase().includes(q);
      return textMatch || speakerMatch;
    }
    return true;
  });

  return (
    <div className="glass-card animate-fade-in flex flex-col gap-4" style={{ padding: 'var(--space-5)' }}>
      {/* ── Header Metadata Box with Hyperlinks ── */}
      <div
        style={{
          padding: '16px 18px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3 pb-3 border-b border-subtle">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-primary font-mono text-xs">CONSULTATION RECORD</span>
            <span className="badge badge-success text-xs flex items-center gap-1">
              <IconGoogleMeet size={12} /> Google Meet: Active
            </span>
            <span
              className={`badge text-xs font-medium ${
                consultation?.transcript_status === 'processing'
                  ? 'badge-warning animate-pulse'
                  : consultation?.transcript_status === 'failed' || consultation?.transcript_status === 'unavailable'
                  ? 'badge-danger'
                  : 'badge-success'
              }`}
            >
              {consultation?.transcript_status === 'processing'
                ? 'Transcript: Processing...'
                : consultation?.transcript_status === 'failed'
                ? 'Transcript: Failed'
                : consultation?.transcript_status === 'unavailable'
                ? 'Transcript: Unavailable'
                : 'Transcript: Ready'}
            </span>
            <span className="badge badge-secondary text-xs font-mono">NVIDIA STT (Whisper Large-v3)</span>
          </div>
          <span className="text-xs text-muted font-mono">{consultationDate}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted block font-medium">Attending Clinician:</span>
            <span className="font-semibold text-primary flex items-center gap-1 mt-0.5">
              <IconStethoscope size={14} /> {doctorName}
            </span>
          </div>
          <div>
            <span className="text-muted block font-medium">Patient Details:</span>
            <span className="font-semibold text-secondary flex items-center gap-1 mt-0.5">
              <IconUser size={14} /> {patientName} <code className="text-xs">({consultation?.patient_id || 'PT-1002'})</code>
            </span>
          </div>
          <div>
            <span className="text-muted block font-medium">Google Meet Space:</span>
            {consultation?.google_meeting_uri ? (
              <a
                href={consultation.google_meeting_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline flex items-center gap-1 mt-0.5"
                title="Open Google Meet Space"
              >
                <span>{consultation.google_meeting_code || consultation.google_space_name || 'Meet Link'}</span>
                <IconExternalLink size={12} />
              </a>
            ) : (
              <code className="text-secondary block mt-0.5 truncate">
                {consultation?.google_space_name || 'spaces/consultation'}
              </code>
            )}
          </div>
          <div>
            <span className="text-muted block font-medium">Review Status:</span>
            <span
              className={`badge ${
                consultation?.is_approved ? 'badge-success' : 'badge-warning'
              } mt-0.5`}
            >
              {consultation?.is_approved ? 'DOCTOR APPROVED' : 'PENDING DOCTOR REVIEW'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Clinical System Notice Banner ── */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.28)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <IconShield size={20} style={{ color: '#eab308', flexShrink: 0 }} />
        <span className="text-xs text-secondary" style={{ lineHeight: 1.45 }}>
          <strong>AI-generated — Doctor review required:</strong> Dialogue transcribed and speaker-separated via hosted NVIDIA Speech-to-Text AI (Whisper Large-v3) &amp; Google Meet API. Attending clinician verification is required before finalizing medical notes into EHR.
        </span>
      </div>

      {/* ── Search, Filter & Action Toolbar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <input
              type="text"
              className="input input-sm w-full"
              placeholder="Search transcript conversation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
            <IconSearch
              size={14}
              className="text-muted"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded border border-subtle">
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
            Doctor
          </button>
          <button
            type="button"
            className={`btn btn-xs ${filterSpeaker === 'PATIENT' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterSpeaker('PATIENT')}
          >
            Patient
          </button>
        </div>

        {/* Actions & Hyperlinks */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            onClick={handleCopyTranscript}
            title="Copy Full Transcript"
          >
            Copy
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            onClick={handleExportTxt}
            title="Download Transcript (.txt)"
          >
            <IconDownload size={14} /> TXT
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            onClick={handleExportJson}
            title="Download Structured JSON"
          >
            <IconDownload size={14} /> JSON
          </button>
          {onGenerateSummary && (
            <button
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              onClick={onGenerateSummary}
              disabled={isSummarizing || segments.length === 0}
            >
              <IconSparkle size={14} className={isSummarizing ? 'animate-spin' : ''} />
              <span>{isSummarizing ? 'Extracting AI Summary...' : 'Extract Clinical Facts'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Structured Dialogue Conversation Stream ── */}
      <div
        className="flex flex-col gap-3.5"
        style={{
          maxHeight: 520,
          overflowY: 'auto',
          padding: '14px 8px',
        }}
      >
        {filteredSegments.length === 0 ? (
          <div className="empty-state py-8">
            <p className="text-sm text-muted">No dialogue segments matching your filter criteria.</p>
          </div>
        ) : (
          filteredSegments.map((seg, idx) => {
            const isDoctor = seg.speaker?.toLowerCase() === 'doctor';
            const isPatient = seg.speaker?.toLowerCase() === 'patient';
            const isUnknown = !isDoctor && !isPatient;
            const timeFormatted = `${Math.floor(seg.start_time / 60)}:${Math.floor(
              seg.start_time % 60
            )
              .toString()
              .padStart(2, '0')}`;

            return (
              <div
                key={seg.id || idx}
                className="flex flex-col gap-1.5 animate-fade-in"
                style={{
                  alignSelf: isDoctor ? 'flex-start' : isPatient ? 'flex-end' : 'center',
                  maxWidth: '85%',
                  minWidth: '280px',
                }}
              >
                {/* Speaker Header with Icon */}
                <div
                  className="flex items-center gap-2 px-1"
                  style={{
                    justifyContent: isDoctor ? 'flex-start' : isPatient ? 'flex-end' : 'center',
                  }}
                >
                  <span
                    className="font-bold tracking-wider flex items-center gap-1"
                    style={{
                      fontSize: '0.74rem',
                      color: isDoctor
                        ? 'var(--color-primary-400)'
                        : isPatient
                        ? '#38bdf8'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {isDoctor && <IconStethoscope size={13} />}
                    {isPatient && <IconUser size={13} />}
                    {isUnknown && <IconAlert size={13} />}
                    {isDoctor ? 'DOCTOR' : isPatient ? 'PATIENT' : 'UNKNOWN'}
                  </span>
                  <span className="text-xs text-muted font-mono flex items-center gap-1">
                    <IconClock size={10} /> {timeFormatted}
                  </span>
                </div>

                {/* Speech Bubble */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: isDoctor
                      ? '4px 16px 16px 16px'
                      : isPatient
                      ? '16px 4px 16px 16px'
                      : '12px',
                    background: isDoctor
                      ? 'var(--color-bg-surface)'
                      : isPatient
                      ? 'rgba(56, 189, 248, 0.08)'
                      : 'var(--color-bg-base)',
                    border: `1px solid ${
                      isDoctor
                        ? 'var(--color-border-subtle)'
                        : isPatient
                        ? 'rgba(56, 189, 248, 0.28)'
                        : 'var(--color-border-subtle)'
                    }`,
                    color: 'var(--color-text-primary)',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                  }}
                >
                  {seg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer Review Check ── */}
      {onMarkReviewed && (
        <div className="pt-3 border-t border-subtle flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted">
            Total {segments.length} verified dialogue entries from Google Meet conference.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            onClick={onMarkReviewed}
          >
            <IconCheck size={14} /> Mark Transcript as Reviewed
          </button>
        </div>
      )}
    </div>
  );
}
