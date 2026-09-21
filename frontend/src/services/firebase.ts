import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  signInAnonymously,
  onAuthStateChanged,
  Auth,
  User as FirebaseUser,
  AuthError,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Firestore,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';

// ============================================================
// DataShield Firebase Configuration
// Project: delete-and-recovery
// Reads from frontend/.env  →  VITE_FIREBASE_API_KEY etc.
// Get your real values from:
//   Firebase Console → Project Settings → General → Your apps → Config
// ============================================================
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'delete-and-recovery.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'delete-and-recovery',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'delete-and-recovery.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '107401418822',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isFirebaseConnected = false;

try {
  const apiKey = firebaseConfig.apiKey;
  const appId  = firebaseConfig.appId;

  const missingKey = !apiKey || apiKey === 'YOUR_REAL_FIREBASE_API_KEY';
  const missingApp = !appId  || appId  === 'YOUR_REAL_FIREBASE_APP_ID';

  if (missingKey || missingApp) {
    console.warn(
      '⚠️  DataShield: Firebase API key / App ID not configured in frontend/.env.\n' +
      '   → Running in local-only mode (backend JWT auth still works).\n' +
      '   → To enable Firebase Auth + Firestore, set VITE_FIREBASE_API_KEY and VITE_FIREBASE_APP_ID.'
    );
  } else {
    app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db   = getFirestore(app);
    isFirebaseConnected = true;
    console.log('✅ Firebase connected → project:', firebaseConfig.projectId);
  }
} catch (err) {
  console.warn('Firebase initialization fallback (local-only mode):', err);
  app  = null;
  auth = null;
  db   = null;
}

export { app, auth, db, isFirebaseConnected };

// ============================================================
// Firebase Auth Helpers
// ============================================================
export const firebaseAuthService = {
  /**
   * Sign in with email + password.
   * Throws a user-friendly error string on failure.
   */
  async loginWithEmail(email: string, pass: string): Promise<FirebaseUser | null> {
    if (!auth) return null;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      return cred.user;
    } catch (error) {
      throw new Error(_translateFirebaseError(error as AuthError));
    }
  },

  /**
   * Create a new Firebase Auth account and save the profile to Firestore.
   * This is called for every new user registration.
   */
  async registerWithEmail(
    email: string,
    pass: string,
    username: string,
    role: string = 'employee',
    fullName?: string
  ): Promise<FirebaseUser | null> {
    if (!auth) return null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const fbUser = cred.user;

      // Set display name on the Firebase Auth profile
      await updateProfile(fbUser, { displayName: fullName || username }).catch(() => {});

      // Save user profile to Firestore users collection
      if (db) {
        await setDoc(doc(db, 'users', fbUser.uid), {
          uid:        fbUser.uid,
          email:      fbUser.email,
          username,
          role,
          full_name:  fullName || username,
          is_active:  true,
          source:     'firebase_registration',
          createdAt:  serverTimestamp(),
          last_login: serverTimestamp(),
        });
      }

      return fbUser;
    } catch (error) {
      throw new Error(_translateFirebaseError(error as AuthError));
    }
  },

  /**
   * Sign in anonymously (fallback).
   */
  async loginAnonymously(): Promise<FirebaseUser | null> {
    if (!auth) return null;
    try {
      const cred = await signInAnonymously(auth);
      return cred.user;
    } catch {
      return null;
    }
  },

  /**
   * Get current Firebase ID token (refreshed if needed).
   */
  async getIdToken(): Promise<string | null> {
    if (!auth?.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken(false);
    } catch {
      return null;
    }
  },

  /** Sign out. */
  async logout(): Promise<void> {
    if (!auth) return;
    try { await signOut(auth); } catch (err) { console.warn('Firebase logout:', err); }
  },

  /** Subscribe to Firebase Auth state changes. Returns unsubscribe function. */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
  },

  /** Synchronous current user. */
  getCurrentUser(): FirebaseUser | null {
    return auth?.currentUser ?? null;
  },
};

// ============================================================
// Firestore — User session sync
// ============================================================
export const firestoreUserSync = {
  /**
   * Merge the login session data into the user's Firestore doc.
   * Called after every successful login.
   */
  async syncLoginSession(uid: string, userData: {
    username:   string;
    email:      string;
    role:       string;
    full_name?: string;
    backendId?: string;
  }): Promise<void> {
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          uid,
          ...userData,
          last_login: serverTimestamp(),
          is_active:  true,
          source:     'frontend_login',
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore session sync (non-blocking):', err);
    }
  },

  /** Fetch a user document from Firestore. */
  async getUserDoc(uid: string): Promise<Record<string, any> | null> {
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? snap.data() : null;
    } catch {
      return null;
    }
  },
};

// ============================================================
// Demo User Seeding
// Creates all demo users in Firebase Auth so they can sign in.
// Call this ONCE from the admin panel or run it from the browser console.
// ============================================================
export type DemoSeedResult = {
  email: string;
  status: 'created' | 'already_exists' | 'failed';
  error?: string;
};

export const DEMO_FIREBASE_USERS: Array<{
  email: string; password: string; username: string;
  role: string; fullName: string;
}> = [
  { email: 'admin@datashield.sih',      password: 'adminpassword123', username: 'admin',            role: 'admin',            fullName: 'Chief Security Officer'     },
  { email: 'it_sec@datashield.sih',     password: 'secadminpass123',  username: 'security_admin',   role: 'security_admin',   fullName: 'IT & Security Administrator' },
  { email: 'analyst@datashield.sih',    password: 'analystpass123',   username: 'forensic_analyst', role: 'forensic_analyst', fullName: 'Digital Forensics Analyst'   },
  { email: 'compliance@datashield.sih', password: 'auditorpass123',   username: 'auditor',          role: 'auditor',          fullName: 'Compliance Auditor'          },
  { email: 'demo@datashield.sih',       password: 'demouserpass123',  username: 'demo_user',        role: 'demo_user',        fullName: 'Demo User (Evaluation)'      },
  { email: 'sridharan@datashield.sih',  password: 'employee123',      username: 'sridharan',        role: 'employee',         fullName: 'Enterprise Employee'         },
];

export async function seedDemoUsersToFirebase(): Promise<DemoSeedResult[]> {
  if (!auth) {
    console.warn('Firebase not connected — cannot seed demo users.');
    return [];
  }

  const results: DemoSeedResult[] = [];

  for (const u of DEMO_FIREBASE_USERS) {
    try {
      // Try to create the account
      const cred = await createUserWithEmailAndPassword(auth, u.email, u.password);
      const fbUser = cred.user;

      await updateProfile(fbUser, { displayName: u.fullName }).catch(() => {});

      // Save to Firestore
      if (db) {
        await setDoc(doc(db, 'users', fbUser.uid), {
          uid:        fbUser.uid,
          email:      u.email,
          username:   u.username,
          role:       u.role,
          full_name:  u.fullName,
          is_active:  true,
          source:     'demo_seed',
          createdAt:  serverTimestamp(),
          last_login: null,
        });
      }

      results.push({ email: u.email, status: 'created' });
      console.log(`✅ Created Firebase Auth user: ${u.email}`);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        results.push({ email: u.email, status: 'already_exists' });
        console.log(`ℹ️  Already exists: ${u.email}`);
      } else {
        results.push({ email: u.email, status: 'failed', error: err.message });
        console.warn(`❌ Failed to create ${u.email}:`, err.message);
      }
    }
  }

  // Sign out the last created/signed-in user (seed runs as anonymous)
  await signOut(auth).catch(() => {});
  return results;
}

// ============================================================
// Firestore — Realtime Audit Sync
// ============================================================
export const firebaseAuditSync = {
  async logAuditEvent(event: {
    action: string;
    username: string;
    role: string;
    target_resource: string;
    status: string;
    sha256_checksum: string;
  }) {
    if (!db) return;
    try {
      await addDoc(collection(db, 'audit_logs'), {
        ...event,
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString(),
      });
    } catch { /* non-blocking */ }
  },

  subscribeToLiveAudit(callback: (logs: any[]) => void) {
    if (!db) return () => {};
    try {
      const q = query(
        collection(db, 'audit_logs'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      return onSnapshot(q,
        (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err)  => console.warn('Firestore audit listener:', err)
      );
    } catch {
      return () => {};
    }
  },
};

// ============================================================
// Internal: Firebase error → human readable message
// ============================================================
function _translateFirebaseError(error: AuthError): string {
  switch (error.code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'No account found. Please register first or check your credentials.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-email':
      return 'The email address format is invalid.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your administrator.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Try again in a few minutes.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.';
    default:
      return error.message || 'Firebase authentication error.';
  }
}
