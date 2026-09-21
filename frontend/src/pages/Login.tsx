import React, { useState } from 'react';
import {
  Shield, Lock, User, ArrowRight, Sparkles, KeyRound,
  Eye, EyeOff, ChevronRight, WifiOff, CheckCircle2,
  AlertCircle, Mail, UserPlus, Zap, RefreshCw,
} from 'lucide-react';
import { useAuth, DEMO_PRESETS } from '../context/AuthContext';
import { seedDemoUsersToFirebase, isFirebaseConnected, DEMO_FIREBASE_USERS } from '../services/firebase';
import { Role } from '../types';

// ──────────────────────────────────────────────────────────
// Small sub-components for field labels and inputs
// ──────────────────────────────────────────────────────────
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label style={{
    display: 'block',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontWeight: 700, fontSize: 10,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: '#5E6676', marginBottom: 5,
  }}>
    {children}
  </label>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1.5px solid #E2E8F0',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontSize: 13, fontWeight: 500,
  color: '#1E2229',
  background: '#FAFBFC',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

// ──────────────────────────────────────────────────────────
// Role descriptions for register dropdown
// ──────────────────────────────────────────────────────────
const ROLE_OPTIONS: { value: Role; label: string; desc: string; color: string }[] = [
  { value: 'employee',         label: 'Employee',               desc: 'File upload & lifecycle management',       color: '#8B5CF6' },
  { value: 'forensic_analyst', label: 'Forensic Analyst',       desc: 'Recovery, storage analysis & reporting',   color: '#D97706' },
  { value: 'auditor',          label: 'Compliance Auditor',     desc: 'Audit logs, blockchain & reports (read)',   color: '#16A34A' },
  { value: 'security_admin',   label: 'IT / Security Admin',    desc: 'Erasure, verification & vault governance',  color: '#FF7E5F' },
  { value: 'admin',            label: 'Administrator',          desc: 'Full system access + user management',      color: '#EF4444' },
  { value: 'demo_user',        label: 'SIH Judge / Demo User',  desc: 'Broad evaluation access for demos',         color: '#2563EB' },
];

const ROLE_ACCENT: Record<Role, string> = {
  admin: '#EF4444', security_admin: '#FF7E5F', forensic_analyst: '#D97706',
  auditor: '#16A34A', demo_user: '#2563EB', employee: '#8B5CF6',
};

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────
export const Login: React.FC = () => {
  const { login, register, quickLogin, isLoading, firebaseConnected } = useAuth();

  type Tab = 'login' | 'register' | 'demo';
  const [tab, setTab] = useState<Tab>('login');

  // Login state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('adminpassword123');
  const [showPass, setShowPass] = useState(false);

  // Register state
  const [regFullName, setRegFullName]   = useState('');
  const [regUsername, setRegUsername]   = useState('');
  const [regEmail, setRegEmail]         = useState('');
  const [regPassword, setRegPassword]   = useState('');
  const [regShowPass, setRegShowPass]   = useState(false);
  const [regRole, setRegRole]           = useState<Role>('employee');
  const [regSuccess, setRegSuccess]     = useState<{ username: string; email: string } | null>(null);

  // Seed state
  const [seeding, setSeeding]           = useState(false);
  const [seedResults, setSeedResults]   = useState<Array<{ email: string; status: string }> | null>(null);

  const [error, setError] = useState<string | null>(null);

  // ── Handlers ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regUsername.trim() || !regEmail.trim() || !regPassword.trim()) {
      setError('Please fill in all required fields (*).');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters (Firebase Auth minimum).');
      return;
    }
    try {
      await register(regUsername.trim(), regEmail.trim(), regPassword, regRole, regFullName.trim() || undefined);
      setRegSuccess({ username: regUsername.trim(), email: regEmail.trim() });
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    }
  };

  const handleSeedDemoUsers = async () => {
    setSeeding(true);
    setSeedResults(null);
    setError(null);
    try {
      const results = await seedDemoUsersToFirebase();
      setSeedResults(results);
    } catch (err: any) {
      setError('Seeding failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSeeding(false);
    }
  };

  // ── Tab config ──
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'login',    label: 'Login',    icon: <KeyRound size={11} /> },
    { id: 'register', label: 'Register', icon: <UserPlus size={11} /> },
    { id: 'demo',     label: 'Demo',     icon: <Sparkles size={11} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#FAF8F5' }}>

      {/* ── Left Panel: Branding ── */}
      <div style={{
        width: '50%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '56px 64px',
        position: 'relative', overflow: 'hidden',
        background: '#FAF8F5', borderRight: '1px solid #E8E4DF',
      }}>
        {/* Soft glow orbs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: 550, height: 550, background: 'radial-gradient(ellipse, rgba(255,126,95,0.12) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 500, height: 500, background: 'radial-gradient(ellipse, rgba(254,180,123,0.14) 0%, transparent 65%)' }} />
        </div>

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: 'linear-gradient(135deg,#FF7E5F 0%,#FEB47B 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(255,126,95,0.35)',
          }}>
            <Shield size={24} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: '#1E2229' }}>
              DataShield
            </div>
            <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#FF7E5F', textTransform: 'uppercase' }}>
              SIH 2026 · Problem Statement SIH26149
            </div>
          </div>
        </div>

        {/* Hero */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 14,
            background: 'rgba(255,126,95,0.12)', border: '1px solid rgba(255,126,95,0.25)',
            color: '#FF7E5F', fontFamily: 'Plus Jakarta Sans,sans-serif',
            fontWeight: 800, fontSize: 11, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 16,
          }}>
            <Sparkles size={12} /> Cybersecurity / Data Security Platform
          </div>

          <h1 style={{
            fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800,
            fontSize: 48, letterSpacing: '-0.03em', lineHeight: 1.15,
            color: '#1E2229', marginBottom: 20,
          }}>
            AI-Assisted<br />
            <span style={{ background: 'linear-gradient(135deg,#FF7E5F 0%,#FEB47B 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Secure Data Erasure
            </span><br />
            &amp; File Recovery
          </h1>

          <p style={{ color: '#5E6676', fontSize: 15, lineHeight: 1.7, maxWidth: 440 }}>
            <strong>DETECT → ANALYZE → RECOVER / ERASE → VERIFY → REPORT</strong><br />
            Storage-aware sanitization with cryptographic verification and immutable SHA-256 audit trails.
          </p>

          {/* Feature bullets */}
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '🔐', text: 'Accounts stored in Firebase Authentication' },
              { icon: '🗄️', text: 'User profiles synced to Firestore in real time' },
              { icon: '🛡️', text: 'Role-Based Access Control (RBAC) with granular permissions' },
              { icon: '📋', text: 'Immutable SHA-256 audit blockchain' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, color: '#3D4451', fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tech badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, position: 'relative', zIndex: 1 }}>
          {['NIST SP 800-88 Rev. 2', 'Firebase Auth', 'Firestore RBAC', 'SHA-256 Chain', 'Magic-Byte Carving'].map(t => (
            <span key={t} style={{
              padding: '4px 10px', borderRadius: 14,
              background: '#E6EFFB', color: '#2B579A',
              border: '1px solid #D0E0F7',
              fontSize: 11, fontWeight: 700,
              fontFamily: 'Plus Jakarta Sans,sans-serif',
            }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right Panel: Auth Card ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', overflowY: 'auto' }}>
        <div style={{
          width: '100%', maxWidth: 460,
          padding: '36px 36px 28px',
          borderRadius: 18, background: '#FFFFFF',
          boxShadow: '0 20px 60px -10px rgba(30,34,41,0.10), 0 4px 16px -2px rgba(30,34,41,0.04)',
          border: '1px solid #EEE9E2',
        }}>

          {/* Heading */}
          <div style={{ marginBottom: 6 }}>
            <h2 style={{
              fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800,
              fontSize: 24, letterSpacing: '-0.02em', color: '#1E2229', margin: 0,
            }}>
              {tab === 'login'    ? 'Operator Access' :
               tab === 'register' ? 'Create Account' : 'Demo Users'}
            </h2>
            <p style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', color: '#6B7280', fontSize: 13, margin: '6px 0 0' }}>
              {tab === 'login'    ? 'Authenticate to enter the Security Operations Center' :
               tab === 'register' ? 'Registers in Firebase Authentication + DataShield RBAC' :
               'One-click access — seeded directly into Firebase Auth'}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 4, padding: 4, marginTop: 20, marginBottom: 22,
            background: '#F5F1EC', borderRadius: 14, border: '1px solid #EEE9E2',
          }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTab(t.id); setError(null); setSeedResults(null); setRegSuccess(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '8px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11.5, fontWeight: 700,
                    transition: 'all 0.15s',
                    background: active ? 'linear-gradient(135deg,#FF7E5F 0%,#FEB47B 100%)' : 'transparent',
                    color: active ? '#fff' : '#6B7280',
                    boxShadow: active ? '0 4px 12px rgba(255,126,95,0.3)' : 'none',
                  }}
                >
                  {t.icon} {t.label}
                </button>
              );
            })}
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)',
              borderRadius: 12, padding: '10px 14px', marginBottom: 16,
              color: '#DC2626', fontSize: 12.5, fontWeight: 600,
              fontFamily: 'Plus Jakarta Sans,sans-serif',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* ── LOGIN TAB ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div>
                <FieldLabel>Username</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <User size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    placeholder="admin"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                    onFocus={e => (e.target.style.borderColor = '#FF7E5F')}
                    onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Password</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingLeft: 36, paddingRight: 42 }}
                    onFocus={e => (e.target.style.borderColor = '#FF7E5F')}
                    onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 14, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, fontSize: 13.5,
                  background: isLoading ? '#CBD5E1' : 'linear-gradient(135deg,#FF7E5F 0%,#FEB47B 100%)',
                  color: '#fff', boxShadow: isLoading ? 'none' : '0 6px 20px rgba(255,126,95,0.35)',
                  transition: 'all 0.2s', marginTop: 4,
                }}
              >
                {isLoading ? (
                  <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Authenticating…</>
                ) : (
                  <>Access DataShield <ArrowRight size={15} /></>
                )}
              </button>

              <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11.5, margin: 0, fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                New user?{' '}
                <button type="button" onClick={() => { setTab('register'); setError(null); }}
                  style={{ background: 'none', border: 'none', color: '#FF7E5F', cursor: 'pointer', fontWeight: 700, fontSize: 11.5, fontFamily: 'Plus Jakarta Sans,sans-serif', padding: 0 }}>
                  Create an account →
                </button>
              </p>
            </form>
          )}

          {/* ── REGISTER TAB ── */}
          {tab === 'register' && !regSuccess && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

              {/* Firebase badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
                borderRadius: 10, background: 'rgba(255,126,95,0.07)', border: '1px solid rgba(255,126,95,0.2)',
                fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11, fontWeight: 700, color: '#C2410C',
              }}>
                <Zap size={12} />
                Account will be created in <strong>Firebase Authentication</strong> (project: delete-and-recovery)
              </div>

              <div>
                <FieldLabel>Full Name</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <User size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    id="reg-fullname"
                    type="text"
                    value={regFullName}
                    onChange={e => setRegFullName(e.target.value)}
                    placeholder="e.g. Sridharan V."
                    style={{ ...inputStyle, paddingLeft: 36 }}
                    onFocus={e => (e.target.style.borderColor = '#FF7E5F')}
                    onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Username *</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <User size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    id="reg-username"
                    type="text"
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    required
                    placeholder="e.g. sridharan_v"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                    onFocus={e => (e.target.style.borderColor = '#FF7E5F')}
                    onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Email Address *</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    required
                    placeholder="e.g. sridharan@datashield.sih"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                    onFocus={e => (e.target.style.borderColor = '#FF7E5F')}
                    onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Password * (min. 6 chars)</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    id="reg-password"
                    type={regShowPass ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••••"
                    style={{ ...inputStyle, paddingLeft: 36, paddingRight: 42 }}
                    onFocus={e => (e.target.style.borderColor = '#FF7E5F')}
                    onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
                  />
                  <button type="button" onClick={() => setRegShowPass(!regShowPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                    {regShowPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Role selector */}
              <div>
                <FieldLabel>Role / Access Level</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {ROLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRegRole(opt.value)}
                      style={{
                        padding: '9px 11px', borderRadius: 10, cursor: 'pointer',
                        border: regRole === opt.value ? `2px solid ${opt.color}` : '1.5px solid #E2E8F0',
                        background: regRole === opt.value ? `${opt.color}10` : '#FAFBFC',
                        textAlign: 'left', transition: 'all 0.14s',
                      }}
                    >
                      <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 11.5, color: regRole === opt.value ? opt.color : '#1E2229' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 10, color: '#94A3B8', marginTop: 2, lineHeight: 1.3 }}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                id="register-submit-btn"
                disabled={isLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 14, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, fontSize: 13,
                  background: isLoading ? '#CBD5E1' : 'linear-gradient(135deg,#FF7E5F 0%,#FEB47B 100%)',
                  color: '#fff', boxShadow: isLoading ? 'none' : '0 6px 20px rgba(255,126,95,0.35)',
                  transition: 'all 0.2s', marginTop: 4,
                }}
              >
                {isLoading ? (
                  <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Creating Firebase Account…</>
                ) : (
                  <>Register to Firebase Auth &amp; System <ArrowRight size={15} /></>
                )}
              </button>
            </form>
          )}

          {/* ── REGISTER SUCCESS STATE ── */}
          {tab === 'register' && regSuccess && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '12px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(22,163,74,0.1)', border: '2px solid rgba(22,163,74,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 0.4s ease',
              }}>
                <CheckCircle2 size={32} color="#16A34A" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, fontSize: 18, color: '#1E2229' }}>
                  Account Created Successfully!
                </div>
                <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 12.5, color: '#5E6676', marginTop: 6 }}>
                  <strong>{regSuccess.email}</strong> is now registered in<br />
                  Firebase Authentication &amp; DataShield RBAC.
                </div>
                <div style={{
                  marginTop: 12, padding: '8px 14px', borderRadius: 10,
                  background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)',
                  fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11.5, color: '#166534', fontWeight: 600,
                }}>
                  ✅ You are now signed in as <strong>{regSuccess.username}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setRegSuccess(null); setTab('login'); }}
                style={{
                  padding: '10px 22px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 13,
                  background: 'linear-gradient(135deg,#FF7E5F 0%,#FEB47B 100%)', color: '#fff',
                  boxShadow: '0 4px 14px rgba(255,126,95,0.3)',
                }}
              >
                Go to Dashboard →
              </button>
            </div>
          )}

          {/* ── DEMO USERS TAB ── */}
          {tab === 'demo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', color: '#5E6676', fontSize: 12, margin: 0 }}>
                One-click access with pre-configured role accounts:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: '36vh', overflowY: 'auto', paddingRight: 2 }}>
                {(Object.keys(DEMO_PRESETS) as Role[]).map(roleKey => {
                  const preset = DEMO_PRESETS[roleKey];
                  const accent = ROLE_ACCENT[roleKey];
                  return (
                    <button
                      key={roleKey}
                      type="button"
                      onClick={() => { setError(null); quickLogin(roleKey); }}
                      disabled={isLoading}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                        background: '#FAF8F5', border: '1.5px solid #E8E4DF',
                        transition: 'all 0.14s', textAlign: 'left',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = accent;
                        (e.currentTarget as HTMLElement).style.background = '#fff';
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${accent}20`;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#E8E4DF';
                        (e.currentTarget as HTMLElement).style.background = '#FAF8F5';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 13, color: '#1E2229' }}>
                          {preset.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                          {preset.roleName}
                          <span style={{ marginLeft: 8, opacity: 0.6 }}>·</span>
                          <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>{preset.email}</span>
                        </div>
                      </div>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: `${accent}14`, border: `1px solid ${accent}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <ChevronRight size={14} color={accent} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Seed Demo Users to Firebase */}
              <div style={{
                marginTop: 8, padding: '12px 14px', borderRadius: 12,
                background: '#F5F1EC', border: '1.5px dashed #D8D0C6',
              }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 12, color: '#3D4451', marginBottom: 4 }}>
                  🔥 First-time setup: Seed demo users to Firebase Auth
                </div>
                <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11, color: '#6B7280', marginBottom: 10, lineHeight: 1.5 }}>
                  Click below to bulk-create all {DEMO_FIREBASE_USERS.length} demo accounts in your Firebase project{' '}
                  <strong>delete-and-recovery</strong>. Run this once — it's safe to re-run (skips existing accounts).
                </div>

                {!isFirebaseConnected && (
                  <div style={{ fontSize: 11, color: '#B45309', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 600, marginBottom: 8 }}>
                    ⚠️ Firebase not connected — add your API key to frontend/.env first
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSeedDemoUsers}
                  disabled={seeding || !isFirebaseConnected}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 16px', borderRadius: 10, border: 'none',
                    cursor: (seeding || !isFirebaseConnected) ? 'not-allowed' : 'pointer',
                    fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 12,
                    background: (seeding || !isFirebaseConnected) ? '#E2E8F0' : 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%)',
                    color: (seeding || !isFirebaseConnected) ? '#94A3B8' : '#fff',
                    boxShadow: (!seeding && isFirebaseConnected) ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {seeding ? (
                    <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Seeding Firebase…</>
                  ) : (
                    <><Zap size={13} /> Seed {DEMO_FIREBASE_USERS.length} Demo Users to Firebase Auth</>
                  )}
                </button>

                {/* Seed results */}
                {seedResults && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {seedResults.map(r => (
                      <div key={r.email} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11,
                        color: r.status === 'created' ? '#166534' : r.status === 'already_exists' ? '#1D4ED8' : '#DC2626',
                      }}>
                        <span>{r.status === 'created' ? '✅' : r.status === 'already_exists' ? 'ℹ️' : '❌'}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{r.email}</span>
                        <span style={{ opacity: 0.7 }}>— {r.status === 'created' ? 'Created' : r.status === 'already_exists' ? 'Already exists' : 'Failed'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Footer Status ── */}
          <div style={{
            marginTop: 24, paddingTop: 16, borderTop: '1px solid #EEE9E2',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 8,
                background: firebaseConnected ? 'rgba(22,163,74,0.08)' : 'rgba(245,158,11,0.08)',
                border: firebaseConnected ? '1px solid rgba(22,163,74,0.2)' : '1px solid rgba(245,158,11,0.2)',
                color: firebaseConnected ? '#16A34A' : '#B45309',
                fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700,
                fontSize: 10, letterSpacing: '0.04em',
              }}>
                {firebaseConnected
                  ? <><CheckCircle2 size={10} /> Firebase Auth Active — delete-and-recovery</>
                  : <><WifiOff size={10} /> Local Mode — Backend JWT Only</>}
              </span>
              <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                NIST SP 800-88 Rev. 2
              </span>
            </div>

            {!firebaseConnected && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 6,
                padding: '7px 10px', borderRadius: 9,
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
                color: '#92400E', fontSize: 10.5, lineHeight: 1.5,
                fontFamily: 'Plus Jakarta Sans,sans-serif',
              }}>
                <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  To enable Firebase Auth, set{' '}
                  <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '0 3px', borderRadius: 3 }}>VITE_FIREBASE_API_KEY</code>
                  {' '}and{' '}
                  <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '0 3px', borderRadius: 3 }}>VITE_FIREBASE_APP_ID</code>
                  {' '}in <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '0 3px', borderRadius: 3 }}>frontend/.env</code>, then restart the dev server.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};
