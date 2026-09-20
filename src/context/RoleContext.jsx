import { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  IconShield,
  IconStethoscope,
  IconFlask,
  IconPill,
  IconUser,
} from '../components/icons';

const RoleContext = createContext(null);

/**
 * Role identity configuration.
 * Icons are component references (professional SVG set). Colors are semantic
 * only — every role shares the single brand accent for consistency.
 */
export const ROLES = {
  ADMIN: {
    id: 'admin',
    label: 'System Administration',
    roleName: 'Administrator',
    name: 'Sarah Mitchell',
    department: 'Hospital Administration',
    accent: '#1769AA',
    icon: IconShield,
    path: '/admin',
  },
  DOCTOR: {
    id: 'doctor',
    label: 'Attending Physician',
    roleName: 'Consultant',
    name: 'Aarav Patel, MD',
    specialty: 'Internal Medicine & Cardiology',
    department: 'General Medicine',
    accent: '#1769AA',
    icon: IconStethoscope,
    path: '/doctor',
  },
  NURSE: {
    id: 'nurse',
    label: 'Staff Nurse',
    roleName: 'Nursing Care',
    name: 'Sarah Wilson, RN',
    department: 'Inpatient Care',
    accent: '#1769AA',
    icon: IconShield,
    path: '/nurse',
  },
  LAB: {
    id: 'lab',
    label: 'Lab Technician',
    roleName: 'Laboratory Services',
    name: 'Marcus Vance',
    department: 'Clinical Pathology',
    accent: '#1769AA',
    icon: IconFlask,
    path: '/lab',
  },
  PHARMACIST: {
    id: 'pharmacist',
    label: 'Clinical Pharmacist',
    roleName: 'Pharmacy Services',
    name: 'Elena Rostova, PharmD',
    department: 'Inpatient & Ambulatory Pharmacy',
    accent: '#1769AA',
    icon: IconPill,
    path: '/pharmacy',
  },
  PATIENT: {
    id: 'patient',
    label: 'Patient',
    roleName: 'Patient',
    name: 'Ananya Kumar',
    patientId: 'PT-2025-0048',
    accent: '#1769AA',
    icon: IconUser,
    path: '/patient',
  },
  UNKNOWN: {
    id: 'unknown',
    label: 'Unassigned Role',
    roleName: 'Pending Provisioning',
    name: 'Care Team Member',
    accent: '#1769AA',
    icon: IconUser,
    path: '/unauthorized',
  },
};

export function RoleProvider({ children }) {
  const { user } = useAuth();
  const [activePatientId, setActivePatientId] = useState('');

  const formattedRole = user?.role ? String(user.role).toLowerCase() : null;
  const normalizedKey = formattedRole
    ? Object.keys(ROLES).find((k) => k.toLowerCase() === formattedRole) || 'UNKNOWN'
    : 'UNKNOWN';
  const roleConfig = ROLES[normalizedKey];
  const activeRole = roleConfig.id;

  const value = {
    activeRole,
    roleConfig,
    allRoles: ROLES,
    activePatientId: user?.patientId || activePatientId,
    setActivePatientId,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole must be used inside a <RoleProvider>');
  }
  return ctx;
}

export default RoleContext;