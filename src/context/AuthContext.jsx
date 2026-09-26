import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserProfile, getUserProfileByEmail, saveUserProfile, seedInitialFirestoreData, logAuditEvent } from '../services/firestoreService';
import { loginUser } from '../services/api';
import { pickAuthoritativeProfile, normalizeRole } from '../utils/roleResolution';

const AuthContext = createContext(null);

/**
 * Resolve the application user strictly from server-side (Firestore) profiles.
 *
 * Resolution order:
 *   1. Profile stored under the verified Firebase UID.
 *   2. Profile stored under the verified email (heals UID/profile mismatches,
 *      e.g. provisioned demo staff that predates the Auth UID). An explicit
 *      non-patient role wins over a defaulted patient record.
 *   3. `autoProvision` (Google new-user / session restore): create a Patient
 *      profile — the only self-service role. Privileged roles are NEVER granted
 *      automatically, ever.
 *   4. Otherwise the user is authenticated but UNASSIGNED (role: null) — the
 *      app shows an access-pending state instead of silently becoming a patient.
 *
 * There is NO email-prefix role derivation and no localStorage role authority.
 */
async function hydrateAppUser(fbUser, options = {}) {
  const { autoProvision = false } = options;
  const uid = fbUser.uid;
  const email = fbUser.email || '';
  const displayName = fbUser.displayName || null;

  let profileUid = null;
  try {
    profileUid = await getUserProfile(uid);
  } catch {
    profileUid = null;
  }

  let emailProfiles = [];
  if (email) {
    emailProfiles = await getUserProfileByEmail(email);
  }

  let profile = pickAuthoritativeProfile(profileUid, emailProfiles);

  if (!profile && autoProvision) {
    try {
      profile = await saveUserProfile(uid, {
        email: email || '',
        name: displayName || email.split('@')[0] || 'User',
        role: 'patient',
      });
    } catch {
      profile = null;
    }
  }

  if (!profile) {
    return {
      id: uid,
      uid,
      email: email || '',
      name: displayName || email.split('@')[0] || 'User',
      role: null,
      status: 'Pending Provisioning',
      needsSetup: true,
    };
  }

  const role = normalizeRole(profile.role);

  return {
    id: uid,
    uid,
    email: profile.email || email || '',
    name: profile.name || profile.full_name || displayName || 'User',
    role,
    phone: profile.phone || '',
    patientId: profile.patientId || null,
    doctorId: profile.doctorId || null,
    specialty: profile.specialty || null,
    department: profile.department || null,
    status: profile.status || 'Active',
    needsSetup: !role,
    profileImage: profile.profileImage || '',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('medibridge_user');
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('medibridge_token') || null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    seedInitialFirestoreData();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const appUser = await hydrateAppUser(firebaseUser, { autoProvision: true });
          setUser(appUser);
          localStorage.setItem('medibridge_user', JSON.stringify(appUser));
          const jwtToken = await firebaseUser.getIdToken().catch(() => 'fb-token-' + firebaseUser.uid);
          setToken(jwtToken);
          localStorage.setItem('medibridge_token', jwtToken);
        } catch (err) {
          console.warn('[Firebase Auth] Profile resolution failed:', err.message);
          setUser(null);
          setToken(null);
          localStorage.removeItem('medibridge_user');
          localStorage.removeItem('medibridge_token');
        }
      } else {
        // No live Firebase Auth session: never keep a cached/stale identity alive.
        setUser(null);
        setToken(null);
        localStorage.removeItem('medibridge_user');
        localStorage.removeItem('medibridge_token');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 1. Email / Password Login
  const login = useCallback(async ({ email, password }) => {
    setAuthError(null);
    let fbUser = null;
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      fbUser = userCred.user;
    } catch (fbErr) {
      const code = fbErr?.code || '';

      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        // Demo-friendly provisioning: auto-create the Auth account ONLY when the
        // email maps to an existing provisioned application profile (e.g. seeded
        // demo staff). The role always comes from that profile — never inferred.
        const provisioned = await getUserProfileByEmail(email);
        if (!provisioned || provisioned.length === 0) {
          throw new Error('No account found for this email. Please register to create a patient account.');
        }
        try {
          const createCred = await createUserWithEmailAndPassword(auth, email, password);
          fbUser = createCred.user;
        } catch {
          throw new Error('Authentication failed. Check your credentials and try again.');
        }
      } else {
        throw new Error('Invalid email or password. Access denied.');
      }
    }

    let appUser = null;
    try {
      appUser = await hydrateAppUser(fbUser, { autoProvision: false });
    } catch (err) {
      console.error('[Auth] Profile resolution failed:', err);
      setAuthError('Could not verify your account role. Please try again.');
      throw new Error('Could not verify your account role. Please try again.');
    }

    setUser(appUser);
    localStorage.setItem('medibridge_user', JSON.stringify(appUser));

    try {
      const idToken = await fbUser.getIdToken();
      setToken(idToken);
      localStorage.setItem('medibridge_token', idToken);
    } catch {}

    try {
      await loginUser({ email, password }).catch(() => null);
    } catch {}

    logAuditEvent({
      action: 'USER_LOGIN',
      userId: fbUser.uid,
      userEmail: email,
      userRole: appUser.role,
      status: appUser.role ? 'SUCCESS' : 'PENDING_PROVISIONING',
    });

    return appUser;
  }, []);

  // 2. Register — self-service registration is Patient-only.
  const register = useCallback(async ({ name, email, password, phone = '' }) => {
    setAuthError(null);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      const profile = await saveUserProfile(uid, {
        email,
        name,
        phone,
        role: 'patient',
      });

      const appUser = {
        id: uid,
        uid,
        email,
        name,
        role: 'patient',
        phone,
        patientId: profile.patientId || null,
        status: 'Active',
      };

      setUser(appUser);
      localStorage.setItem('medibridge_user', JSON.stringify(appUser));
      const idToken = await userCred.user.getIdToken();
      setToken(idToken);
      localStorage.setItem('medibridge_token', idToken);

      logAuditEvent({
        action: 'USER_REGISTER',
        userId: uid,
        userEmail: email,
        userRole: 'patient',
        status: 'SUCCESS',
      });

      return appUser;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  // 3. Google OAuth — real flow, identity via Firebase ID token.
  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw err;
    }

    const fbUser = result.user;
    const appUser = await hydrateAppUser(fbUser, { autoProvision: true });
    setUser(appUser);
    localStorage.setItem('medibridge_user', JSON.stringify(appUser));
    const idToken = await fbUser.getIdToken().catch(() => 'fb-token-' + fbUser.uid);
    setToken(idToken);
    localStorage.setItem('medibridge_token', idToken);

    logAuditEvent({
      action: 'GOOGLE_OAUTH_LOGIN',
      userId: fbUser.uid,
      userEmail: fbUser.email,
      userRole: appUser.role,
      status: 'SUCCESS',
    });

    return appUser;
  }, []);

  // 3. Password Reset
  const resetPassword = useCallback(async (email) => {
    if (!email) throw new Error('Email is required');
    await sendPasswordResetEmail(auth, email);
    logAuditEvent({
      action: 'PASSWORD_RESET_REQUEST',
      userEmail: email,
      status: 'INITIATED',
    });
  }, []);

  // 4. Logout
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('SignOut note:', e.message);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('medibridge_token');
    localStorage.removeItem('medibridge_user');
    localStorage.removeItem('medibridge_active_role');
  }, []);

  // 5. 1-Click Role Direct Login (demo) — relies on provisioned Firestore profiles.
  const loginAsDemoRole = useCallback(async (targetRole) => {
    const roleMap = {
      admin: { email: 'prasanth.kum22@gmail.com', pass: 'Admin123!' },
      doctor: { email: 'prasanthanith5@gmail.com', pass: 'Doctor123!' },
      lab: { email: 'lab@medibridge.ai', pass: 'LabTech123!' },
      pharmacist: { email: 'pharmacist@medibridge.ai', pass: 'Pharmacy123!' },
      patient: { email: 'patient@medibridge.ai', pass: 'Patient123!' },
    };
    const cred = roleMap[targetRole.toLowerCase()] || roleMap.doctor;
    return await login({ email: cred.email, password: cred.pass });
  }, [login]);

  const value = {
    user,
    token,
    loading,
    authError,
    isAuthenticated: Boolean(user),
    userRole: user?.role ? user.role.toLowerCase() : null,
    login,
    register,
    signInWithGoogle,
    resetPassword,
    logout,
    loginAsDemoRole,
    setAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;