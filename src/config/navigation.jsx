import {
  IconDashboard,
  IconDoc,
  IconClock,
  IconVideo,
  IconMic,
  IconRx,
  IconScan,
  IconFlask,
  IconPill,
  IconHome,
  IconActivity,
  IconSparkle,
  IconUsers,
} from '../components/icons';

/**
 * Role-aware grouped navigation. Logical grouping with no duplicate routes.
 * Orders sections by daily-workflow priority.
 */
const NAV = {
  admin: [
    {
      label: 'Administration',
      items: [
        { id: 'admin-overview', label: 'System Overview', to: '/admin', icon: IconDashboard, end: true },
        { id: 'admin-users', label: 'User Accounts', to: '/admin?tab=users', icon: IconUsers },
        { id: 'admin-demo', label: 'Demo Environment', to: '/demo', icon: IconSparkle },
      ],
    },
    {
      label: 'Clinical Workflows',
      items: [
        { id: 'admin-consults', label: 'All Consultations', to: '/consultations', icon: IconDoc },
        { id: 'admin-telehealth', label: 'Telehealth', to: '/consultations/video', icon: IconVideo },
        { id: 'admin-prescriptions', label: 'Prescriptions', to: '/prescriptions', icon: IconRx },
        { id: 'admin-followups', label: 'Follow-Up Intelligence', to: '/followups', icon: IconClock },
        { id: 'admin-ocr', label: 'Document OCR', to: '/ocr', icon: IconScan },
      ],
    },
  ],
  doctor: [
    {
      label: 'Clinical Workspace',
      items: [
        { id: 'doc-overview', label: 'Doctor Overview', to: '/doctor', icon: IconDashboard, end: true },
        { id: 'doc-consults', label: 'Consultation Reviews', to: '/consultations', icon: IconDoc },
        { id: 'doc-followups', label: 'Follow-Up Intelligence', to: '/followups', icon: IconClock },
      ],
    },
    {
      label: 'Care Delivery',
      items: [
        { id: 'doc-video', label: 'Telehealth Video', to: '/consultations/video', icon: IconVideo },
        { id: 'doc-inperson', label: 'In-Person Recording', to: '/consultations/in-person', icon: IconMic },
        { id: 'doc-rx', label: 'Prescription Studio', to: '/prescriptions', icon: IconRx },
        { id: 'doc-ocr', label: 'Document OCR', to: '/ocr', icon: IconScan },
      ],
    },
  ],
  patient: [
    {
      label: 'Patient Home',
      items: [
        { id: 'pat-overview', label: 'Care Summary', to: '/patient', icon: IconHome, end: true },
        { id: 'pat-ocr', label: 'Document OCR', to: '/ocr', icon: IconScan },
      ],
    },
    {
      label: 'Care Services',
      items: [
        { id: 'pat-video', label: 'Telehealth Video', to: '/consultations/video', icon: IconVideo },
      ],
    },
  ],
  pharmacist: [
    {
      label: 'Pharmacy',
      items: [
        { id: 'pharm-overview', label: 'Pharmacy Overview', to: '/pharmacy', icon: IconPill, end: true },
        { id: 'pharm-rx', label: 'Prescription Studio', to: '/prescriptions', icon: IconRx },
        { id: 'pharm-ocr', label: 'Document OCR', to: '/ocr', icon: IconScan },
      ],
    },
  ],
  lab: [
    {
      label: 'Laboratory',
      items: [
        { id: 'lab-overview', label: 'Laboratory Queue', to: '/lab', icon: IconFlask, end: true },
        { id: 'lab-consults', label: 'Consultation Hub', to: '/consultations', icon: IconDoc },
      ],
    },
  ],
  nurse: [
    {
      label: 'Nursing',
      items: [
        { id: 'nurse-overview', label: 'Nursing Overview', to: '/nurse', icon: IconActivity, end: true },
        { id: 'nurse-consults', label: 'Consultation Hub', to: '/consultations', icon: IconDoc },
      ],
    },
  ],
};

export function getRoleNavigation(role) {
  const key = String(role || '').toLowerCase();
  return NAV[key] || [];
}

/** Fallback role home per role (used by RoleGuard / redirects). */
export const ROLE_HOME = {
  admin: '/admin',
  doctor: '/doctor',
  nurse: '/nurse',
  lab: '/lab',
  pharmacist: '/pharmacy',
  patient: '/patient',
};

export const ACCESS_DENIED_PATH = '/unauthorized';

export function roleHome(role) {
  const key = String(role || '').toLowerCase();
  return ROLE_HOME[key] || ACCESS_DENIED_PATH;
}