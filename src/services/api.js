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

export default api;
