import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { User, Role } from '../types';
import { api } from '../services/api';
import { firebaseAuthService, firestoreUserSync, isFirebaseConnected } from '../services/firebase';

// ============================================================
// Types
// ============================================================
interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  permissions: string[];
  token: string | null;
  isLoading: boolean;
  firebaseConnected: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role?: Role, fullName?: string) => Promise<void>;
  quickLogin: (roleKey: Role) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================
// Demo Presets — maps username → {email, password, role...}
// ============================================================
export const DEMO_PRESETS: Record<Role, {
  username: string;
  email: string;
  label: string;
  roleName: string;
  pass: string;
}> = {
  admin:            { username: 'admin',            email: 'admin@datashield.sih',      label: 'Admin',      roleName: 'Chief Security Officer',      pass: 'adminpassword123' },
  security_admin:   { username: 'security_admin',   email: 'it_sec@datashield.sih',     label: 'IT SecOps',  roleName: 'IT & Security Administrator',  pass: 'secadminpass123'  },
  forensic_analyst: { username: 'forensic_analyst', email: 'analyst@datashield.sih',    label: 'Forensics',  roleName: 'Digital Forensics Analyst',    pass: 'analystpass123'   },
  auditor:          { username: 'auditor',          email: 'compliance@datashield.sih', label: 'Auditor',    roleName: 'Compliance Auditor',           pass: 'auditorpass123'   },
  demo_user:        { username: 'demo_user',        email: 'demo@datashield.sih',       label: 'Demo User',  roleName: 'Demo User (Evaluation)',       pass: 'demouserpass123'  },
  employee:         { username: 'sridharan',        email: 'sridharan@datashield.sih',  label: 'Employee',   roleName: 'Enterprise Employee',          pass: 'employee123'      },
};

// Build a reverse lookup: email → preset (used to get password for Firebase login)
const EMAIL_TO_PRESET = Object.values(DEMO_PRESETS).reduce(
  (acc, p) => { acc[p.email.toLowerCase()] = p; return acc; },
  {} as Record<string, typeof DEMO_PRESETS[Role]>
);

// ============================================================
// AuthProvider
// ============================================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,         setUser]         = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [permissions,  setPermissions]  = useState<string[]>([]);
  const [token,        setToken]        = useState<string | null>(
    () => localStorage.getItem('datashield_token')
  );
  const [isLoading, setIsLoading] = useState(true);
  const initDone = useRef(false);

  // ------------------------------------------------------------------
  // On mount: restore session from stored JWT + Firebase auth listener
  // ------------------------------------------------------------------
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('datashield_token');
      if (storedToken) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          setPermissions(res.permissions);
        } catch {
          localStorage.removeItem('datashield_token');
          localStorage.removeItem('firebase_token');
          setToken(null);
          setUser(null);
          setPermissions([]);
        }
      }
      initDone.current = true;
      setIsLoading(false);
    };

    initAuth();

    // Firebase Auth state listener — keeps Firebase session in sync
    const unsubscribe = firebaseAuthService.onAuthStateChanged(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken(false);
          localStorage.setItem('firebase_token', idToken);
        } catch { /* non-critical */ }
      } else {
        localStorage.removeItem('firebase_token');
      }
    });

    return () => unsubscribe();
  }, []);

  // ------------------------------------------------------------------
  // _syncFirebaseLogin — internal helper
  // Tries to sign in to Firebase with the given email + password.
  // If the user doesn't exist in Firebase yet (user was created only in
  // the backend), it creates them first then signs in.
  // Never throws — always returns gracefully.
  // ------------------------------------------------------------------
  const _syncFirebaseLogin = async (
    email: string,
    password: string,
    username: string,
    role: string,
    fullName: string,
    backendId: string,
  ): Promise<void> => {
    if (!isFirebaseConnected) return;
    try {
      let fbUser: FirebaseUser | null = null;

      try {
        // Attempt normal sign-in first
        fbUser = await firebaseAuthService.loginWithEmail(email, password);
      } catch (signInErr: any) {
        // If the user doesn't exist in Firebase, create them silently
        const isNotFound = signInErr.message?.toLowerCase().includes('no account found') ||
                           signInErr.message?.toLowerCase().includes('invalid credential');
        if (isNotFound) {
          try {
            fbUser = await firebaseAuthService.registerWithEmail(email, password, username, role, fullName);
            console.log(`✅ Auto-created Firebase Auth account for ${email}`);
          } catch (createErr: any) {
            console.warn(`Firebase auto-create failed for ${email}:`, createErr.message);
          }
        } else {
          console.warn(`Firebase sign-in for ${email}:`, signInErr.message);
        }
      }

      if (fbUser) {
        setFirebaseUser(fbUser);
        const fbToken = await fbUser.getIdToken();
        localStorage.setItem('firebase_token', fbToken);

        // Sync session to Firestore
        await firestoreUserSync.syncLoginSession(fbUser.uid, {
          username, email, role, full_name: fullName, backendId,
        });
      }
    } catch (err: any) {
      // Non-critical — don't block the user
      console.warn('Firebase sync (non-blocking):', err.message);
    }
  };

  // ------------------------------------------------------------------
  // login
  // ------------------------------------------------------------------
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      // Step 1: Backend authentication (primary — blocking)
      const res = await api.login(username, password);
      localStorage.setItem('datashield_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);

      // Fetch permissions in parallel without holding up the UI further
      api.getMe().then(meRes => setPermissions(meRes.permissions)).catch(() => {});

      // Step 2: Firebase sync — fully fire-and-forget, never blocks login
      _syncFirebaseLogin(
        res.user.email,
        password,
        res.user.username,
        res.user.role,
        res.user.full_name || res.user.username,
        res.user.id,
      );
    } finally {
      // Release loading state immediately after backend auth succeeds
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // register
  // Creates account in BOTH Firebase Auth AND backend.
  // Firebase Auth registration errors ARE surfaced to the user.
  // ------------------------------------------------------------------
  const register = async (
    username: string,
    email: string,
    password: string,
    role: Role = 'employee',
    fullName?: string,
  ) => {
    setIsLoading(true);
    try {
      // ── Step 1: Firebase Auth registration (if Firebase is connected) ──
      // This is the primary action — data MUST reach Firebase Auth first.
      if (isFirebaseConnected) {
        let fbUser: FirebaseUser | null = null;
        try {
          fbUser = await firebaseAuthService.registerWithEmail(
            email, password, username, role, fullName
          );
        } catch (fbErr: any) {
          const msg = fbErr.message || '';
          if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('already in use')) {
            // Account already exists in Firebase — try to sign in instead
            try {
              fbUser = await firebaseAuthService.loginWithEmail(email, password);
              console.log(`ℹ️ Firebase: account already exists for ${email}, signed in.`);
            } catch {
              // Wrong password for existing account — this is a real error
              throw new Error(
                `An account with email ${email} already exists in Firebase. ` +
                `Use a different email or log in instead.`
              );
            }
          } else {
            // Real Firebase error (e.g., auth/operation-not-allowed, network error)
            // Surface it to the user so they know Firebase registration failed.
            throw new Error(`Firebase Auth: ${msg}`);
          }
        }

        if (fbUser) {
          setFirebaseUser(fbUser);
          const fbToken = await fbUser.getIdToken();
          localStorage.setItem('firebase_token', fbToken);
          console.log(`✅ Firebase Auth: account created/found for ${email} (uid: ${fbUser.uid})`);
        }
      } else {
        // Firebase not connected — warn in console but don't block registration
        console.warn(
          `⚠️ Firebase not connected: ${email} will only be registered in the backend database. ` +
          `Set VITE_FIREBASE_API_KEY in frontend/.env to enable Firebase Auth storage.`
        );
      }

      // ── Step 2: Backend registration ──
      // This always runs regardless of Firebase state.
      await api.register(username, email, password, role, fullName || username);

      // ── Step 3: Auto-login ──
      await login(username, password);
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // quickLogin — one-click demo preset
  // ------------------------------------------------------------------
  const quickLogin = async (roleKey: Role) => {
    const preset = DEMO_PRESETS[roleKey];
    if (preset) {
      await login(preset.username, preset.pass);
    }
  };

  // ------------------------------------------------------------------
  // logout
  // ------------------------------------------------------------------
  const logout = async () => {
    // Clear local state immediately — don't wait on network calls
    localStorage.removeItem('datashield_token');
    localStorage.removeItem('firebase_token');
    setUser(null);
    setFirebaseUser(null);
    setToken(null);
    setPermissions([]);
    // Fire backend + Firebase logout in background (non-blocking)
    Promise.allSettled([
      api.logout(),
      firebaseAuthService.logout(),
    ]);
  };

  // ------------------------------------------------------------------
  // hasPermission
  // ------------------------------------------------------------------
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user, firebaseUser, permissions, token, isLoading,
        firebaseConnected: isFirebaseConnected,
        login, register, quickLogin, logout, hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
