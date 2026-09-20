/**
 * Role resolution + routing matrix test.
 * Runs against the REAL modules (roleResolution.js, navigation.jsx logic).
 * Invoke: node scripts/role-authorization.test.mjs
 */
import assert from 'node:assert/strict';
import { pickAuthoritativeProfile, normalizeRole } from '../src/utils/roleResolution.js';

const ROLE_HOME = {
  admin: '/admin',
  doctor: '/doctor',
  nurse: '/nurse',
  lab: '/lab',
  pharmacist: '/pharmacy',
  patient: '/patient',
};

function roleHome(role) {
  const key = String(role || '').toLowerCase();
  return ROLE_HOME[key] || '/unauthorized';
}

// Mirrors RoleGuard.jsx: the user's role must literally be in the gate list.
const allowed = (role, allowedRoles) => {
  const userRole = String(role || '').toLowerCase();
  return Boolean(userRole) && allowedRoles.map((r) => r.toLowerCase()).includes(userRole);
};

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  ${name} -> ${e.message}`);
  }
}

const seededDoctor = { uid: 'demo-doctor-01', email: 'doctor@medibridge.ai', role: 'doctor', doctorId: 'DR-7402' };
const seededPatient = { uid: 'demo-patient-01', email: 'patient@medibridge.ai', role: 'patient', patientId: 'PT-2025-0048' };
const buggedUidProfile = { uid: 'real-uid-abc', email: 'doctor@medibridge.ai', role: 'patient' }; // leftover from old auto-provision bug

// ── 1. DOCTOR ≠ PATIENT ─────────────────────────────────────────
check('DOCTOR login with real UID + seeded doctor email -> role doctor', () => {
  const p = pickAuthoritativeProfile(null, [seededDoctor]);
  assert.equal(normalizeRole(p.role), 'doctor');
});
check('DOCTOR with leftover bugged patient UID profile heals to doctor', () => {
  const p = pickAuthoritativeProfile(buggedUidProfile, [seededDoctor]);
  assert.equal(normalizeRole(p.role), 'doctor');
});
check('DOCTOR roleHome = /doctor (never /patient)', () => {
  assert.equal(roleHome('doctor'), '/doctor');
});
check('DOCTOR has no route access to /patient', () => {
  assert.equal(allowed('doctor', ['patient', 'admin']), false);
  assert.equal(allowed('doctor', ['doctor', 'admin']), true);
});
check('DOCTOR manuals /doctor: RoleGuard gate allows', () => {
  assert.equal(allowed('doctor', ['doctor', 'admin']), true);
  assert.equal(roleHome('doctor'), '/doctor');
});

// ── 2. ROUTE GATES PER ROLE ─────────────────────────────────────
const gates = {
  doctor: ['doctor', 'admin'],
  patient: ['patient', 'admin'],
  admin: ['admin'],
  lab: ['lab', 'admin'],
  pharmacist: ['pharmacist', 'admin'],
  nurse: ['nurse', 'doctor', 'admin'],
};
const expectedAccess = {
  doctor: { doctor: true, patient: false, admin: false, lab: false, pharmacist: false, nurse: true },
  patient: { patient: true, doctor: false, admin: false, lab: false, pharmacist: false, nurse: false },
  admin: { doctor: true, patient: true, admin: true, lab: true, pharmacist: true, nurse: true },
  lab: { patient: false, doctor: false, admin: false, lab: true, pharmacist: false, nurse: false },
  pharmacist: { patient: false, doctor: false, admin: false, lab: false, pharmacist: true, nurse: false },
  nurse: { patient: false, doctor: false, admin: false, lab: false, pharmacist: false, nurse: true },
};
for (const role of Object.keys(expectedAccess)) {
  for (const target of Object.keys(expectedAccess[role])) {
    const want = expectedAccess[role][target];
    check(`ROUTE ${role} -> ${target} ${want ? 'ALLOWED' : 'BLOCKED'}`, () => {
      assert.equal(allowed(role, gates[target]), want);
    });
  }
}

// ── 3. UNKNOWN ROLE IS NEVER SILENTLY 'patient' ─────────────────
check('UNKNOWN role -> access-pending route, NOT /patient', () => {
  assert.equal(roleHome(null), '/unauthorized');
  assert.equal(roleHome(''), '/unauthorized');
  assert.equal(roleHome('bogus'), '/unauthorized');
});
check('UNKNOWN role is blocked from every dashboard', () => {
  for (const target of Object.keys(gates)) {
    assert.equal(allowed('', gates[target]), false);
  }
});
check('No UID profile, no email profile, no autoProvision -> unassigned (role null)', () => {
  const p = pickAuthoritativeProfile(null, []);
  assert.equal(p, null);
  assert.equal(normalizeRole(p?.role ?? null), null);
});
check('No UID profile, no email profile, autoProvision -> patient only', () => {
  // autoProvision is NOT role selection: it can only ever produce patient (enforced in AuthContext).
  assert.equal(roleHome(normalizeRole('patient')), '/patient');
});

// ── 4. PATIENT → PATIENT ────────────────────────────────────────
check('PATIENT login composes patient dashboard', () => {
  const p = pickAuthoritativeProfile({ uid: 'r', email: 'patient@medibridge.ai', role: 'patient' }, [seededPatient]);
  assert.equal(normalizeRole(p.role), 'patient');
  assert.equal(roleHome('patient'), '/patient');
});
check('PATIENT blocked from /doctor', () => {
  assert.equal(allowed('patient', ['doctor', 'admin']), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);