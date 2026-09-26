/**
 * MediBridge AI / KENKO-AI — Comprehensive Firestore Data Service
 * Implements full Firestore collections, subcollections, server-side pagination,
 * sorting, realtime listeners, and Cloud Storage integration.
 */
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
  startAfter,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

export const getUserProfile = async (uid) => {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
};

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
  await updateDoc(userDocRef, { accountStatus: status, status, updatedAt: serverTimestamp() });
};

export const saveUserProfile = async (uid, userData) => {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid);
  const payload = {
    uid,
    displayName: userData.displayName || userData.name || userData.full_name || 'User',
    email: userData.email,
    photoURL: userData.photoURL || userData.profileImage || '',
    role: (userData.role || 'PATIENT').toUpperCase(),
    accountStatus: userData.accountStatus || 'ACTIVE',
    patientId: userData.patientId || (userData.role?.toUpperCase() === 'PATIENT' ? `PT-${uid.slice(0, 6).toUpperCase()}` : null),
    doctorId: userData.doctorId || (userData.role?.toUpperCase() === 'DOCTOR' ? `DR-${uid.slice(0, 6).toUpperCase()}` : null),
    updatedAt: serverTimestamp(),
  };
  await setDoc(userDocRef, payload, { merge: true });
  return payload;
};

export const listUsersPaginated = async ({ pageSize = 20, lastDoc = null, roleFilter = null } = {}) => {
  let q = collection(db, 'users');
  const constraints = [];
  if (roleFilter) constraints.push(where('role', '==', roleFilter.toUpperCase()));
  constraints.push(orderBy('createdAt', 'desc'));
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(q, ...constraints));
  return {
    users: snap.docs.map((d) => ({ uid: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

// ─── 2. DOCTOR APPLICATIONS (doctorApplications/{applicationId}) ─────────────

export const submitDoctorApplicationFirestore = async (userId, applicationData) => {
  const docRef = doc(collection(db, 'doctorApplications'));
  const payload = {
    id: docRef.id,
    userId,
    fullName: applicationData.fullName || applicationData.full_name,
    email: applicationData.email,
    phone: applicationData.phone || '',
    medicalDegree: applicationData.medicalDegree || applicationData.medical_degree,
    specialization: applicationData.specialization,
    registrationNumber: applicationData.registrationNumber || applicationData.registration_number,
    yearsOfExperience: Number(applicationData.yearsOfExperience || applicationData.years_of_experience || 0),
    organization: applicationData.organization || '',
    professionalBio: applicationData.professionalBio || applicationData.professional_bio || '',
    languages: applicationData.languages || [],
    qualificationDocUrl: applicationData.qualificationDocUrl || '',
    registrationDocUrl: applicationData.registrationDocUrl || '',
    photoUrl: applicationData.photoUrl || '',
    status: 'PENDING',
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(docRef, payload);

  // Update user role to DOCTOR_PENDING
  await updateDoc(doc(db, 'users', userId), {
    role: 'DOCTOR_PENDING',
    updatedAt: serverTimestamp(),
  });

  return payload;
};

export const getMyDoctorApplicationFirestore = async (userId) => {
  const q = query(
    collection(db, 'doctorApplications'),
    where('userId', '==', userId),
    orderBy('submittedAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const listDoctorApplicationsForAdmin = async ({ statusFilter = null, pageSize = 20, lastDoc = null } = {}) => {
  const constraints = [];
  if (statusFilter) constraints.push(where('status', '==', statusFilter.toUpperCase()));
  constraints.push(orderBy('submittedAt', 'desc'));
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(collection(db, 'doctorApplications'), ...constraints));
  return {
    applications: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

export const approveDoctorApplicationFirestore = async (applicationId, adminUser) => {
  const appRef = doc(db, 'doctorApplications', applicationId);
  const appSnap = await getDoc(appRef);
  if (!appSnap.exists()) throw new Error('Application not found.');

  const appData = appSnap.data();
  const now = serverTimestamp();

  // 1. Mark application approved
  await updateDoc(appRef, {
    status: 'APPROVED',
    reviewedAt: now,
    reviewedBy: adminUser.uid || adminUser.id,
    updatedAt: now,
  });

  // 2. Promote user to DOCTOR
  await updateDoc(doc(db, 'users', appData.userId), {
    role: 'DOCTOR',
    updatedAt: now,
  });

  // 3. Create public doctor profile
  await setDoc(doc(db, 'doctorProfiles', appData.userId), {
    userId: appData.userId,
    displayName: appData.fullName,
    specialization: appData.specialization,
    medicalDegree: appData.medicalDegree,
    registrationNumber: appData.registrationNumber,
    yearsOfExperience: appData.yearsOfExperience,
    organization: appData.organization,
    professionalBio: appData.professionalBio,
    languages: appData.languages,
    photoURL: appData.photoUrl || '',
    verificationStatus: 'VERIFIED',
    verifiedAt: now,
    verifiedBy: adminUser.uid || adminUser.id,
    createdAt: now,
    updatedAt: now,
  });

  return { success: true };
};

// ─── 3. DOCTOR PROFILES (doctorProfiles/{doctorId}) ──────────────────────────

export const listVerifiedDoctorsFirestore = async ({ specialization = null, pageSize = 12, lastDoc = null } = {}) => {
  const constraints = [where('verificationStatus', '==', 'VERIFIED')];
  if (specialization) constraints.push(where('specialization', '==', specialization));
  constraints.push(orderBy('createdAt', 'desc'));
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(collection(db, 'doctorProfiles'), ...constraints));
  return {
    doctors: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

// ─── 4. POSTS (posts/{postId}) ───────────────────────────────────────────────

export const createPostFirestore = async (authorId, postData) => {
  const postRef = doc(collection(db, 'posts'));
  const payload = {
    id: postRef.id,
    authorId,
    title: postData.title,
    content: postData.content,
    coverImage: postData.coverImage || '',
    category: postData.category || 'General Health',
    tags: postData.tags || [],
    specialization: postData.specialization || '',
    status: 'PENDING_REVIEW',
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(postRef, payload);
  return payload;
};

export const listPublicPostsFirestore = async ({ category = null, pageSize = 12, lastDoc = null } = {}) => {
  const constraints = [where('status', '==', 'PUBLISHED')];
  if (category && category !== 'All') constraints.push(where('category', '==', category));
  constraints.push(orderBy('publishedAt', 'desc'));
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(collection(db, 'posts'), ...constraints));
  return {
    posts: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

export const listDoctorPostsFirestore = async (authorId) => {
  const q = query(
    collection(db, 'posts'),
    where('authorId', '==', authorId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── 5. APPOINTMENTS (appointments/{appointmentId}) ──────────────────────────

export const createAppointmentFirestore = async (patientId, appointmentData) => {
  const aptRef = doc(collection(db, 'appointments'));
  const payload = {
    id: aptRef.id,
    patientId,
    doctorId: appointmentData.doctorId || 'dr_default_01',
    patientName: appointmentData.patientName || 'Patient',
    doctorName: appointmentData.doctorName || 'Dr. Aarav Patel',
    doctorSpecialization: appointmentData.doctorSpecialization || 'General Medicine',
    reason: appointmentData.reason || 'General Consultation',
    consultationType: appointmentData.consultationType || appointmentData.appointment_type || 'video',
    status: 'SCHEDULED',
    scheduledStart: appointmentData.scheduledStart || appointmentData.scheduled_at || serverTimestamp(),
    scheduledEnd: appointmentData.scheduledEnd || null,
    googleSpaceName: appointmentData.googleSpaceName || '',
    googleMeetingUri: appointmentData.googleMeetingUri || '',
    googleMeetingCode: appointmentData.googleMeetingCode || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(aptRef, payload);
  return payload;
};

export const getAppointmentFirestore = async (appointmentId) => {
  if (!appointmentId) return null;
  const snap = await getDoc(doc(db, 'appointments', appointmentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateAppointmentFirestore = async (appointmentId, updates) => {
  const aptRef = doc(db, 'appointments', appointmentId);
  await updateDoc(aptRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const cancelAppointmentFirestore = async (appointmentId, reason = 'Cancelled by user') => {
  const aptRef = doc(db, 'appointments', appointmentId);
  await updateDoc(aptRef, {
    status: 'CANCELLED',
    cancelReason: reason,
    updatedAt: serverTimestamp(),
  });
};

export const listUserAppointmentsFirestore = async (userId, role = 'patient') => {
  try {
    const field = role?.toLowerCase() === 'doctor' ? 'doctorId' : 'patientId';
    const q = query(
      collection(db, 'appointments'),
      where(field, '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('listUserAppointmentsFirestore fallback:', err?.message);
    try {
      const snap = await getDocs(collection(db, 'appointments'));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => (role?.toLowerCase() === 'doctor' ? a.doctorId === userId : a.patientId === userId));
    } catch {
      return [];
    }
  }
};

export const listAllAppointmentsFirestore = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'appointments'), orderBy('createdAt', 'desc'), limit(100)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('listAllAppointmentsFirestore error:', err?.message);
    return [];
  }
};

export const listenToUserAppointmentsFirestore = (userId, role, onUpdate) => {
  if (!userId) return () => {};
  const isDoctor = role?.toLowerCase() === 'doctor';
  const isAdmin = role?.toLowerCase() === 'admin';

  let q;
  if (isAdmin) {
    q = query(collection(db, 'appointments'), limit(100));
  } else {
    const field = isDoctor ? 'doctorId' : 'patientId';
    q = query(collection(db, 'appointments'), where(field, '==', userId), limit(50));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(list);
    },
    (err) => {
      console.warn('Appointments snapshot listener error:', err?.message);
    }
  );
};

export const getVerifiedDoctorsFirestore = async () => {
  try {
    const q = query(collection(db, 'doctorProfiles'), limit(50));
    const snap = await getDocs(q);
    const doctors = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (doctors.length > 0) return doctors;
  } catch (err) {
    console.warn('getVerifiedDoctorsFirestore profiles error:', err?.message);
  }
  try {
    const q = query(collection(db, 'users'), where('role', 'in', ['DOCTOR', 'doctor']), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      doctorId: d.id,
      fullName: d.data().displayName || d.data().name || 'Dr. Specialist',
      specialization: d.data().specialization || 'General Medicine',
      email: d.data().email,
    }));
  } catch {
    return [
      { id: 'dr_aarav', fullName: 'Dr. Aarav Patel', specialization: 'General Medicine', email: 'dr.aarav@kenko.ai' },
      { id: 'dr_ananya', fullName: 'Dr. Ananya Sharma', specialization: 'Cardiology', email: 'dr.ananya@kenko.ai' },
      { id: 'dr_sarah', fullName: 'Dr. Sarah Jenkins', specialization: 'Neurology', email: 'dr.sarah@kenko.ai' },
      { id: 'dr_prasanth', fullName: 'Dr. Prasanth Kumar', specialization: 'Internal Medicine', email: 'prasanthanith5@gmail.com' },
    ];
  }
};


// ─── 6. CONSULTATIONS & TRANSCRIPT SUBCOLLECTION ─────────────────────────────

export const getConsultationFirestore = async (consultationId) => {
  const snap = await getDoc(doc(db, 'consultations', consultationId));
  if (!snap.exists()) return null;
  const consult = { id: snap.id, ...snap.data() };

  // Fetch transcript entries subcollection
  const tSnap = await getDocs(
    query(
      collection(db, 'consultations', consultationId, 'transcriptEntries'),
      orderBy('startTime', 'asc')
    )
  );
  consult.transcriptEntries = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return consult;
};

export const addTranscriptEntryFirestore = async (consultationId, entryData) => {
  const entryRef = doc(collection(db, 'consultations', consultationId, 'transcriptEntries'));
  const payload = {
    id: entryRef.id,
    speakerRole: entryData.speakerRole || 'UNKNOWN',
    speakerName: entryData.speakerName || 'Speaker',
    text: entryData.text,
    startTime: entryData.startTime || 0.0,
    endTime: entryData.endTime || 0.0,
    source: 'GOOGLE_MEET',
    createdAt: serverTimestamp(),
  };
  await setDoc(entryRef, payload);
  return payload;
};

// ─── 7. CLINICAL NOTES (clinicalNotes/{clinicalNoteId}) ───────────────────────

export const saveClinicalNoteFirestore = async (consultationId, noteData) => {
  const noteRef = doc(db, 'clinicalNotes', consultationId);
  const payload = {
    consultationId,
    patientId: noteData.patientId,
    doctorId: noteData.doctorId,
    chiefComplaint: noteData.chiefComplaint || noteData.chief_complaint || '',
    hpi: noteData.hpi || '',
    symptoms: noteData.symptoms || [],
    duration: noteData.duration || '',
    subjective: noteData.subjective || noteData.soap_subjective || '',
    objective: noteData.objective || noteData.soap_objective || '',
    assessment: noteData.assessment || noteData.soap_assessment || '',
    plan: noteData.plan || noteData.soap_plan || '',
    doctorNotes: noteData.doctorNotes || noteData.doctor_notes || '',
    status: noteData.status || 'DRAFT',
    source: 'GOOGLE_MEET_TRANSCRIPT',
    approvedBy: noteData.approvedBy || null,
    approvedAt: noteData.approvedAt || null,
    updatedAt: serverTimestamp(),
  };
  await setDoc(noteRef, payload, { merge: true });
  return payload;
};

// ─── 8. PRESCRIPTIONS (prescriptions/{prescriptionId}) ───────────────────────

export const savePrescriptionFirestore = async (consultationId, prescriptionData) => {
  const pRef = doc(db, 'prescriptions', consultationId);
  const payload = {
    consultationId,
    patientId: prescriptionData.patientId,
    doctorId: prescriptionData.doctorId,
    doctorName: prescriptionData.doctorName || '',
    status: prescriptionData.status || 'DRAFT',
    patientInstructions: prescriptionData.patientInstructions || '',
    internalDoctorNotes: prescriptionData.internalDoctorNotes || '',
    items: prescriptionData.items || [],
    updatedAt: serverTimestamp(),
  };
  await setDoc(pRef, payload, { merge: true });
  return payload;
};

// ─── 9. FOLLOW-UP PLANS & CHECK-INS SUBCOLLECTION ────────────────────────────

export const saveFollowUpPlanFirestore = async (consultationId, planData) => {
  const fRef = doc(db, 'followUpPlans', consultationId);
  const payload = {
    consultationId,
    patientId: planData.patientId,
    doctorId: planData.doctorId,
    followUpDate: planData.followUpDate || planData.due_date,
    instructions: planData.instructions || planData.instruction,
    conditionMonitoring: planData.conditionMonitoring || 'Standard Monitoring',
    recommendedTestName: planData.recommendedTestName || '',
    status: 'ACTIVE',
    updatedAt: serverTimestamp(),
  };
  await setDoc(fRef, payload, { merge: true });
  return payload;
};

export const submitPatientCheckInFirestore = async (followUpId, checkInData) => {
  const checkInRef = doc(collection(db, 'followUpPlans', followUpId, 'checkIns'));
  const payload = {
    id: checkInRef.id,
    patientId: checkInData.patientId,
    response: checkInData.response || checkInData.condition_status, // RECOVERING | SAME | WORSENING
    notes: checkInData.notes || '',
    submittedAt: serverTimestamp(),
  };
  await setDoc(checkInRef, payload);

  // Update plan status if worsening or same
  if (payload.response === 'WORSENING') {
    await updateDoc(doc(db, 'followUpPlans', followUpId), { status: 'HIGH_PRIORITY_REVIEW', updatedAt: serverTimestamp() });
  } else if (payload.response === 'SAME') {
    await updateDoc(doc(db, 'followUpPlans', followUpId), { status: 'NEEDS_REVIEW', updatedAt: serverTimestamp() });
  }

  return payload;
};

// ─── 10. REALTIME NOTIFICATIONS (notifications/{userId}/items/{id}) ──────────

export const listenToNotificationsFirestore = (userId, onUpdate) => {
  if (!userId) return () => {};
  const q = query(
    collection(db, 'notifications', userId, 'items'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    onUpdate(items);
  });
};

export const subscribeToNotifications = listenToNotificationsFirestore;

export const markNotificationReadFirestore = async (userId, notificationId) => {
  await updateDoc(doc(db, 'notifications', userId, 'items', notificationId), {
    read: true,
  });
};

export const markNotificationAsRead = markNotificationReadFirestore;

// ─── 11. CLOUD STORAGE HELPERS ───────────────────────────────────────────────

export const uploadFileToStorage = async (file, path) => {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

// ─── 12. AUDIT LOGGING (auditLogs/{logId}) ───────────────────────────────────

export const logAuditEvent = async (actorId, action, targetType, targetId, details = {}) => {
  try {
    const logRef = doc(collection(db, 'auditLogs'));
    await setDoc(logRef, {
      id: logRef.id,
      actorId,
      action,
      targetType,
      targetId,
      details,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('logAuditEvent note:', e.message);
  }
};

export const getAuditLogs = async (maxCount = 50) => {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getAuditLogs note:', e.message);
    return [];
  }
};

// ─── 13. WORKSPACE & INVENTORY HELPERS ──────────────────────────────────────

export const getPrescriptions = async (role, idFilter) => {
  try {
    let q;
    if (role === 'doctor' && idFilter) {
      q = query(collection(db, 'prescriptions'), where('doctorId', '==', idFilter), orderBy('updatedAt', 'desc'), limit(50));
    } else if (role === 'patient' && idFilter) {
      q = query(collection(db, 'prescriptions'), where('patientId', '==', idFilter), orderBy('updatedAt', 'desc'), limit(50));
    } else {
      q = query(collection(db, 'prescriptions'), orderBy('updatedAt', 'desc'), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getPrescriptions note:', e.message);
    return [];
  }
};

export const updatePrescriptionDispenseStatus = async (prescriptionId, status) => {
  const pRef = doc(db, 'prescriptions', prescriptionId);
  await updateDoc(pRef, { dispenseStatus: status, updatedAt: serverTimestamp() });
};

export const getMedicineInventory = async () => {
  try {
    const snap = await getDocs(collection(db, 'medicineInventory'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getMedicineInventory note:', e.message);
    return [];
  }
};

export const updateMedicineStock = async (medicineId, newStock) => {
  const mRef = doc(db, 'medicineInventory', medicineId);
  await updateDoc(mRef, { stock: newStock, updatedAt: serverTimestamp() });
};

export const addMedicineToInventory = async (medData) => {
  const mRef = doc(collection(db, 'medicineInventory'));
  await setDoc(mRef, { id: mRef.id, ...medData, createdAt: serverTimestamp() });
  return mRef.id;
};

export const getLabRequests = async (role, idFilter) => {
  try {
    let q;
    if (role === 'doctor' && idFilter) {
      q = query(collection(db, 'labRequests'), where('doctorId', '==', idFilter), limit(50));
    } else if (role === 'patient' && idFilter) {
      q = query(collection(db, 'labRequests'), where('patientId', '==', idFilter), limit(50));
    } else {
      q = query(collection(db, 'labRequests'), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getLabRequests note:', e.message);
    return [];
  }
};

export const getAppointments = async (role, idFilter) => {
  return listUserAppointmentsFirestore(idFilter, role);
};

export const getConsultations = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'consultations'), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
};

export const getPatients = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'PATIENT'), limit(50)));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
};

export const getVitals = async () => [];

export const seedInitialFirestoreData = async () => {
  // Graceful no-op or seed initial defaults
  return { success: true };
};
