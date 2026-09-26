/**
 * GoogleMeetTranscriptViewer
 *
 * Rules:
 *  - Shows actual transcript status from props (not assumed)
 *  - "Generate SOAP" button DISABLED until transcript is available
 *  - Filters: All, Doctor, Patient, Unknown
 *  - No fake speaker names — DOCTOR / PATIENT / UNKNOWN
 *  - Does NOT claim "Google Meet: Active" unless we have real data
 *  - Only shows "Transcript Ready" badge when transcriptStatus === 'ready'
 */
import React, { useState } from 'react';
import {
  IconSearch,
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

// Normalize speaker from DB value to display role
function getSpeakerRole(seg) {
  const s = (seg.speakerRole || seg.speaker || '').toUpperCase();
  if (s === 'DOCTOR' || s === 'DR') return 'DOCTOR';
  if (s === 'PATIENT' || s === 'PT') return 'PATIENT';
  return 'UNKNOWN';
}

export default function GoogleMeetTranscriptViewer({
  consultation,
  segments = [],
  transcriptStatus = 'pending',
  onGenerateSummary,
  onMarkReviewed,
  isSummarizing = false,
}) {
  const { success } = useToast();
  const [search, setSearch] = useState('');
  const [filterSpeaker, setFilterSpeaker] = useState('ALL');

  const doctorName = consultation?.doctor_name || null;
  const patientName = consultation?.patient_name || null;
  const consultationDate = consultation?.created_at
    ? new Date(consultation.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const isTranscriptReady = transcriptStatus === 'ready' && segments.length > 0;
  const isTranscriptProcessing = transcriptStatus === 'processing';
  const isTranscriptFailed = transcriptStatus === 'failed';
  const isTranscriptUnavailable = transcriptStatus === 'unavailable';

  const handleCopyTranscript = () => {
    const formatted = segments.map((s) => {
      const role = getSpeakerRole(s);
      const time = s.start_time != null
        ? `${Math.floor(s.start_time / 60)}:${Math.floor(s.start_time % 60).toString().padStart(2, '0')}`
        : (s.startTime || '--:--');
      return `[${role} - ${time}]\n${s.text}\n`;
    }).join('\n');
    navigator.clipboard.writeText(formatted);
    success('Transcript copied to clipboard.', 'Copied');
  };

  const handleExportTxt = () => {
    const header = [
      '==================================================',
      'CONSULTATION TRANSCRIPT',
      doctorName ? `Doctor: ${doctorName}` : 'Doctor: --',
      patientName ? `Patient: ${patientName} (ID: ${consultation?.patient_id || 'N/A'})` : 'Patient: --',
      consultationDate ? `Date: ${consultationDate}` : '',
      consultation?.google_space_name ? `Google Meet Space: ${consultation.google_space_name}` : '',
      consultation?.google_meeting_uri ? `Google Meet URI: ${consultation.google_meeting_uri}` : '',
      'Status: System Generated — Clinical Review Pending',
      '==================================================',
      '',
    ].filter(Boolean).join('\n');
    const body = segments.map((s) => {
      const role = getSpeakerRole(s);
      const time = s.start_time != null ? `${Math.floor(s.start_time / 60)}:${Math.floor(s.start_time % 60).toString().padStart(2, '0')}` : (s.startTime || '--:--');
      return `${role} [${time}]\n${s.text}\n`;
    }).join('\n');
    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transcript_${consultation?.patient_id || 'patient'}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    success('Transcript exported.', 'Export Complete');
  };

  const handleExportJson = () => {
    const dataObj = {
      consultationId: consultation?.id,
      patientId: consultation?.patient_id || null,
      patientName: patientName || null,
      doctorName: doctorName || null,
      consultationDate: consultationDate || null,
      googleSpaceName: consultation?.google_space_name || null,
      googleMeetingUri: consultation?.google_meeting_uri || null,
      totalEntries: segments.length,
      entries: segments.map((s) => ({
        speakerRole: getSpeakerRole(s),
        startTime: s.start_time != null ? `${Math.floor(s.start_time / 60)}:${Math.floor(s.start_time % 60).toString().padStart(2, '0')}` : (s.startTime || null),
        endTime: s.end_time != null ? `${Math.floor(s.end_time / 60)}:${Math.floor(s.end_time % 60).toString().padStart(2, '0')}` : (s.endTime || null),
        text: s.text,
        participantResourceName: s.participantResourceName || null,
      })),
    };
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transcript_${consultation?.patient_id || 'patient'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success('Transcript exported as JSON.', 'JSON Export');
  };

  // Filter segments
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
    <div className="glass-card animate-fade-in flex flex-col gap-4" style={{ padding: 'var(--space-5)' }}>
      {/* Header Metadata Box */}
      <div style={{ padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border-subtle)' }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3 pb-3 border-b border-subtle">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-primary font-mono text-xs">TRANSCRIPT</span>
            {/* Transcript status badge — based on real status */}
            {isTranscriptReady ? (
              <span className="badge badge-success text-xs flex items-center gap-1">
                <IconCheck size={12} /> Transcript Ready
              </span>
            ) : isTranscriptProcessing ? (
              <span className="badge badge-warning animate-pulse text-xs">Transcript: Processing...</span>
            ) : isTranscriptFailed ? (
              <span className="badge badge-danger text-xs">Transcript: Failed</span>
            ) : isTranscriptUnavailable ? (
              <span className="badge badge-secondary text-xs">Transcript: Unavailable</span>
            ) : (
              <span className="badge badge-secondary text-xs">Waiting for transcript...</span>
            )}
          </div>
          {consultationDate && <span className="text-xs text-muted font-mono">{consultationDate}</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted block font-medium">Attending Clinician:</span>
            <span className="font-semibold text-primary flex items-center gap-1 mt-0.5">
              <IconStethoscope size={14} />
              {doctorName ? (doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`) : <em className="text-muted">Not assigned</em>}
            </span>
          </div>
          <div>
            <span className="text-muted block font-medium">Patient:</span>
            <span className="font-semibold text-secondary flex items-center gap-1 mt-0.5">
              <IconUser size={14} />
              {patientName || <em className="text-muted">Unavailable</em>}
              {consultation?.patient_id && <code className="text-xs ml-1">({consultation.patient_id})</code>}
            </span>
          </div>
          <div>
            <span className="text-muted block font-medium">Google Meet Space:</span>
            {consultation?.google_meeting_uri ? (
              <a href={consultation.google_meeting_uri} target="_blank" rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline flex items-center gap-1 mt-0.5">
                <span>{consultation.google_meeting_code || consultation.google_space_name || 'Join Meet'}</span>
                <IconExternalLink size={12} />
              </a>
            ) : consultation?.google_space_name ? (
              <code className="text-secondary block mt-0.5 truncate">{consultation.google_space_name}</code>
            ) : (
              <span className="text-muted text-xs mt-0.5 block">Not yet created</span>
            )}
          </div>
          <div>
            <span className="text-muted block font-medium">Review Status:</span>
            <span className={`badge ${consultation?.is_approved ? 'badge-success' : 'badge-warning'} mt-0.5`}>
              {consultation?.is_approved ? 'DOCTOR APPROVED' : 'PENDING REVIEW'}
            </span>
          </div>
        </div>
      </div>

      {/* Clinical Notice Banner */}
      <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.28)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconShield size={20} style={{ color: '#eab308', flexShrink: 0 }} />
        <span className="text-xs text-secondary" style={{ lineHeight: 1.45 }}>
          <strong>AI-generated — Doctor review required:</strong> Transcript dialogue transcribed and speaker-separated. Attending clinician verification is required before finalizing into EHR.
        </span>
      </div>

      {/* No transcript yet — informational empty state */}
      {!isTranscriptReady && (
        <div style={{ padding: '24px 16px', textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px dashed var(--color-border-subtle)' }}>
          {isTranscriptProcessing ? (
            <>
              <span className="spinner" style={{ width: 28, height: 28, display: 'block', margin: '0 auto 12px' }} />
              <p className="text-sm text-muted">Transcript is being processed by Google Meet...</p>
              <p className="text-xs text-muted mt-1">This may take a few minutes after the meeting ends.</p>
            </>
          ) : isTranscriptFailed ? (
            <>
              <IconAlert size={28} style={{ color: 'var(--color-danger)', display: 'block', margin: '0 auto 12px' }} />
              <p className="text-sm text-muted">Transcript processing failed.</p>
            </>
          ) : isTranscriptUnavailable ? (
            <>
              <IconAlert size={28} style={{ color: 'var(--color-text-muted)', display: 'block', margin: '0 auto 12px' }} />
              <p className="text-sm text-muted">Transcript is unavailable for this consultation.</p>
            </>
          ) : (
            <>
              <IconDoc size={28} style={{ color: 'var(--color-text-muted)', display: 'block', margin: '0 auto 12px' }} />
              <p className="text-sm text-muted">Waiting for transcript...</p>
              <p className="text-xs text-muted mt-1">Transcript will appear here after the Google Meet conference ends and is processed.</p>
            </>
          )}

          {/* SOAP disabled notice */}
          {onGenerateSummary === null && (
            <div className="mt-4 px-4 py-2 rounded text-xs text-muted flex items-center justify-center gap-2"
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid var(--color-border-subtle)' }}>
              <IconSparkle size={13} />
              Transcript required before clinical summary generation.
            </div>
          )}
        </div>
      )}

      {/* Transcript content — only when segments exist */}
      {isTranscriptReady && (
        <>
          {/* Search, Filter & Export Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative flex-1">
                <input type="text" className="input input-sm w-full" placeholder="Search transcript..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
                <IconSearch size={14} className="text-muted" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div className="flex items-center gap-1 bg-surface p-1 rounded border border-subtle">
              {[
                { key: 'ALL', label: `All (${segments.length})` },
                { key: 'DOCTOR', label: `Doctor (${doctorCount})` },
                { key: 'PATIENT', label: `Patient (${patientCount})` },
                { key: 'UNKNOWN', label: `Unknown (${unknownCount})` },
              ].map(({ key, label }) => (
                <button key={key} type="button" className={`btn btn-xs ${filterSpeaker === key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterSpeaker(key)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyTranscript}>Copy</button>
              <button type="button" className="btn btn-secondary btn-sm flex items-center gap-1.5" onClick={handleExportTxt}><IconDownload size={14} /> TXT</button>
              <button type="button" className="btn btn-secondary btn-sm flex items-center gap-1.5" onClick={handleExportJson}><IconDownload size={14} /> JSON</button>
              {onGenerateSummary ? (
                <button type="button" className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={onGenerateSummary} disabled={isSummarizing}>
                  <IconSparkle size={14} className={isSummarizing ? 'animate-spin' : ''} />
                  <span>{isSummarizing ? 'Extracting...' : 'Generate SOAP'}</span>
                </button>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm flex items-center gap-1.5" disabled title="Transcript required before clinical summary generation">
                  <IconSparkle size={14} />
                  <span>Generate SOAP</span>
                </button>
              )}
            </div>
          </div>

          {/* Dialogue Stream */}
          <div className="flex flex-col gap-3.5" style={{ maxHeight: 520, overflowY: 'auto', padding: '14px 8px' }}>
            {filteredSegments.length === 0 ? (
              <div className="empty-state py-8">
                <p className="text-sm text-muted">No dialogue segments matching your filter.</p>
              </div>
            ) : (
              filteredSegments.map((seg, idx) => {
                const role = getSpeakerRole(seg);
                const isDoctor = role === 'DOCTOR';
                const isPatient = role === 'PATIENT';
                const isUnknown = role === 'UNKNOWN';
                const timeFormatted = seg.start_time != null
                  ? `${Math.floor(seg.start_time / 60)}:${Math.floor(seg.start_time % 60).toString().padStart(2, '0')}`
                  : (seg.startTime || '--:--');

                return (
                  <div key={seg.id || idx} className="flex flex-col gap-1.5 animate-fade-in"
                    style={{ alignSelf: isDoctor ? 'flex-start' : isPatient ? 'flex-end' : 'center', maxWidth: '85%', minWidth: '280px' }}>
                    <div className="flex items-center gap-2 px-1" style={{ justifyContent: isDoctor ? 'flex-start' : isPatient ? 'flex-end' : 'center' }}>
                      <span className="font-bold tracking-wider flex items-center gap-1"
                        style={{ fontSize: '0.74rem', color: isDoctor ? 'var(--color-primary-400)' : isPatient ? '#38bdf8' : 'var(--color-text-muted)' }}>
                        {isDoctor && <IconStethoscope size={13} />}
                        {isPatient && <IconUser size={13} />}
                        {isUnknown && <IconAlert size={13} />}
                        {role}
                      </span>
                      <span className="text-xs text-muted font-mono flex items-center gap-1">
                        <IconClock size={10} /> {timeFormatted}
                      </span>
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: isDoctor ? '4px 16px 16px 16px' : isPatient ? '16px 4px 16px 16px' : '12px', background: isDoctor ? 'var(--color-bg-surface)' : isPatient ? 'rgba(56,189,248,0.08)' : 'var(--color-bg-base)', border: `1px solid ${isDoctor ? 'var(--color-border-subtle)' : isPatient ? 'rgba(56,189,248,0.28)' : 'var(--color-border-subtle)'}`, color: 'var(--color-text-primary)', fontSize: '0.88rem', lineHeight: 1.5, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}>
                      {seg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Review */}
          {onMarkReviewed && (
            <div className="pt-3 border-t border-subtle flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-muted">Total {segments.length} verified dialogue entries from Google Meet.</div>
              <button type="button" className="btn btn-secondary btn-sm flex items-center gap-1.5" onClick={onMarkReviewed}>
                <IconCheck size={14} /> Mark Transcript as Reviewed
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
