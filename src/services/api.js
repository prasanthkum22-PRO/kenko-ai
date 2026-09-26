import axios from 'axios';

// ─── Axios Instance ──────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000,
});

// ─── Request Interceptor — Attach JWT Bearer Token ──────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('medibridge_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Auth API ─────────────────────────────────────────────────

export const registerUser = async (userData) => {
  const res = await api.post('/api/auth/register', userData);
  if (res.data?.access_token) {
    localStorage.setItem('medibridge_token', res.data.access_token);
  }
  return res.data;
};

export const loginUser = async (credentials) => {
  const res = await api.post('/api/auth/login', credentials);
  if (res.data?.access_token) {
    localStorage.setItem('medibridge_token', res.data.access_token);
  }
  return res.data;
};

export const getCurrentUserProfile = async () => {
  const res = await api.get('/api/auth/me');
  return res.data;
};

// ─── Consultations API ────────────────────────────────────────

export const createConsultation = async (consultationData) => {
  const res = await api.post('/api/consultations', consultationData);
  return res.data;
};

export const getConsultations = async (status, patientId) => {
  const params = {};
  if (status) params.status = status;
  if (patientId) params.patient_id = patientId;
  const res = await api.get('/api/consultations', { params });
  return res.data;
};

export const getConsultation = async (id) => {
  const res = await api.get(`/api/consultations/${id}`);
  return res.data?.consultation || res.data;
};

export const getConsultationFull = async (id) => {
  const res = await api.get(`/api/consultations/${id}`);
  return res.data;
};

// ─── Appointments API ─────────────────────────────────────────

export const getAppointment = async (appointmentId) => {
  const res = await api.get(`/api/appointments/${appointmentId}`);
  return res.data?.appointment || res.data;
};

/**
 * getAppointmentFull — returns the complete appointment response including:
 * { appointment, patient, doctor, consultation, googleMeet }
 * Used by VideoConsultationPage to populate all display fields.
 */
export const getAppointmentFull = async (appointmentId) => {
  const res = await api.get(`/api/appointments/${appointmentId}`);
  return res.data;
};

export const getAppointments = async (params = {}) => {
  const res = await api.get('/api/appointments', { params });
  return res.data;
};

export const bookAppointment = async (appointmentData) => {
  const res = await api.post('/api/appointments', appointmentData);
  return res.data;
};

export const updateAppointment = async (appointmentId, updates) => {
  const res = await api.put(`/api/appointments/${appointmentId}`, updates);
  return res.data;
};

export const cancelAppointment = async (appointmentId, reason = 'Cancelled by user') => {
  const res = await api.post(`/api/appointments/${appointmentId}/cancel`, { reason });
  return res.data;
};

export const createAppointmentMeet = async (appointmentId) => {
  const res = await api.post(`/api/appointments/${appointmentId}/meet`);
  return res.data;
};

export const getAppointmentMeetStatus = async (appointmentId) => {
  const res = await api.get(`/api/appointments/${appointmentId}/meet/status`);
  return res.data;
};


export const uploadConsultationAudio = async (id, audioBlob, durationSeconds) => {
  const formData = new FormData();
  formData.append('file', audioBlob, `consultation_${id}.webm`);
  formData.append('duration_seconds', durationSeconds || 0);

  const res = await api.post(`/api/consultations/${id}/audio`, formData, {
    headers: { 'Content-Type': undefined },
    timeout: 120000,
  });
  return res.data;
};

export const transcribeConsultation = async (id) => {
  const res = await api.post(`/api/consultations/${id}/transcribe`, {}, { timeout: 180000 });
  return res.data;
};

// ─── NVIDIA Hosted Speech-to-Text API ─────────────────────────
export const transcribeWithNvidia = async (consultationId, audioBlob, filename = 'recording.wav') => {
  const formData = new FormData();
  formData.append('audio', audioBlob, filename);
  formData.append('consultationId', consultationId);

  const res = await api.post('/api/transcription/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });
  return res.data;
};

export const getTranscriptStatus = async (consultationId) => {
  const res = await api.get(`/api/consultations/${consultationId}/transcript/status`);
  return res.data;
};

export const getTranscript = async (id) => {
  const res = await api.get(`/api/consultations/${id}/transcript`);
  return res.data;
};

export const updateTranscript = async (id, segments) => {
  const res = await api.put(`/api/consultations/${id}/transcript`, { segments });
  return res.data;
};

export const summarizeConsultation = async (id) => {
  const res = await api.post(`/api/consultations/${id}/summarize`);
  return res.data;
};

export const getSummary = async (id) => {
  const res = await api.get(`/api/consultations/${id}/summary`);
  return res.data;
};

export const finalizeConsultation = async (id, finalData) => {
  const res = await api.post(`/api/consultations/${id}/finalize`, finalData);
  return res.data;
};

export const askConsultationChat = async (id, question) => {
  const res = await api.post(`/api/consultations/${id}/chat`, { question });
  return res.data;
};

// ─── Google Meet & OAuth API ──────────────────────────────────

export const getGoogleAuthUrl = async (returnUrl = null) => {
  const params = returnUrl ? { return_url: returnUrl } : {};
  const res = await api.get('/api/google/auth', { params });
  return res.data;
};

export const getGoogleAuthStatus = async () => {
  const res = await api.get('/api/google/status');
  return res.data;
};

export const disconnectGoogleAuth = async () => {
  const res = await api.post('/api/google/disconnect');
  return res.data;
};

export const updateGoogleAccount = async (email) => {
  const res = await api.post('/api/google/account', { email });
  return res.data;
};

export const createGoogleMeet = async (consultationId, patientId) => {
  const res = await api.post('/api/meet/create', {
    consultationId,
    patientId,
  });
  return res.data;
};

export const getGoogleMeetStatus = async (consultationId) => {
  const res = await api.get(`/api/meet/${consultationId}/status`);
  return res.data;
};

export const endGoogleMeet = async (consultationId) => {
  const res = await api.post(`/api/meet/${consultationId}/end`);
  return res.data;
};

export const getGoogleMeetTranscript = async (consultationId) => {
  const res = await api.get(`/api/meet/${consultationId}/transcript`);
  return res.data;
};

export const syncGoogleMeetTranscript = async (consultationId) => {
  const res = await api.post(`/api/meet/${consultationId}/sync-transcript`);
  return res.data;
};

export const simulateGoogleMeetComplete = async (consultationId) => {
  const res = await api.post(`/api/meet/${consultationId}/mock-complete`);
  return res.data;
};

// ─── Prescriptions API ────────────────────────────────────────


export const extractPrescriptionOCR = async (file, onUploadProgress, customKey = null) => {
  const formData = new FormData();
  formData.append('file', file);

  const apiKey = customKey || localStorage.getItem('kenko_google_ai_key') || '';
  const headers = { 'Content-Type': undefined };
  if (apiKey) {
    headers['x-google-api-key'] = apiKey;
  }

  const res = await api.post('/api/prescriptions/ocr', formData, {
    headers,
    timeout: 120000,
    onUploadProgress,
  });
  return res.data;
};

export const confirmPrescription = async (id, confirmData) => {
  const res = await api.post(`/api/prescriptions/${id}/confirm`, confirmData);
  return res.data;
};

export const getPrescriptions = async () => {
  const res = await api.get('/api/prescriptions');
  return res.data;
};

// ─── Legacy OCR API (Preserved for compatibility) ─────────────

export const extractOCR = async (file, onUploadProgress, customKey = null) => {
  const formData = new FormData();
  formData.append('file', file);

  const apiKey = customKey || localStorage.getItem('kenko_google_ai_key') || '';
  const headers = { 'Content-Type': undefined };
  if (apiKey) {
    headers['x-google-api-key'] = apiKey;
  }

  const response = await api.post('/ocr/extract', formData, {
    headers,
    timeout: 120000,
    onUploadProgress,
  });
  return response.data;
};

// ─── Role Dashboards API ──────────────────────────────────────

export const getDoctorWorkspace = async () => {
  const res = await api.get('/api/doctor/workspace');
  return res.data;
};

export const getPatientTimeline = async (patientId = 'DEMO-P101') => {
  const res = await api.get(`/api/patients/${patientId}/timeline`);
  return res.data;
};

export const getNurseTasks = async () => {
  const res = await api.get('/api/nurse/tasks');
  return res.data;
};

export const getLabTasks = async (statusFilter) => {
  const params = statusFilter ? { status: statusFilter } : {};
  const res = await api.get('/api/lab/tasks', { params });
  return res.data;
};

export const updateLabTaskStatus = async (id, status, resultSummary) => {
  const res = await api.patch(`/api/lab/tasks/${id}/status`, {
    status,
    result_summary: resultSummary,
  });
  return res.data;
};

export const getAdminOverview = async () => {
  const res = await api.get('/api/admin/overview');
  return res.data;
};

// ─── Follow-up Intelligence API ───────────────────────────────

export const getFollowupIntelligence = async (patientId) => {
  const params = patientId ? { patient_id: patientId } : {};
  const res = await api.get('/api/followups', { params });
  return res.data;
};

export const confirmFollowup = async (id) => {
  const res = await api.post(`/api/followups/${id}/confirm`);
  return res.data;
};

export const updateFollowupStatus = async (id, status, dueDate, action) => {
  const res = await api.patch(`/api/followups/${id}/status`, {
    status,
    due_date: dueDate,
    action,
  });
  return res.data;
};

// ─── Demo Seeder API ──────────────────────────────────────────

export const seedDemoDataset = async () => {
  const res = await api.post('/api/demo/seed');
  return res.data;
};

// ─── Dashboard Activity Stubs ─────────────────────────────────

export const getHealthStats = async () => {
  try {
    const res = await api.get('/api/doctor/workspace');
    return {
      total_consultations: res.data.metrics?.total_consultations || 0,
      pending_approval: res.data.metrics?.pending_approval || 0,
      finalized_records: res.data.metrics?.finalized_records || 0,
      active_patients: res.data.metrics?.active_patients || 0,
      pending_followups: res.data.metrics?.pending_followups || 0,
      confirmed_followups: res.data.metrics?.confirmed_followups || 0,
    };
  } catch {
    return {
      total_consultations: 0,
      pending_approval: 0,
      finalized_records: 0,
      active_patients: 0,
      pending_followups: 0,
      confirmed_followups: 0,
    };
  }
};

export const getRecentActivity = async () => {
  try {
    const res = await api.get('/api/consultations');
    return res.data;
  } catch {
    return [];
  }
};


// ─── Doctor Application API ───────────────────────────────────

export const submitDoctorApplication = async (formData) => {
  const res = await api.post('/api/doctor-applications', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return res.data;
};

export const getMyDoctorApplication = async () => {
  const res = await api.get('/api/doctor-applications/my');
  return res.data;
};

// ─── Posts API (Doctor) ───────────────────────────────────────

export const createPost = async (formData) => {
  const res = await api.post('/api/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return res.data;
};

export const getMyPosts = async (status) => {
  const params = status ? { status } : {};
  const res = await api.get('/api/posts/my', { params });
  return res.data;
};

export const submitPostForReview = async (postId) => {
  const res = await api.post(`/api/posts/${postId}/submit`);
  return res.data;
};

export const updatePost = async (postId, formData) => {
  const res = await api.put(`/api/posts/${postId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// ─── Public Feed API ──────────────────────────────────────────

export const getPublicPosts = async ({ category, search, page = 1, perPage = 12 } = {}) => {
  const params = { page, per_page: perPage };
  if (category) params.category = category;
  if (search) params.search = search;
  const res = await api.get('/api/feed/posts', { params });
  return res.data;
};

export const getPublicPost = async (postId) => {
  const res = await api.get(`/api/feed/posts/${postId}`);
  return res.data;
};

// ─── Doctor Profiles API ──────────────────────────────────────

export const getVerifiedDoctors = async ({ search, specialization, page = 1 } = {}) => {
  const params = { page };
  if (search) params.search = search;
  if (specialization) params.specialization = specialization;
  const res = await api.get('/api/doctors', { params });
  return res.data;
};

export const getDoctorProfile = async (userId) => {
  const res = await api.get(`/api/doctors/${userId}`);
  return res.data;
};

// ─── Notifications API ────────────────────────────────────────

export const getNotifications = async (unreadOnly = false) => {
  const res = await api.get('/api/notifications', { params: { unread_only: unreadOnly } });
  return res.data;
};

export const markNotificationRead = async (notifId) => {
  const res = await api.post(`/api/notifications/${notifId}/read`);
  return res.data;
};

// ─── Admin Moderation API ─────────────────────────────────────

export const getModerationOverview = async () => {
  const res = await api.get('/api/admin/moderation-overview');
  return res.data;
};

export const adminListApplications = async ({ status, search, page = 1 } = {}) => {
  const params = { page };
  if (status) params.status = status;
  if (search) params.search = search;
  const res = await api.get('/api/admin/doctor-applications', { params });
  return res.data;
};

export const adminGetApplication = async (appId) => {
  const res = await api.get(`/api/admin/doctor-applications/${appId}`);
  return res.data;
};

export const adminApproveApplication = async (appId) => {
  const res = await api.post(`/api/admin/doctor-applications/${appId}/approve`);
  return res.data;
};

export const adminRejectApplication = async (appId, reason) => {
  const fd = new FormData();
  fd.append('reason', reason);
  const res = await api.post(`/api/admin/doctor-applications/${appId}/reject`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const adminRequestMoreInfo = async (appId, message) => {
  const fd = new FormData();
  fd.append('message', message);
  const res = await api.post(`/api/admin/doctor-applications/${appId}/request-info`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const adminListPosts = async ({ status, search, page = 1 } = {}) => {
  const params = { page };
  if (status) params.status = status;
  if (search) params.search = search;
  const res = await api.get('/api/admin/posts', { params });
  return res.data;
};

export const adminGetPost = async (postId) => {
  const res = await api.get(`/api/admin/posts/${postId}`);
  return res.data;
};

export const adminApprovePost = async (postId) => {
  const res = await api.post(`/api/admin/posts/${postId}/approve`);
  return res.data;
};

export const adminRejectPost = async (postId, reason) => {
  const fd = new FormData();
  fd.append('reason', reason);
  const res = await api.post(`/api/admin/posts/${postId}/reject`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const adminRequestPostChanges = async (postId, message) => {
  const fd = new FormData();
  fd.append('message', message);
  const res = await api.post(`/api/admin/posts/${postId}/request-changes`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const adminListUsers = async ({ search, role, page = 1 } = {}) => {
  const params = { page };
  if (search) params.search = search;
  if (role) params.role = role;
  const res = await api.get('/api/admin/users', { params });
  return res.data;
};

export const adminGetAuditLogs = async (page = 1) => {
  const res = await api.get('/api/admin/audit-logs', { params: { page } });
  return res.data;
};

// ─── Post-Consultation Clinical Workspace & Follow-Up API ───────────────────

export const getClinicalWorkspace = async (consultationId) => {
  const res = await api.get(`/api/clinical/consultations/${consultationId}/workspace`);
  return res.data;
};

export const addTranscriptNote = async (consultationId, { transcript_entry_id, note }) => {
  const res = await api.post(`/api/clinical/consultations/${consultationId}/transcript-notes`, {
    transcript_entry_id,
    note,
  });
  return res.data;
};

export const generateAiClinicalSummary = async (consultationId) => {
  const res = await api.post(`/api/clinical/consultations/${consultationId}/generate-summary`);
  return res.data;
};

export const saveDraftClinicalNote = async (consultationId, payload) => {
  const res = await api.post(`/api/clinical/consultations/${consultationId}/clinical-note/save-draft`, payload);
  return res.data;
};

export const approveClinicalNote = async (consultationId) => {
  const res = await api.post(`/api/clinical/consultations/${consultationId}/clinical-note/approve`);
  return res.data;
};

export const savePrescriptionDraft = async (consultationId, payload) => {
  const res = await api.post(`/api/clinical/consultations/${consultationId}/prescription/save-draft`, payload);
  return res.data;
};

export const approvePrescription = async (consultationId) => {
  const res = await api.post(`/api/clinical/consultations/${consultationId}/prescription/approve`);
  return res.data;
};

export const issuePrescription = async (consultationId) => {
  const res = await api.post(`/api/clinical/consultations/${consultationId}/prescription/issue`);
  return res.data;
};

export const getPatientPrescriptions = async () => {
  const res = await api.get('/api/clinical/patient/prescriptions');
  return res.data;
};

export const getPatientMedicationTasks = async () => {
  const res = await api.get('/api/clinical/patient/medication-tasks');
  return res.data;
};

export const updateMedicationTaskStatus = async (taskId, status) => {
  const res = await api.post(`/api/clinical/patient/medication-tasks/${taskId}/status`, { status });
  return res.data;
};

export const createFollowUpPlan = async (consultationId, payload) => {
  const res = await api.post(`/api/clinical/consultations/${consultationId}/followup-plan`, payload);
  return res.data;
};

export const submitPatientCheckIn = async (payload) => {
  const res = await api.post('/api/clinical/patient/checkin', payload);
  return res.data;
};

export const getDoctorFollowUpDashboard = async (filterBy = 'all') => {
  const res = await api.get('/api/clinical/doctor/followup-dashboard', { params: { filter_by: filterBy } });
  return res.data;
};

export const getDoctorFollowUpDetail = async (planId) => {
  const res = await api.get(`/api/clinical/doctor/followup/${planId}`);
  return res.data;
};

export const doctorReviewFollowUp = async (planId, payload) => {
  const res = await api.post(`/api/clinical/doctor/followup/${planId}/review`, payload);
  return res.data;
};

export const getPatientFollowUpOverview = async () => {
  const res = await api.get('/api/clinical/patient/followup-overview');
  return res.data;
};

export const getPatientHealthTimeline = async () => {
  const res = await api.get('/api/clinical/patient/health-timeline');
  return res.data;
};

export const getPatientDashboardData = async () => {
  const res = await api.get('/api/clinical/patient/dashboard-data');
  return res.data;
};

export const getPatientCareJourney = async () => {
  const res = await api.get('/api/clinical/patient/care-journey');
  return res.data;
};

export const getPatientCalendarEvents = async () => {
  const res = await api.get('/api/clinical/patient/calendar-events');
  return res.data;
};

export const getPatientDocuments = async () => {
  const res = await api.get('/api/clinical/patient/documents');
  return res.data;
};

export const getDoctorPatientDetail = async (patientId) => {
  const res = await api.get(`/api/clinical/doctor/patients/${patientId}`);
  return res.data;
};

export const completeInvestigation = async (investigationId) => {
  const res = await api.post(`/api/clinical/patient/investigations/${investigationId}/complete`);
  return res.data;
};

export default api;
