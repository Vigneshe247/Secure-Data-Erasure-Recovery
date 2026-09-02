import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { api } from '../services/api';
import { firebaseAuthService, isFirebaseConnected } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  permissions: string[];
  token: string | null;
  isLoading: boolean;
  firebaseConnected: boolean;
  login: (username: string, password: string) => Promise<void>;
  quickLogin: (roleKey: Role) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_PRESETS: Record<Role, { username: string; email: string; label: string; roleName: string; pass: string }> = {
  admin: { username: 'admin', email: 'admin@datashield.sih', label: 'Admin', roleName: 'Chief Security Officer', pass: 'adminpassword123' },
  security_admin: { username: 'security_admin', email: 'it_sec@datashield.sih', label: 'IT SecOps', roleName: 'IT & Security Administrator', pass: 'secadminpass123' },
  forensic_analyst: { username: 'forensic_analyst', email: 'analyst@datashield.sih', label: 'Forensics', roleName: 'Digital Forensics Analyst', pass: 'analystpass123' },
  auditor: { username: 'auditor', email: 'compliance@datashield.sih', label: 'Auditor', roleName: 'Compliance Auditor', pass: 'auditorpass123' },
  demo_user: { username: 'demo_user', email: 'demo@datashield.sih', label: 'Demo User', roleName: 'Demo User (Evaluation)', pass: 'demouserpass123' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('datashield_token'));
  const [isLoading, setIsLoading] = useState(true);

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
          setToken(null);
          setUser(null);
          setPermissions([]);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      // 1. Authenticate with DataShield Core Backend
      const res = await api.login(username, password);
      localStorage.setItem('datashield_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      const meRes = await api.getMe();
      setPermissions(meRes.permissions);

      // 2. Sync with Firebase Auth in background
      const matchingPreset = Object.values(DEMO_PRESETS).find(p => p.username === username);
      const email = matchingPreset?.email || `${username}@datashield.sih`;
      const fbUser = await firebaseAuthService.loginWithEmail(email, password);
      if (fbUser) {
        try {
          const fbToken = await fbUser.getIdToken();
          localStorage.setItem('firebase_token', fbToken);
        } catch {
          // ignore
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (roleKey: Role) => {
    const preset = DEMO_PRESETS[roleKey];
    if (preset) {
      await login(preset.username, preset.pass);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      await firebaseAuthService.logout();
    } finally {
      localStorage.removeItem('firebase_token');
      setUser(null);
      setToken(null);
      setPermissions([]);
      setIsLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        token,
        isLoading,
        firebaseConnected: isFirebaseConnected,
        login,
        quickLogin,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
