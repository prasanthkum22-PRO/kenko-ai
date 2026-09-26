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
  IconStethoscope,
  IconHeart,
  IconBell,
  IconCalendar,
  IconShield,
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
        { id: 'admin-applications', label: 'Doctor Applications', to: '/admin/doctors/applications', icon: IconStethoscope },
        { id: 'admin-post-moderation', label: 'Post Moderation', to: '/admin/posts', icon: IconDoc },
        { id: 'admin-users', label: 'User Accounts', to: '/admin/users', icon: IconUsers },
        { id: 'admin-audit', label: 'Audit Logs', to: '/admin/audit', icon: IconActivity },
        { id: 'admin-notifs', label: 'Notifications', to: '/notifications', icon: IconBell },
        { id: 'admin-demo', label: 'Demo Environment', to: '/demo', icon: IconSparkle },
      ],
    },
    {
      label: 'Clinical Workflows',
      items: [
        { id: 'admin-appointments', label: 'Appointments Schedule', to: '/appointments', icon: IconCalendar },
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
        { id: 'doc-appointments', label: 'Appointments Schedule', to: '/appointments', icon: IconCalendar },
        { id: 'doc-consults', label: 'Consultation Reviews', to: '/consultations', icon: IconDoc },
        { id: 'doc-followups', label: 'Follow-Up Alerts & Plans', to: '/doctor/follow-up', icon: IconClock },
        { id: 'doc-notifs', label: 'Notifications', to: '/notifications', icon: IconBell },
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
    {
      label: 'Content',
      items: [
        { id: 'doc-posts', label: 'My Posts', to: '/doctor/posts', icon: IconSparkle },
      ],
    },
  ],
  doctor_pending: [
    {
      label: 'Application',
      items: [
        { id: 'pending-status', label: 'Application Status', to: '/apply-doctor/status', icon: IconClock },
        { id: 'pending-notifs', label: 'Notifications', to: '/notifications', icon: IconBell },
      ],
    },
  ],
  patient: [
    {
      label: 'My Care Journey',
      items: [
        { id: 'pat-overview', label: 'Dashboard', to: '/patient', icon: IconHome, end: true },
        { id: 'pat-appointments-sched', label: 'Care Schedule', to: '/patient/calendar', icon: IconCalendar },
        { id: 'pat-journey', label: 'Care Journey', to: '/patient/care-journey', icon: IconActivity },
        { id: 'pat-meds', label: 'Medication Tracker', to: '/patient/medications', icon: IconPill },
        { id: 'pat-followup', label: 'Follow-Up & Check-In', to: '/patient/follow-up', icon: IconClock },
        { id: 'pat-docs', label: 'Document Center', to: '/patient/documents', icon: IconDoc },
        { id: 'pat-activity', label: 'Health Activity', to: '/patient/activity', icon: IconActivity },
        { id: 'pat-summary', label: 'Health Summary', to: '/patient/health-summary', icon: IconShield },
      ],
    },
    {
      label: 'Care Services',
      items: [
        { id: 'pat-appointments', label: 'Book & Appointments', to: '/appointments', icon: IconCalendar },
        { id: 'pat-video', label: 'Telehealth Video', to: '/consultations/video', icon: IconVideo },
        { id: 'pat-doctors', label: 'Find Doctors', to: '/doctors', icon: IconUsers },
        { id: 'pat-posts', label: 'Health Posts', to: '/posts', icon: IconDoc },
        { id: 'pat-notifs', label: 'Notifications', to: '/notifications', icon: IconBell },
        { id: 'pat-apply-doctor', label: 'Become a Doctor', to: '/apply-doctor', icon: IconStethoscope },
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
  doctor_pending: '/apply-doctor/status',
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