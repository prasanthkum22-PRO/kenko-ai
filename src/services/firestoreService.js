import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ─── 1. USER PROFILES ─────────────────────────────────────────

export const getUserProfile = async (uid) => {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid);
  const snap = await getDoc(userDocRef);
  if (snap.exists()) {
    return { uid: snap.id, ...snap.data() };
  }
  return null;
};

/**
 * Look up application user profile(s) by email.
 * Used to reconcile provisioned roles (e.g. seeded demo staff) with the real
 * Firebase Auth UID. The role is ALWAYS taken from the stored profile, never
 * derived from the email address.
 */
export const getUserProfileByEmail = async (email) => {
  if (!email) return [];
  try {
    const q = query(collection(db, 'users'), where('email', '==', email), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getUserProfileByEmail note:', e.message);
    return [];
  }
};

export const saveUserProfile = async (uid, userData) => {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid);
  const payload = {
    uid,
    name: userData.name || userData.full_name || 'User',
    email: userData.email,
    phone: userData.phone || '+1 (555) 019-2834',
    role: (userData.role || 'patient').toLowerCase(),
    profileImage: userData.profileImage || '',
    status: userData.status || 'Active',
    patientId: userData.patientId || (userData.role?.toLowerCase() === 'patient' ? `PT-${uid.slice(0, 6).toUpperCase()}` : null),
    doctorId: userData.doctorId || (userData.role?.toLowerCase() === 'doctor' ? `DR-${uid.slice(0, 6).toUpperCase()}` : null),
    specialty: userData.specialty || (userData.role?.toLowerCase() === 'doctor' ? 'Internal Medicine' : null),
    department: userData.department || (userData.role?.toLowerCase() === 'doctor' ? 'General Medicine' : userData.role?.toLowerCase() === 'lab' ? 'Pathology' : userData.role?.toLowerCase() === 'pharmacist' ? 'Clinical Pharmacy' : null),
    updatedAt: serverTimestamp(),
  };
  await setDoc(userDocRef, payload, { merge: true });
  return payload;
};

export const getAllUsers = async () => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getAllUsers fallback:', e.message);
    return [];
  }
};

export const updateUserStatus = async (uid, status) => {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, { status, updatedAt: serverTimestamp() });
};

// ─── 2. APPOINTMENTS ──────────────────────────────────────────

export const getAppointments = async (role, idFilter) => {
  try {
    let q;
    if (role === 'doctor' && idFilter) {
      q = query(collection(db, 'appointments'), where('doctorId', '==', idFilter), orderBy('scheduledTime', 'asc'));
    } else if (role === 'patient' && idFilter) {
      q = query(collection(db, 'appointments'), where('patientId', '==', idFilter), orderBy('scheduledTime', 'asc'));
    } else {
      q = query(collection(db, 'appointments'), orderBy('scheduledTime', 'asc'), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getAppointments note:', e.message);
    return [];
  }
};

export const createAppointment = async (apptData) => {
  const ref = await addDoc(collection(db, 'appointments'), {
    ...apptData,
    status: apptData.status || 'Confirmed',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, ...apptData };
};

export const updateAppointmentStatus = async (appointmentId, status) => {
  const ref = doc(db, 'appointments', appointmentId);
  await updateDoc(ref, { status, updatedAt: serverTimestamp() });
};

// ─── 3. PRESCRIPTIONS & PHARMACY ─────────────────────────────

export const getPrescriptions = async (filter = {}) => {
  try {
    let q;
    if (filter.patientId) {
      q = query(collection(db, 'prescriptions'), where('patientId', '==', filter.patientId), orderBy('createdAt', 'desc'));
    } else if (filter.doctorId) {
      q = query(collection(db, 'prescriptions'), where('doctorId', '==', filter.doctorId), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getPrescriptions note:', e.message);
    return [];
  }
};

export const createPrescriptionRecord = async (prescriptionData) => {
  const ref = await addDoc(collection(db, 'prescriptions'), {
    ...prescriptionData,
    dispenseStatus: 'Pending',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, ...prescriptionData };
};

export const updatePrescriptionDispenseStatus = async (prescriptionId, dispenseStatus, pharmacistName) => {
  const ref = doc(db, 'prescriptions', prescriptionId);
  await updateDoc(ref, {
    dispenseStatus,
    dispensedBy: pharmacistName || 'Pharmacist',
    dispensedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// ─── 4. MEDICINE INVENTORY ────────────────────────────────────

export const getMedicineInventory = async () => {
  try {
    const snap = await getDocs(collection(db, 'inventory'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getMedicineInventory note:', e.message);
    return [];
  }
};

export const updateMedicineStock = async (medicineId, newStock) => {
  const ref = doc(db, 'inventory', medicineId);
  await updateDoc(ref, {
    stock: Number(newStock),
    status: Number(newStock) <= 0 ? 'Out of Stock' : Number(newStock) < 25 ? 'Low Stock' : 'In Stock',
    updatedAt: serverTimestamp(),
  });
};

export const addMedicineToInventory = async (medicineData) => {
  const ref = await addDoc(collection(db, 'inventory'), {
    ...medicineData,
    stock: Number(medicineData.stock) || 100,
    status: (Number(medicineData.stock) || 100) < 25 ? 'Low Stock' : 'In Stock',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, ...medicineData };
};

// ─── 5. LAB REQUESTS & RESULTS ───────────────────────────────

export const getLabRequests = async (filter = {}) => {
  try {
    let q;
    if (filter.patientId) {
      q = query(collection(db, 'labRequests'), where('patientId', '==', filter.patientId), orderBy('requestedAt', 'desc'));
    } else {
      q = query(collection(db, 'labRequests'), orderBy('requestedAt', 'desc'), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getLabRequests note:', e.message);
    return [];
  }
};

export const updateLabRequestStatus = async (requestId, status, resultData = null, technicianName = null) => {
  const ref = doc(db, 'labRequests', requestId);
  const payload = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (resultData) payload.result = resultData;
  if (technicianName) payload.technicianName = technicianName;
  if (status === 'Completed' || status === 'Result Uploaded') {
    payload.completedAt = serverTimestamp();
  }
  await updateDoc(ref, payload);
};

export const createLabRequest = async (requestData) => {
  const ref = await addDoc(collection(db, 'labRequests'), {
    ...requestData,
    status: requestData.status || 'Requested',
    priority: requestData.priority || 'Normal',
    requestedAt: serverTimestamp(),
  });
  return { id: ref.id, ...requestData };
};

// ─── 6. AUDIT LOGS & NOTIFICATIONS ───────────────────────────

export const logAuditEvent = async (eventData) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      ...eventData,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Audit log write note:', e.message);
  }
};

export const getAuditLogs = async (limitCount = 40) => {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getAuditLogs note:', e.message);
    return [];
  }
};

export const getNotifications = async (userId, userRole) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('targetRole', 'in', ['all', userRole, userId]),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
};

// ─── 7. INITIAL CLINICAL AUTO-SEEDER ─────────────────────────

export const seedInitialFirestoreData = async () => {
  try {
    const userCheck = await getDocs(collection(db, 'users'));
    if (userCheck.docs.length >= 5) return; // Already seeded

    // 1. Seed Core Role Users
    const users = [
      {
        uid: 'demo-admin-01',
        name: 'Dr. Sarah Mitchell',
        email: 'admin@medibridge.ai',
        phone: '+1 (555) 892-1049',
        role: 'admin',
        department: 'Hospital Administration',
        status: 'Active',
      },
      {
        uid: 'demo-doctor-01',
        name: 'Dr. Aarav Patel, MD',
        email: 'doctor@medibridge.ai',
        phone: '+1 (555) 749-3021',
        role: 'doctor',
        doctorId: 'DR-7402',
        specialty: 'Internal Medicine & Cardiology',
        department: 'General Medicine',
        status: 'Active',
      },
      {
        uid: 'demo-lab-01',
        name: 'Marcus Vance, PhD',
        email: 'lab@medibridge.ai',
        phone: '+1 (555) 438-9201',
        role: 'lab',
        department: 'Clinical Pathology',
        status: 'Active',
      },
      {
        uid: 'demo-pharmacist-01',
        name: 'Elena Rostova, PharmD',
        email: 'pharmacist@medibridge.ai',
        phone: '+1 (555) 912-3847',
        role: 'pharmacist',
        department: 'Inpatient & Ambulatory Pharmacy',
        status: 'Active',
      },
      {
        uid: 'demo-patient-01',
        name: 'Ananya Kumar',
        email: 'patient@medibridge.ai',
        phone: '+1 (555) 203-9182',
        role: 'patient',
        patientId: 'PT-2025-0048',
        age: 38,
        gender: 'Female',
        status: 'Active',
      },
    ];

    for (const u of users) {
      await setDoc(doc(db, 'users', u.uid), { ...u, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    }

    // 2. Seed Initial Inventory
    const medicines = [
      { name: 'Amoxicillin 500mg', category: 'Antibiotic', stock: 140, minThreshold: 30, unit: 'capsules', location: 'Shelf A-12' },
      { name: 'Metformin 500mg', category: 'Antidiabetic', stock: 85, minThreshold: 25, unit: 'tablets', location: 'Shelf B-04' },
      { name: 'Atorvastatin 20mg', category: 'Cardiovascular', stock: 18, minThreshold: 25, unit: 'tablets', location: 'Shelf C-09' },
      { name: 'Paracetamol 650mg', category: 'Analgesic', stock: 220, minThreshold: 50, unit: 'tablets', location: 'Shelf A-01' },
      { name: 'Salbutamol Inhaler 100mcg', category: 'Respiratory', stock: 6, minThreshold: 15, unit: 'units', location: 'Shelf D-03' },
    ];

    for (const m of medicines) {
      await addDoc(collection(db, 'inventory'), {
        ...m,
        status: m.stock <= 0 ? 'Out of Stock' : m.stock < m.minThreshold ? 'Low Stock' : 'In Stock',
        createdAt: serverTimestamp(),
      });
    }

    // 3. Seed Lab Requests
    const labs = [
      {
        patientId: 'PT-2025-0048',
        patientName: 'Ananya Kumar',
        doctorId: 'DR-7402',
        requestingDoctor: 'Dr. Aarav Patel',
        testName: 'Complete Blood Count (CBC) with Differential',
        category: 'Hematology',
        priority: 'Urgent',
        status: 'Processing',
        reason: 'Evaluation of persistent low-grade fever and cough',
        requestedAt: serverTimestamp(),
      },
      {
        patientId: 'PT-2025-0048',
        patientName: 'Ananya Kumar',
        doctorId: 'DR-7402',
        requestingDoctor: 'Dr. Aarav Patel',
        testName: 'Lipid Panel & Serum Creatinine',
        category: 'Biochemistry',
        priority: 'Normal',
        status: 'Sample Collected',
        reason: 'Cardiovascular baseline assessment',
        requestedAt: serverTimestamp(),
      },
    ];

    for (const l of labs) {
      await addDoc(collection(db, 'labRequests'), l);
    }

    // 4. Seed Prescriptions
    const prescriptions = [
      {
        patientId: 'PT-2025-0048',
        patientName: 'Ananya Kumar',
        doctorId: 'DR-7402',
        doctorName: 'Dr. Aarav Patel',
        medications: [
          { name: 'Amoxicillin 500mg', dosage: '500mg', frequency: '1-0-1 (Twice daily)', duration: '5 days', instructions: 'Take with food' },
          { name: 'Paracetamol 650mg', dosage: '650mg', frequency: 'As needed', duration: '3 days', instructions: 'For temperature > 100°F' },
        ],
        diagnosis: 'Acute Upper Respiratory Tract Infection',
        dispenseStatus: 'Pending',
        createdAt: serverTimestamp(),
      },
    ];

    for (const p of prescriptions) {
      await addDoc(collection(db, 'prescriptions'), p);
    }
  } catch (e) {
    console.warn('Initial data seeding note:', e.message);
  }
};
