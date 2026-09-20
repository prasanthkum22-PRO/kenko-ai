import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ─── Firebase Configuration ───────────────────────────────────
// Config values come from environment variables in production.
// Fallback to the project config for development.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyAzD406p1EA8ptgFtpQaam1S_hQMCUkfw0",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "kenko-ai-4edb8.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "kenko-ai-4edb8",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "kenko-ai-4edb8.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "309809466320",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:309809466320:web:4ba6e53a319507fa1707d5",
};

// ─── Initialize Firebase ──────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db };
export default app;
