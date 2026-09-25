/**
 * Doctor Follow-Up Detail & Care Timeline Page
 * Route: /doctor/follow-up/:id
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDoctorFollowUpDetail, doctorReviewFollowUp } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconClock, IconCheck, IconAlert, IconActivity,
  IconRx, IconDoc, IconUsers, IconArrowLeft, IconShield
} from '../../components/icons';

export default function DoctorFollowUpDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [nextAction, setNextAction] = useState('Maintain Current Plan');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDoctorFollowUpDetail(id);
      setDetail(data);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to load follow-up detail.');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewNotes.trim()) {
      toastError('Please enter clinical review commentary.');
      return;
    }
    try {
      setIsSubmitting(true);
      await doctorReviewFollowUp(id, { review_notes: reviewNotes, next_action: nextAction });
      success('Follow-up review submitted successfully.');
      setReviewNotes('');
      fetchDetail();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="spinner mr-3" />
        <span>Loading follow-up detail & clinical timeline...</span>
      </div>
    );
  }

  const plan = detail?.plan;
  const patient = detail?.patient;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <button onClick={() => navigate('/doctor/follow-up')} className="btn btn-ghost btn-sm gap-2">
        <IconArrowLeft size={16} /> Back to Follow-Up Dashboard
      </button>

      {/* Header Info */}
      <div className="glass-card p-6 flex flex-wrap items-center justify-between gap-4 border-l-4 border-primary">
        <div>
          <span className="badge badge-primary text-xs font-semibold mb-1">Patient Follow-Up Detail</span>
          <h1 className="text-2xl font-black text-white">{patient?.name}</h1>
          <p className="text-xs text-muted mt-1">
            Patient ID: {patient?.id} • Age: {patient?.age || '—'} yrs • Gender: {patient?.gender || '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Target Follow-Up Date</p>
          <p className="text-lg font-bold text-warning">{plan?.due_date}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Timeline & Detail */}
        <div className="md:col-span-2 space-y-6">
          {/* Care Progression Timeline */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2 border-b border-border/40 pb-3">
              <IconActivity size={18} className="text-primary" /> Care Continuity Timeline
            </h3>

            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
              {detail?.timeline?.map((step, idx) => (
                <div key={idx} className="relative space-y-1">
                  <span
                    className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-background ${
                      step.status === 'HIGH_PRIORITY_DOCTOR_REVIEW'
                        ? 'bg-error animate-pulse'
                        : step.status === 'EARLIER_REVIEW_RECOMMENDED'
                        ? 'bg-warning'
                        : 'bg-primary'
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">{step.title}</h4>
                    <span className="text-xs text-muted font-mono">{step.date}</span>
                  </div>
                  {step.notes && <p className="text-xs text-muted bg-surface/40 p-2 rounded">{step.notes}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Prescribed Treatment Summary */}
          {detail?.prescription?.items?.length > 0 && (
            <div className="glass-card p-6 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <IconRx size={16} className="text-primary" /> Active Prescription
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {detail.prescription.items.map((it, i) => (
                  <div key={i} className="p-2.5 rounded bg-surface/50 border border-border/30 text-xs">
                    <p className="font-bold text-white">{it.medicine_name} {it.dosage}</p>
                    <p className="text-muted">{it.frequency} • {it.duration}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Doctor Review Form */}
        <div className="space-y-6">
          <form onSubmit={handleSubmitReview} className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-base border-b border-border/40 pb-2">Doctor Clinical Review</h3>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Clinical Evaluation Notes</label>
              <textarea
                rows={4}
                required
                placeholder="Document patient progress, symptom evolution, and therapy adjustments..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="textarea textarea-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Next Action</label>
              <select
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                className="select select-sm w-full"
              >
                <option value="Maintain Current Plan">Maintain Current Plan</option>
                <option value="Schedule In-Person Consultation">Schedule In-Person Consultation</option>
                <option value="Adjust Medication Dosage">Adjust Medication Dosage</option>
                <option value="Request Diagnostic Tests">Request Diagnostic Tests</option>
                <option value="Discharge & Resolution">Discharge & Resolution</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full shadow-lg"
            >
              {isSubmitting ? 'Submitting...' : '✓ Submit Clinical Review'}
            </button>
          </form>

          <div className="p-4 rounded-lg bg-surface/40 border border-border/40 space-y-2 text-xs">
            <p className="font-bold text-muted">Original Consultation Instruction:</p>
            <p className="text-white italic">"{plan?.instruction}"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
