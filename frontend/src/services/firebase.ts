import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInAnonymously,
  Auth,
  User as FirebaseUser,
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
} from 'firebase/firestore';

// DataShield Firebase Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB_DataShield_Recovery_2026",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "delete-and-recovery.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "delete-and-recovery",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "delete-and-recovery.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "107401418822",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:107401418822:web:a1b2c3d4e5f6g7h8",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isFirebaseConnected = false;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  isFirebaseConnected = true;
} catch (err) {
  console.warn("Firebase initialization in fallback/offline mode:", err);
  app = null;
  auth = null;
  db = null;
}

export { app, auth, db, isFirebaseConnected };

// Firebase Auth Helpers
export const firebaseAuthService = {
  async loginWithEmail(email: string, pass: string): Promise<FirebaseUser | null> {
    if (!auth) return null;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      return cred.user;
    } catch (error) {
      console.warn("Firebase email login fallback:", error);
      return null;
    }
  },

  async loginAnonymously(): Promise<FirebaseUser | null> {
    if (!auth) return null;
    try {
      const cred = await signInAnonymously(auth);
      return cred.user;
    } catch (error) {
      console.warn("Firebase anon login fallback:", error);
      return null;
    }
  },

  async getIdToken(): Promise<string | null> {
    if (!auth || !auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Firebase logout warning:", err);
    }
  }
};

// Firestore Realtime Audit Sync
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
      await addDoc(collection(db, "audit_logs"), {
        ...event,
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // Non-blocking fallback
    }
  },

  subscribeToLiveAudit(callback: (logs: any[]) => void) {
    if (!db) return () => {};
    try {
      const q = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(50));
      return onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        callback(events);
      }, (err) => {
        console.warn("Firestore audit listener fallback:", err);
      });
    } catch {
      return () => {};
    }
  }
};
