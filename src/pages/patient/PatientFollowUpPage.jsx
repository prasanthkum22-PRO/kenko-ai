/**
 * Patient Follow-Up & Condition Check-In Page
 * Route: /patient/follow-up
 * Features: Condition Check-In (Recovering | Same | Worsening), Daily Medication Tasks, Test Trackers
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getPatientFollowUpOverview,
  submitPatientCheckIn,
  updateMedicationTaskStatus,
  completeInvestigation,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  IconClock, IconCheck, IconPill, IconActivity,
  IconShield, IconHeart, IconSparkle, IconDoc
} from '../../components/icons';

export default function PatientFollowUpPage() {
  const { success, error: toastError, info } = useToast();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkinNotes, setCheckinNotes] = useState('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
  const [checkinDoneMessage, setCheckinDoneMessage] = useState('');

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPatientFollowUpOverview();
      setOverview(data);
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to load follow-up overview.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleCheckIn = async (conditionStatus) => {
    if (!overview?.active_plan?.id) {
      toastError('No active follow-up plan found.');
      return;
    }
    try {
      setIsSubmittingCheckin(true);
      const res = await submitPatientCheckIn({
        follow_up_plan_id: overview.active_plan.id,
        condition_status: conditionStatus,
        notes: checkinNotes,
      });
      setCheckinDoneMessage(res.message);
      success('Your condition check-in has been sent to your care team.');
      setCheckinNotes('');
      fetchOverview();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to submit check-in.');
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  const handleMedTask = async (taskId, status) => {
    try {
      await updateMedicationTaskStatus(taskId, status);
      success(`Medication marked as ${status.toLowerCase()}.`);
      fetchOverview();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to update task.');
    }
  };

  const handleCompleteTest = async (testId) => {
    try {
      await completeInvestigation(testId);
      success('Test marked as completed. Your doctor has been notified.');
      fetchOverview();
    } catch (err) {
      toastError(err.response?.data?.detail || 'Failed to update test status.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="spinner mr-3" />
        <span>Loading your follow-up care hub...</span>
      </div>
    );
  }

  const activePlan = overview?.active_plan;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card p-6 flex flex-wrap items-center justify-between gap-4 border-l-4 border-primary">
        <div>
          <span className="badge badge-primary text-xs font-semibold mb-1">Patient Care Intelligence</span>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <IconHeart className="text-primary" size={24} /> My Follow-Up & Recovery
          </h1>
          <p className="text-xs text-muted mt-1">
            Track daily medications, submit condition check-ins, and stay connected with your care team.
          </p>
        </div>
      </div>

      {/* Hero Condition Check-In Widget */}
      {activePlan ? (
        <div className="glass-card p-6 border border-primary/30 bg-gradient-to-b from-primary/10 to-transparent space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Scheduled Check-In</span>
              <h2 className="text-xl font-bold text-white mt-1">How is your condition today?</h2>
              <p className="text-xs text-muted mt-0.5">
                Target follow-up: <strong className="text-white">{activePlan.due_date}</strong>
              </p>
            </div>
            <span className="badge badge-warning text-xs font-semibold">Active Care Plan</span>
          </div>

          <p className="text-xs text-muted italic bg-surface/40 p-2.5 rounded-lg border border-border/30">
            Doctor's Instruction: "{activePlan.instruction}"
          </p>

          {checkinDoneMessage ? (
            <div className="p-4 rounded-lg bg-success/15 border border-success/30 text-success text-sm font-semibold flex items-center gap-2">
              <IconCheck size={18} /> {checkinDoneMessage}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  disabled={isSubmittingCheckin}
                  onClick={() => handleCheckIn('RECOVERING')}
                  className="btn btn-outline hover:bg-success hover:border-success hover:text-white py-4 text-sm font-bold flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🟢</span>
                  <span>Recovering</span>
                  <span className="text-[10px] font-normal opacity-80">Feeling improved</span>
                </button>

                <button
                  disabled={isSubmittingCheckin}
                  onClick={() => handleCheckIn('SAME')}
                  className="btn btn-outline hover:bg-warning hover:border-warning hover:text-black py-4 text-sm font-bold flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🟡</span>
                  <span>Same</span>
                  <span className="text-[10px] font-normal opacity-80">No significant change</span>
                </button>

                <button
                  disabled={isSubmittingCheckin}
                  onClick={() => handleCheckIn('WORSENING')}
                  className="btn btn-outline hover:bg-error hover:border-error hover:text-white py-4 text-sm font-bold flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🔴</span>
                  <span>Worsening</span>
                  <span className="text-[10px] font-normal opacity-80">Symptoms increased</span>
                </button>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Add any additional symptom details or notes for your doctor (optional)..."
                  value={checkinNotes}
                  onChange={(e) => setCheckinNotes(e.target.value)}
                  className="input input-sm w-full"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card p-6 text-center text-muted text-sm">
          No active follow-up plans at this time. You're up to date!
        </div>
      )}

      {/* Today's Medication Tasks */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2 border-b border-border/40 pb-3">
          <IconPill size={20} className="text-primary" /> Today's Prescribed Medications
        </h3>

        {overview?.medication_tasks?.length === 0 ? (
          <p className="text-muted text-sm py-4 text-center">No medication tasks scheduled for today.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {overview?.medication_tasks?.map((task) => (
              <div
                key={task.id}
                className={`p-4 rounded-lg border transition-all flex items-center justify-between ${
                  task.status === 'TAKEN'
                    ? 'bg-success/10 border-success/30'
                    : task.status === 'SKIPPED'
                    ? 'bg-muted/10 border-border/40 opacity-60'
                    : 'bg-surface/50 border-border/50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm">{task.medicine_name}</h4>
                    <span className="badge badge-sm badge-ghost">{task.dosage}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Slot: <strong className="text-primary">{task.schedule_slot}</strong> ({task.due_time})
                  </p>
                  {task.instructions && <p className="text-[11px] text-muted italic mt-1">{task.instructions}</p>}
                </div>

                <div className="flex items-center gap-1">
                  {task.status === 'TAKEN' ? (
                    <span className="badge badge-success text-xs font-bold">✓ Taken</span>
                  ) : task.status === 'SKIPPED' ? (
                    <span className="badge badge-ghost text-xs">Skipped</span>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleMedTask(task.id, 'TAKEN')}
                        className="btn btn-success btn-xs font-bold"
                      >
                        ✓ Take
                      </button>
                      <button
                        onClick={() => handleMedTask(task.id, 'SKIPPED')}
                        className="btn btn-ghost btn-xs text-muted"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* General Tasks & Recommended Tests */}
      {overview?.general_tasks?.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-bold text-base flex items-center gap-2 border-b border-border/40 pb-3">
            <IconActivity size={18} className="text-info" /> Care Tasks & Recommended Tests
          </h3>

          <div className="space-y-2">
            {overview.general_tasks.map((gt) => (
              <div key={gt.id} className="p-3 rounded-lg bg-surface/50 border border-border/40 flex items-center justify-between">
                <div>
                  <span className="badge badge-info text-xs font-bold mr-2">{gt.task_type}</span>
                  <strong className="text-white text-sm">{gt.title}</strong>
                  {gt.description && <p className="text-xs text-muted mt-1">{gt.description}</p>}
                </div>
                {gt.due_date && <span className="text-xs text-muted font-mono">{gt.due_date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
