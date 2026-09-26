/**
 * KENKO AI — Appointments Management & Booking Page
 * Full-featured appointment scheduling, realtime Firestore synchronization,
 * Google Meet Telehealth video integration, and role-aware workflows for
 * Patients, Doctors, and Clinical Staff.
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  getAppointments,
  bookAppointment,
  cancelAppointment,
  updateAppointment,
  createAppointmentMeet,
} from '../services/api';
import {
  createAppointmentFirestore,
  listUserAppointmentsFirestore,
  listenToUserAppointmentsFirestore,
  cancelAppointmentFirestore,
  updateAppointmentFirestore,
  acceptAppointmentFirestore,
  declineAppointmentFirestore,
  getVerifiedDoctorsFirestore,
} from '../services/firestoreService';
import {
  IconCalendar,
  IconClock,
  IconVideo,
  IconUsers,
  IconStethoscope,
  IconDoc,
  IconSparkle,
  IconActivity,
  IconBadgeCheck,
  IconShield,
  IconPlus,
} from '../components/icons';

// Time slots for booking
const TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM',
];

const SPECIALIZATIONS = [
  'All Specialties', 'General Medicine', 'Cardiology', 'Neurology',
  'Orthopedics', 'Pediatrics', 'Dermatology', 'Internal Medicine',
];

const DEFAULT_DOCTORS = [
  { id: 'dr_01', doctorId: 'dr_01', fullName: 'Dr. Aarav Patel', displayName: 'Dr. Aarav Patel', specialization: 'General Medicine', medicalDegree: 'MD, MBBS' },
  { id: 'dr_02', doctorId: 'dr_02', fullName: 'Dr. Sarah Jenkins', displayName: 'Dr. Sarah Jenkins', specialization: 'Cardiology', medicalDegree: 'MD (Cardiology)' },
  { id: 'dr_03', doctorId: 'dr_03', fullName: 'Dr. Rajesh Sharma', displayName: 'Dr. Rajesh Sharma', specialization: 'Neurology', medicalDegree: 'DM (Neurology)' },
  { id: 'dr_04', doctorId: 'dr_04', fullName: 'Dr. Priya Nair', displayName: 'Dr. Priya Nair', specialization: 'Pediatrics', medicalDegree: 'MD (Pediatrics)' },
  { id: 'dr_05', doctorId: 'dr_05', fullName: 'Dr. Michael Chang', displayName: 'Dr. Michael Chang', specialization: 'Orthopedics', medicalDegree: 'MS (Ortho)' },
  { id: 'dr_06', doctorId: 'dr_06', fullName: 'Dr. Ananya Roy', displayName: 'Dr. Ananya Roy', specialization: 'Dermatology', medicalDegree: 'MD (Dermatology)' },
];

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userRole } = useAuth();
  const { success, error: toastError } = useToast();

  const isDoctor = userRole === 'doctor';
  const isAdmin = userRole === 'admin';
  const isPatient = !isDoctor && !isAdmin;

  // State
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('upcoming'); // 'all' | 'upcoming' | 'completed' | 'cancelled' | 'video' | 'in_person'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All Specialties');
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Available doctors for booking
  const [doctorsList, setDoctorsList] = useState(DEFAULT_DOCTORS);

  // Booking Form State
  const [bookForm, setBookForm] = useState({
    doctorId: DEFAULT_DOCTORS[0].id,
    doctorName: DEFAULT_DOCTORS[0].fullName,
    doctorSpecialization: DEFAULT_DOCTORS[0].specialization,
    appointmentType: 'video', // 'video' | 'in_person'
    date: new Date().toISOString().split('T')[0],
    timeSlot: '10:00 AM',
    reason: 'General Consultation',
    notes: '',
    patientName: user?.displayName || user?.name || '',
    patientAge: 32,
    patientGender: 'Male',
    patientLanguage: 'English',
  });

  // Reschedule Form State
  const [rescheduleForm, setRescheduleForm] = useState({
    date: new Date().toISOString().split('T')[0],
    timeSlot: '10:00 AM',
    reason: '',
  });

  // Pre-open booking modal if ?action=book
  useEffect(() => {
    if (searchParams.get('action') === 'book' || searchParams.get('book') === 'true') {
      setShowBookModal(true);
    }
  }, [searchParams]);

  // Load Verified Doctors
  useEffect(() => {
    async function loadDoctors() {
      try {
        const docs = await getVerifiedDoctorsFirestore();
        const merged = docs && docs.length > 0 ? docs : DEFAULT_DOCTORS;
        setDoctorsList(merged);

        const qDocId = searchParams.get('doctorId');
        const qDocName = searchParams.get('doctorName');
        const qDocSpec = searchParams.get('specialization');

        if (qDocId) {
          setBookForm(prev => ({
            ...prev,
            doctorId: qDocId,
            doctorName: qDocName || 'Dr. Specialist',
            doctorSpecialization: qDocSpec || 'General Medicine',
          }));
        } else if (merged[0]) {
          setBookForm(prev => ({
            ...prev,
            doctorId: prev.doctorId || merged[0].id || merged[0].doctorId || 'dr_01',
            doctorName: prev.doctorName || merged[0].fullName || merged[0].displayName || 'Dr. Aarav Patel',
            doctorSpecialization: prev.doctorSpecialization || merged[0].specialization || 'General Medicine',
          }));
        }
      } catch (err) {
        console.warn('Failed to load doctors list:', err);
        setDoctorsList(DEFAULT_DOCTORS);
      }
    }
    loadDoctors();
  }, [searchParams]);

  // Sync user profile into form
  useEffect(() => {
    if (user) {
      setBookForm(prev => ({
        ...prev,
        patientName: prev.patientName || user.displayName || user.name || '',
      }));
    }
  }, [user]);

  // Load Appointments (Direct pure Firebase Firestore with Realtime listener)
  useEffect(() => {
    let unsubscribe = null;
    let isMounted = true;

    async function fetchAppointments() {
      setLoading(true);
      try {
        if (user?.uid && isMounted) {
          const fsData = await listUserAppointmentsFirestore(user.uid, userRole);
          const normalized = (fsData || []).map(a => ({
            id: a.id,
            patientId: a.patientId,
            patientName: a.patientName || 'Patient',
            patientAge: a.patientAge,
            patientGender: a.patientGender,
            patientLanguage: a.patientLanguage || 'English',
            doctorId: a.doctorId,
            doctorName: a.doctorName || 'Dr. Specialist',
            doctorSpecialization: a.doctorSpecialization || 'General Medicine',
            appointmentType: (a.consultationType || a.appointmentType || 'video').toLowerCase(),
            scheduledAt: a.scheduledStart?.toDate ? a.scheduledStart.toDate().toISOString() : (a.scheduledStart || a.scheduled_at),
            reason: a.reason || 'General Consultation',
            status: (a.status || 'SCHEDULED').toUpperCase(),
            meetStatus: a.meetStatus || 'SCHEDULED',
            googleMeetingUri: a.googleMeetingUri,
            googleMeetingCode: a.googleMeetingCode,
            googleSpaceName: a.googleSpaceName,
            consultationId: a.consultationId,
          }));
          if (isMounted) setAppointments(normalized);
        }
      } catch (err) {
        console.warn('Firestore direct fetch note:', err?.message);
      } finally {
        if (isMounted) setLoading(false);
      }

      // Realtime Firestore subscription
      if (user?.uid) {
        unsubscribe = listenToUserAppointmentsFirestore(user.uid, userRole, (fsList) => {
          if (!isMounted) return;
          setIsRealtimeActive(true);
          if (Array.isArray(fsList)) {
            const normalized = fsList.map(a => ({
              id: a.id,
              patientId: a.patientId,
              patientName: a.patientName || 'Patient',
              patientAge: a.patientAge,
              patientGender: a.patientGender,
              patientLanguage: a.patientLanguage || 'English',
              doctorId: a.doctorId,
              doctorName: a.doctorName || 'Dr. Specialist',
              doctorSpecialization: a.doctorSpecialization || 'General Medicine',
              appointmentType: (a.consultationType || a.appointmentType || 'video').toLowerCase(),
              scheduledAt: a.scheduledStart?.toDate ? a.scheduledStart.toDate().toISOString() : (a.scheduledStart || a.scheduled_at),
              reason: a.reason || 'General Consultation',
              status: (a.status || 'SCHEDULED').toUpperCase(),
              meetStatus: a.meetStatus || 'SCHEDULED',
              googleMeetingUri: a.googleMeetingUri,
              googleMeetingCode: a.googleMeetingCode,
              googleSpaceName: a.googleSpaceName,
              consultationId: a.consultationId,
            })).sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));
            setAppointments(normalized);
          }
        });
      }
    }

    fetchAppointments();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, userRole]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      // Tab filter
      const st = apt.status?.toUpperCase() || 'SCHEDULED';
      if (filterTab === 'upcoming') {
        if (st === 'CANCELLED' || st === 'COMPLETED') return false;
      } else if (filterTab === 'completed') {
        if (st !== 'COMPLETED') return false;
      } else if (filterTab === 'cancelled') {
        if (st !== 'CANCELLED') return false;
      } else if (filterTab === 'video') {
        if (apt.appointmentType !== 'video') return false;
      } else if (filterTab === 'in_person') {
        if (apt.appointmentType !== 'in_person') return false;
      }

      // Specialty filter
      if (selectedSpecialty !== 'All Specialties' && apt.doctorSpecialization !== selectedSpecialty) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDoc = apt.doctorName?.toLowerCase().includes(q);
        const matchPat = apt.patientName?.toLowerCase().includes(q);
        const matchReason = apt.reason?.toLowerCase().includes(q);
        const matchSpec = apt.doctorSpecialization?.toLowerCase().includes(q);
        return matchDoc || matchPat || matchReason || matchSpec;
      }

      return true;
    });
  }, [appointments, filterTab, selectedSpecialty, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = appointments.length;
    const upcoming = appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED').length;
    const videoCount = appointments.filter(a => a.appointmentType === 'video').length;
    const completedCount = appointments.filter(a => a.status === 'COMPLETED').length;
    return { total, upcoming, videoCount, completedCount };
  }, [appointments]);

  // Handle Book Appointment
  const handleBookSubmit = async (e) => {
    e.preventDefault();
    if (!bookForm.doctorId || !bookForm.date || !bookForm.timeSlot) {
      toastError('Please complete all required fields.', 'Validation Error');
      return;
    }

    setActionLoading(true);
    try {
      const scheduledDateTime = new Date(`${bookForm.date} ${bookForm.timeSlot}`).toISOString();
      const payload = {
        doctor_id: bookForm.doctorId,
        doctor_name: bookForm.doctorName,
        doctor_specialization: bookForm.doctorSpecialization,
        patient_id: user?.uid,
        patient_name: bookForm.patientName || user?.displayName || user?.name || 'Patient',
        patient_age: Number(bookForm.patientAge) || 30,
        patient_gender: bookForm.patientGender,
        patient_language: bookForm.patientLanguage,
        appointment_type: bookForm.appointmentType,
        scheduled_at: scheduledDateTime,
        reason: bookForm.reason || 'General Consultation',
        notes: bookForm.notes,
      };

      // 1. Dual-write to backend API
      let createdApt = null;
      try {
        const res = await bookAppointment(payload);
        if (res?.appointment) {
          createdApt = res.appointment;
        }
      } catch (backendErr) {
        console.warn('Backend booking API error, writing to Firestore:', backendErr);
      }

      // 2. Dual-write to Firebase Firestore
      const firestoreApt = await createAppointmentFirestore(user?.uid || 'patient_demo', {
        ...payload,
        id: createdApt?.id,
        scheduledStart: scheduledDateTime,
      });

      // Immediate local state update to ensure UI displays booking immediately
      if (firestoreApt) {
        setAppointments(prev => {
          const filtered = prev.filter(a => a.id !== firestoreApt.id);
          const newItem = {
            id: firestoreApt.id,
            patientId: firestoreApt.patientId,
            patientName: firestoreApt.patientName,
            patientAge: firestoreApt.patientAge,
            patientGender: firestoreApt.patientGender,
            patientLanguage: firestoreApt.patientLanguage,
            doctorId: firestoreApt.doctorId,
            doctorName: firestoreApt.doctorName,
            doctorSpecialization: firestoreApt.doctorSpecialization,
            appointmentType: firestoreApt.consultationType,
            scheduledAt: firestoreApt.scheduledStart,
            reason: firestoreApt.reason,
            status: firestoreApt.status || 'SCHEDULED',
            meetStatus: firestoreApt.meetStatus || 'SCHEDULED',
            googleMeetingUri: firestoreApt.googleMeetingUri || '',
            googleMeetingCode: firestoreApt.googleMeetingCode || '',
            googleSpaceName: firestoreApt.googleSpaceName || '',
            consultationId: firestoreApt.consultationId || null,
          };
          return [newItem, ...filtered];
        });
      }

      success('Your appointment has been successfully scheduled and synced with Firebase!', 'Appointment Confirmed');
      setShowBookModal(false);

      // Refresh list from backend if available
      try {
        const res = await getAppointments();
        if (res?.appointments && res.appointments.length > 0) {
          const formatted = res.appointments.map(item => {
            const apt = item.appointment || item;
            return {
              id: apt.id,
              patientId: apt.patientId || apt.patient_id,
              patientName: item.patient?.displayName || apt.patient_name || 'Patient',
              doctorId: apt.doctorId || apt.doctor_id,
              doctorName: item.doctor?.displayName || apt.doctor_name || 'Dr. Specialist',
              doctorSpecialization: item.doctor?.specialization || apt.doctor_specialization || 'General Medicine',
              appointmentType: (apt.consultationType || apt.appointment_type || 'video').toLowerCase(),
              scheduledAt: apt.scheduledStart || apt.scheduled_at,
              reason: apt.reason || 'General Consultation',
              status: (apt.status || 'SCHEDULED').toUpperCase(),
              meetStatus: item.googleMeet?.status || apt.meet_status || 'SCHEDULED',
              googleMeetingUri: item.googleMeet?.meetingUri || apt.google_meeting_uri,
              googleMeetingCode: item.googleMeet?.meetingCode || apt.google_meeting_code,
              googleSpaceName: item.googleMeet?.spaceName || apt.google_space_name,
              consultationId: apt.consultationId || apt.consultation_id,
            };
          });
          setAppointments(formatted);
        }
      } catch {
        // Fallback to firestore list
        const fsData = await listUserAppointmentsFirestore(user?.uid, userRole);
        if (fsData && fsData.length > 0) {
          setAppointments(fsData.map(a => ({
            id: a.id,
            patientId: a.patientId,
            patientName: a.patientName || 'Patient',
            doctorId: a.doctorId,
            doctorName: a.doctorName || 'Dr. Specialist',
            doctorSpecialization: a.doctorSpecialization || 'General Medicine',
            appointmentType: (a.consultationType || 'video').toLowerCase(),
            scheduledAt: a.scheduledStart?.toDate ? a.scheduledStart.toDate().toISOString() : a.scheduledStart,
            reason: a.reason || 'General Consultation',
            status: (a.status || 'SCHEDULED').toUpperCase(),
            meetStatus: a.meetStatus || 'SCHEDULED',
            googleMeetingUri: a.googleMeetingUri,
            googleMeetingCode: a.googleMeetingCode,
            googleSpaceName: a.googleSpaceName,
            consultationId: a.consultationId,
          })));
        }
      }
    } catch (err) {
      toastError(err?.response?.data?.detail || err?.message || 'Failed to book appointment.', 'Booking Failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Appointment
  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

    setActionLoading(true);
    try {
      await cancelAppointment(appointmentId, 'Cancelled by user').catch(() => null);
      await cancelAppointmentFirestore(appointmentId, 'Cancelled by user').catch(() => null);

      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, status: 'CANCELLED', meetStatus: 'CANCELLED' } : a)
      );
      success('Appointment cancelled successfully.', 'Cancelled');
      if (selectedAppointment?.id === appointmentId) {
        setSelectedAppointment(null);
      }
    } catch (err) {
      toastError(err?.message || 'Failed to cancel appointment.', 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reschedule Appointment
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    setActionLoading(true);
    try {
      const newScheduledDateTime = new Date(`${rescheduleForm.date} ${rescheduleForm.timeSlot}`).toISOString();
      const updates = {
        scheduled_at: newScheduledDateTime,
        scheduledStart: newScheduledDateTime,
        reason: rescheduleForm.reason || selectedAppointment.reason,
        status: 'SCHEDULED',
      };

      await updateAppointment(selectedAppointment.id, updates).catch(() => null);
      await updateAppointmentFirestore(selectedAppointment.id, updates).catch(() => null);

      setAppointments(prev =>
        prev.map(a => a.id === selectedAppointment.id ? { ...a, scheduledAt: newScheduledDateTime, status: 'SCHEDULED' } : a)
      );
      success('Appointment rescheduled successfully!', 'Rescheduled');
      setShowRescheduleModal(false);
      setSelectedAppointment(null);
    } catch (err) {
      toastError(err?.message || 'Failed to reschedule appointment.', 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Accept Appointment (Doctor only)
  const handleAcceptAppointment = async (appointmentId) => {
    setActionLoading(true);
    try {
      const res = await acceptAppointmentFirestore(appointmentId);
      success('Appointment accepted! Google Meet link generated and synced to patient.', 'Appointment Confirmed');
      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? {
          ...a,
          status: 'CONFIRMED',
          meetStatus: 'READY',
          googleMeetingUri: res.googleMeetingUri,
          googleMeetingCode: res.googleMeetingCode,
        } : a)
      );
    } catch (err) {
      toastError(err?.message || 'Failed to accept appointment.', 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Decline Appointment (Doctor only)
  const handleDeclineAppointment = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to decline this appointment request?')) return;
    setActionLoading(true);
    try {
      await declineAppointmentFirestore(appointmentId, 'Declined by doctor');
      success('Appointment declined.', 'Status Updated');
      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, status: 'DECLINED', meetStatus: 'CANCELLED' } : a)
      );
    } catch (err) {
      toastError(err?.message || 'Failed to decline appointment.', 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  // Launch Google Meet / Video Consultation Room
  const handleJoinVideoConsultation = async (apt, forceGoogleMeet = false) => {
    if (apt.appointmentType !== 'video') return;

    if (forceGoogleMeet) {
      const meetUrl = apt.googleMeetingUri && !apt.googleMeetingUri.includes('kenko-') 
        ? apt.googleMeetingUri 
        : 'https://meet.google.com/new';
      window.open(meetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Direct navigation to Telehealth video consultation workspace
    navigate(`/consultations/video?appointmentId=${apt.id}`);
  };

  return (
    <div className="page-container max-w-7xl mx-auto px-4 md:px-6" style={{ paddingTop: '24px', paddingBottom: '48px' }}>
      {/* ─── Header & KPI Summary ─── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6" style={{ marginTop: '8px' }}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--color-text-primary, #1e293b)' }}>
              Appointments & Care Schedule
            </h1>
            {isRealtimeActive && (
              <span className="badge badge-success flex items-center gap-1.5 py-1 px-2.5 text-xs font-semibold" style={{ borderRadius: '12px' }}>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Realtime Sync
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-1" style={{ color: 'var(--color-text-secondary, #64748b)' }}>
            Schedule, manage, and attend high-definition Telehealth Google Meet consultations and in-person clinic visits.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            id="book-appointment-btn"
            onClick={() => setShowBookModal(true)}
            className="btn btn-primary flex items-center gap-2 w-full md:w-auto justify-center shadow-lg transition-all"
            style={{ padding: '10px 20px', borderRadius: '12px', fontWeight: 700 }}
          >
            <IconPlus size={18} />
            <span>Book New Appointment</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Stats Bar ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card-flat p-4 border border-border/50 relative overflow-hidden" style={{ borderRadius: '16px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Total Appointments</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <IconCalendar size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{metrics.total}</div>
          <span className="text-[11px] text-muted">All scheduled & past sessions</span>
        </div>

        <div className="glass-card-flat p-4 border border-border/50 relative overflow-hidden" style={{ borderRadius: '16px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Upcoming</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <IconClock size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-400">{metrics.upcoming}</div>
          <span className="text-[11px] text-muted">Active clinical bookings</span>
        </div>

        <div className="glass-card-flat p-4 border border-border/50 relative overflow-hidden" style={{ borderRadius: '16px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Telehealth Video</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <IconVideo size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-blue-400">{metrics.videoCount}</div>
          <span className="text-[11px] text-muted">Google Meet Telehealth consultations</span>
        </div>

        <div className="glass-card-flat p-4 border border-border/50 relative overflow-hidden" style={{ borderRadius: '16px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Completed</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <IconBadgeCheck size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-purple-400">{metrics.completedCount}</div>
          <span className="text-[11px] text-muted">Finished care sessions</span>
        </div>
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div className="glass-card-flat p-4 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4" style={{ borderRadius: '16px' }}>
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0" style={{ scrollbarWidth: 'none' }}>
          {[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'all', label: 'All' },
            { id: 'video', label: 'Telehealth Video' },
            { id: 'in_person', label: 'In-Person' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map(tab => {
            const isActive = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  whiteSpace: 'nowrap',
                  backgroundColor: isActive ? 'var(--color-primary, #3b82f6)' : 'var(--color-bg-subtle, #e2e8f0)',
                  color: isActive ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                  border: isActive ? '1px solid var(--color-primary, #3b82f6)' : '1px solid transparent',
                  boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.35)' : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Specialization filter */}
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
          <select
            value={selectedSpecialty}
            onChange={e => setSelectedSpecialty(e.target.value)}
            className="input"
            style={{ fontSize: '12px', height: '36px', minWidth: '150px', borderRadius: '10px' }}
          >
            {SPECIALIZATIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search doctor, patient, reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input"
            style={{ fontSize: '12px', height: '36px', minWidth: '220px', borderRadius: '10px' }}
          />
        </div>
      </div>

      {/* ─── Appointments List / Grid ─── */}
      {loading ? (
        <div className="glass-card-flat p-12 text-center">
          <div className="spinner mx-auto mb-3" style={{ width: 32, height: 32 }} />
          <p className="text-sm text-muted">Loading appointments schedule…</p>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="glass-card-flat p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-4 text-muted">
            <IconCalendar size={32} />
          </div>
          <h3 className="text-base font-bold">No appointments found</h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-5">
            {filterTab === 'upcoming'
              ? "You don't have any upcoming appointments scheduled at this moment."
              : `No appointments match the selected filter (${filterTab}).`}
          </p>
          <button
            onClick={() => setShowBookModal(true)}
            className="btn btn-primary text-xs py-2 px-4 inline-flex items-center gap-2"
          >
            <IconPlus size={15} /> Book Appointment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAppointments.map(apt => {
            const isVideo = apt.appointmentType === 'video';
            const isCancelled = apt.status === 'CANCELLED';
            const isCompleted = apt.status === 'COMPLETED';
            const dateFormatted = apt.scheduledAt
              ? new Date(apt.scheduledAt).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Date not specified';
            const timeFormatted = apt.scheduledAt
              ? new Date(apt.scheduledAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Time not specified';

            return (
              <div
                key={apt.id}
                className={`glass-card p-5 flex flex-col justify-between transition-all hover:border-primary/40 ${
                  isCancelled ? 'opacity-60 border-red-500/20' : isCompleted ? 'border-purple-500/20' : 'border-border'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`badge text-[11px] font-semibold flex items-center gap-1.5 py-0.5 px-2.5 ${
                        isVideo ? 'badge-primary' : 'badge-secondary'
                      }`}
                    >
                      {isVideo ? <IconVideo size={13} /> : <IconActivity size={13} />}
                      {isVideo ? 'Google Meet Telehealth' : 'In-Person Clinic Visit'}
                    </span>

                    <span
                      className={`badge text-[10px] font-bold uppercase tracking-wider py-0.5 px-2 ${
                        isCancelled
                          ? 'badge-error'
                          : isCompleted
                          ? 'badge-purple'
                          : 'badge-success'
                      }`}
                    >
                      {apt.status}
                    </span>
                  </div>

                  {/* Doctor & Patient Info */}
                  <div className="flex items-start gap-3 my-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 text-primary font-bold text-lg border border-primary/20">
                      {isPatient ? apt.doctorName?.charAt(0) || 'D' : apt.patientName?.charAt(0) || 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold truncate">
                        {isPatient ? apt.doctorName : apt.patientName}
                      </h4>
                      <p className="text-xs text-muted truncate">
                        {isPatient ? apt.doctorSpecialization : `Patient • ${apt.patientAge ? `${apt.patientAge} yrs` : ''} ${apt.patientGender || ''}`}
                      </p>
                      <div className="text-[11px] text-muted/80 mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                        <span className="font-medium text-foreground/80">{apt.reason}</span>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Box */}
                  <div className="p-3 rounded-lg bg-surface-alt/70 border border-border/40 my-3 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <IconCalendar size={15} className="text-primary" />
                      <span>{dateFormatted}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted font-medium">
                      <IconClock size={14} />
                      <span>{timeFormatted}</span>
                    </div>
                  </div>

                  {/* Google Meet Meta (if available) */}
                  {isVideo && apt.googleMeetingUri && (
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center justify-between mb-3">
                      <span className="flex items-center gap-1.5 truncate">
                        <IconSparkle size={13} className="text-blue-400 shrink-0" />
                        <span className="truncate">Google Meet Space Ready</span>
                      </span>
                      {apt.googleMeetingCode && (
                        <span className="font-mono text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-200">
                          {apt.googleMeetingCode}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 mt-2">
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedAppointment(apt)}
                      className="btn btn-secondary text-xs py-1.5 px-3"
                    >
                      Details
                    </button>

                    {isDoctor && (apt.status === 'SCHEDULED' || apt.status === 'PENDING' || apt.status === 'REQUESTED') && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAcceptAppointment(apt.id)}
                          className="btn btn-success text-xs py-1.5 px-2.5 font-bold flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                          title="Accept and create Google Meet link"
                        >
                          <IconBadgeCheck size={13} /> Accept
                        </button>
                        <button
                          onClick={() => handleDeclineAppointment(apt.id)}
                          className="btn btn-ghost text-xs py-1.5 px-2 text-rose-400 hover:bg-rose-500/10 border border-rose-500/30"
                          title="Decline appointment"
                        >
                          ✕ Decline
                        </button>
                      </div>
                    )}

                    {!isCancelled && !isCompleted && !isDoctor && (
                      <button
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setRescheduleForm({
                            date: apt.scheduledAt ? new Date(apt.scheduledAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                            timeSlot: '10:00 AM',
                            reason: apt.reason || '',
                          });
                          setShowRescheduleModal(true);
                        }}
                        className="btn btn-secondary text-xs py-1.5 px-2.5 text-muted hover:text-foreground"
                      >
                        Reschedule
                      </button>
                    )}
                  </div>

                  {/* Primary CTA */}
                  {!isCancelled && !isCompleted && isVideo ? (
                    <button
                      onClick={() => handleJoinVideoConsultation(apt)}
                      className="btn btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-sm shadow-primary/20"
                    >
                      <IconVideo size={14} />
                      <span>{apt.googleMeetingUri ? '📹 Join Google Meet' : isDoctor ? 'Start Meet' : 'Join Video'}</span>
                    </button>
                  ) : !isCancelled && !isCompleted && !isVideo ? (
                    <button
                      onClick={() => navigate(`/consultations/in-person?appointmentId=${apt.id}`)}
                      className="btn btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5"
                    >
                      <IconActivity size={14} />
                      <span>Clinic Visit</span>
                    </button>
                  ) : isCompleted && apt.consultationId ? (
                    <button
                      onClick={() => navigate(`/consultations/${apt.consultationId}`)}
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-purple-300"
                    >
                      <IconDoc size={13} />
                      <span>View Record</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL 1: Book New Appointment ─── */}
      {showBookModal && (
        <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card-flat max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto border border-border shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <IconCalendar size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold">Book Clinical Appointment</h3>
                  <p className="text-xs text-muted">Schedule a Telehealth or in-person consultation</p>
                </div>
              </div>
              <button
                onClick={() => setShowBookModal(false)}
                className="text-muted hover:text-foreground text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="space-y-4 text-xs">
              {/* Consultation Type Selector */}
              <div>
                <label className="label">Consultation Mode <span className="text-error">*</span></label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setBookForm(f => ({ ...f, appointmentType: 'video' }))}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      bookForm.appointmentType === 'video'
                        ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                        : 'border-border bg-surface-alt/50 text-muted hover:border-border-alt'
                    }`}
                  >
                    <IconVideo size={18} className={bookForm.appointmentType === 'video' ? 'text-primary' : 'text-muted'} />
                    <div>
                      <div className="font-bold text-xs">Google Meet Telehealth</div>
                      <div className="text-[10px] text-muted mt-0.5">High-definition clinical video with live transcript</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookForm(f => ({ ...f, appointmentType: 'in_person' }))}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      bookForm.appointmentType === 'in_person'
                        ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                        : 'border-border bg-surface-alt/50 text-muted hover:border-border-alt'
                    }`}
                  >
                    <IconActivity size={18} className={bookForm.appointmentType === 'in_person' ? 'text-primary' : 'text-muted'} />
                    <div>
                      <div className="font-bold text-xs">In-Person Clinic Visit</div>
                      <div className="text-[10px] text-muted mt-0.5">Physical hospital examination & ambient audio</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Doctor Selection */}
              <div>
                <label className="label">Select Doctor & Specialty <span className="text-error">*</span></label>
                <select
                  className="input text-xs"
                  value={bookForm.doctorId}
                  onChange={e => {
                    const docId = e.target.value;
                    const doc = doctorsList.find(d => (d.id || d.doctorId) === docId);
                    setBookForm(f => ({
                      ...f,
                      doctorId: docId,
                      doctorName: doc?.fullName || doc?.displayName || 'Dr. Specialist',
                      doctorSpecialization: doc?.specialization || 'General Medicine',
                    }));
                  }}
                >
                  {doctorsList.map(d => (
                    <option key={d.id || d.doctorId} value={d.id || d.doctorId}>
                      {d.fullName || d.displayName || 'Dr. Specialist'} — {d.specialization || 'General Medicine'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time Slot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Appointment Date <span className="text-error">*</span></label>
                  <input
                    type="date"
                    className="input text-xs"
                    value={bookForm.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setBookForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Select Time Slot <span className="text-error">*</span></label>
                  <select
                    className="input text-xs"
                    value={bookForm.timeSlot}
                    onChange={e => setBookForm(f => ({ ...f, timeSlot: e.target.value }))}
                  >
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reason / Chief Complaint */}
              <div>
                <label className="label">Reason for Consultation <span className="text-error">*</span></label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. Routine Check-up, Hypertension Review, Fever & Cough"
                  value={bookForm.reason}
                  onChange={e => setBookForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>

              {/* Symptoms / Clinical Notes */}
              <div>
                <label className="label">Symptoms & Background Notes (Optional)</label>
                <textarea
                  rows={3}
                  className="input text-xs"
                  placeholder="Briefly describe your symptoms, medication history, or notes for the doctor..."
                  value={bookForm.notes}
                  onChange={e => setBookForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Patient info preview */}
              <div className="p-3 rounded-xl bg-surface-alt/70 border border-border/50 text-[11px] text-muted space-y-1">
                <div className="flex justify-between">
                  <span>Patient:</span>
                  <span className="font-semibold text-foreground">{bookForm.patientName || 'Patient'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Doctor:</span>
                  <span className="font-semibold text-foreground">{bookForm.doctorName} ({bookForm.doctorSpecialization})</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="btn btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary text-xs py-2 px-5 flex items-center gap-2"
                >
                  {actionLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <IconBadgeCheck size={16} />}
                  <span>{actionLoading ? 'Scheduling...' : 'Confirm Appointment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Appointment Details & Actions ─── */}
      {selectedAppointment && !showRescheduleModal && (
        <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card-flat max-w-lg w-full p-6 border border-border shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <IconCalendar size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold">Appointment Details</h3>
                  <span className="text-[11px] text-muted font-mono">ID: {selectedAppointment.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="text-muted hover:text-foreground text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-alt/60 border border-border/40">
                <div>
                  <span className="text-muted text-[11px]">Doctor</span>
                  <p className="font-bold text-sm text-foreground mt-0.5">{selectedAppointment.doctorName}</p>
                  <p className="text-[11px] text-primary">{selectedAppointment.doctorSpecialization}</p>
                </div>
                <div>
                  <span className="text-muted text-[11px]">Patient</span>
                  <p className="font-bold text-sm text-foreground mt-0.5">{selectedAppointment.patientName}</p>
                  <p className="text-[11px] text-muted">
                    {selectedAppointment.patientAge ? `${selectedAppointment.patientAge} yrs • ` : ''}{selectedAppointment.patientGender || ''}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted">Consultation Type:</span>
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  {selectedAppointment.appointmentType === 'video' ? 'Google Meet Video' : 'In-Person Clinic Visit'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted">Scheduled Date & Time:</span>
                <span className="font-bold">
                  {selectedAppointment.scheduledAt ? new Date(selectedAppointment.scheduledAt).toLocaleString() : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted">Status:</span>
                <span className="badge badge-success font-bold text-[10px]">{selectedAppointment.status}</span>
              </div>

              <div className="py-2 border-b border-border/40">
                <span className="text-muted">Reason / Chief Complaint:</span>
                <p className="font-medium text-foreground mt-1">{selectedAppointment.reason}</p>
              </div>

              {selectedAppointment.appointmentType === 'video' && selectedAppointment.googleMeetingUri && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-blue-300">Google Meet Space</span>
                    <span className="text-[10px] text-blue-400 font-mono">{selectedAppointment.googleMeetingCode}</span>
                  </div>
                  <a
                    href={selectedAppointment.googleMeetingUri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline text-[11px] truncate block"
                  >
                    {selectedAppointment.googleMeetingUri}
                  </a>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-border">
              {selectedAppointment.status !== 'CANCELLED' && selectedAppointment.status !== 'COMPLETED' && (
                <button
                  onClick={() => handleCancelAppointment(selectedAppointment.id)}
                  disabled={actionLoading}
                  className="btn btn-secondary text-xs text-error hover:bg-error/10 py-2 px-3"
                >
                  Cancel Appointment
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {selectedAppointment.appointmentType === 'video' && selectedAppointment.status !== 'CANCELLED' && (
                  <button
                    onClick={() => {
                      setSelectedAppointment(null);
                      handleJoinVideoConsultation(selectedAppointment);
                    }}
                    className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    <IconVideo size={14} />
                    <span>Join Google Meet</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="btn btn-secondary text-xs py-2 px-4"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Reschedule Appointment ─── */}
      {showRescheduleModal && selectedAppointment && (
        <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card-flat max-w-md w-full p-6 border border-border shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
              <h3 className="text-base font-bold">Reschedule Appointment</h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="text-muted hover:text-foreground text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="label">New Date <span className="text-error">*</span></label>
                <input
                  type="date"
                  className="input text-xs"
                  value={rescheduleForm.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setRescheduleForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">New Time Slot <span className="text-error">*</span></label>
                <select
                  className="input text-xs"
                  value={rescheduleForm.timeSlot}
                  onChange={e => setRescheduleForm(f => ({ ...f, timeSlot: e.target.value }))}
                >
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Reason for Rescheduling</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. Patient request, doctor availability"
                  value={rescheduleForm.reason}
                  onChange={e => setRescheduleForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="btn btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary text-xs py-2 px-4"
                >
                  {actionLoading ? 'Updating...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
