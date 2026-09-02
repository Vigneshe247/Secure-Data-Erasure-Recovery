import React, { useState } from 'react';
import {
  Shield, Lock, User, ArrowRight, Sparkles, Cloud, KeyRound,
  Eye, EyeOff, ChevronRight,
} from 'lucide-react';
import { useAuth, DEMO_PRESETS } from '../context/AuthContext';
import { Role } from '../types';

export const Login: React.FC = () => {
  const { login, quickLogin, isLoading, firebaseConnected } = useAuth();
  const [authMode, setAuthMode] = useState<'credentials' | 'sih_presets'>('credentials');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('adminpassword123');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    }
  };

  const roleAccents: Record<Role, string> = {
    admin:            '#EF4444',
    security_admin:   '#FF7E5F',
    forensic_analyst: '#D97706',
    auditor:          '#16A34A',
    demo_user:        '#2563EB',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#FAF8F5',
      }}
    >
      {/* ── Left Panel: branding ── */}
      <div
        style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          position: 'relative',
          overflow: 'hidden',
          background: '#FAF8F5',
          borderRight: '1px solid var(--c-border)',
        }}
      >
        {/* Soft Warm Glowing Radiance */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              top: '-15%',
              left: '-10%',
              width: '550px',
              height: '550px',
              background: 'radial-gradient(ellipse, rgba(255, 126, 95, 0.12) 0%, transparent 65%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-15%',
              right: '-10%',
              width: '500px',
              height: '500px',
              background: 'radial-gradient(ellipse, rgba(254, 180, 123, 0.14) 0%, transparent 65%)',
            }}
          />
        </div>

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            style={{
              width: 46,
              height: 46,
              background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(255, 126, 95, 0.35)',
            }}
          >
            <Shield size={24} color="#FFFFFF" />
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: '-0.02em',
                color: '#1E2229',
              }}
            >
              DataShield
            </div>
            <div
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: '#FF7E5F',
                textTransform: 'uppercase',
              }}
            >
              SIH 2026 · Problem Statement SIH26149
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative z-10">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 14,
              background: 'rgba(255, 126, 95, 0.12)',
              border: '1px solid rgba(255, 126, 95, 0.25)',
              color: '#FF7E5F',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            <Sparkles size={12} /> Cybersecurity / Data Security Platform
          </div>

          <h1
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 800,
              fontSize: 48,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              color: '#1E2229',
              marginBottom: 20,
            }}
          >
            AI-Assisted<br />
            <span
              style={{
                background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Secure Data Erasure
            </span><br />
            &amp; File Recovery
          </h1>

          <p style={{ color: '#5E6676', fontSize: 15, lineHeight: 1.7, maxWidth: 440 }}>
            <strong>DETECT → ANALYZE → RECOVER / ERASE → VERIFY → REPORT</strong>
            <br />
            Storage-aware sanitization with cryptographic verification and immutable SHA-256 audit trails.
          </p>
        </div>

        {/* Badges */}
        <div className="relative z-10 flex flex-wrap gap-2">
          {['NIST SP 800-88', 'DoD 5220.22-M', 'SHA-256 Chain', 'Firebase RBAC', 'Magic-Byte Carving'].map((t) => (
            <span
              key={t}
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                background: '#E6EFFB',
                color: '#2B579A',
                border: '1px solid #D0E0F7',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right Panel: login form ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
        <div
          className="ds-card"
          style={{
            width: '100%',
            maxWidth: 440,
            padding: 36,
            borderRadius: 14,
            background: '#FFFFFF',
            boxShadow: '0 16px 48px -8px rgba(30, 34, 41, 0.08), 0 4px 16px -2px rgba(30, 34, 41, 0.03)',
            border: '1px solid var(--c-border)',
          }}
        >
          <h2
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 800,
              fontSize: 26,
              letterSpacing: '-0.02em',
              color: '#1E2229',
              marginBottom: 4,
            }}
          >
            Operator Access
          </h2>
          <p style={{ color: '#5E6676', fontSize: 13, marginBottom: 24 }}>
            Authenticate to enter the Security Operations Center
          </p>

          {/* Tab switcher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
              padding: 4,
              background: '#FAF8F5',
              borderRadius: 14,
              border: '1px solid var(--c-border)',
              marginBottom: 24,
            }}
          >
            {[
              { id: 'credentials', label: 'Operator Login', icon: <KeyRound size={13} /> },
              { id: 'sih_presets', label: 'Demo Users', icon: <Sparkles size={13} /> },
            ].map((tab) => {
              const active = authMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAuthMode(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '9px 12px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: 12,
                    fontWeight: 700,
                    transition: 'all 0.16s ease',
                    background: active ? 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' : 'transparent',
                    color: active ? '#FFFFFF' : '#5E6676',
                    boxShadow: active ? '0 4px 14px rgba(255, 126, 95, 0.3)' : 'none',
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 14,
                padding: '10px 14px',
                marginBottom: 16,
                color: '#DC2626',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {authMode === 'credentials' ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#5E6676',
                    marginBottom: 6,
                  }}
                >
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="ds-input"
                    style={{ paddingLeft: 38, borderRadius: 14 }}
                    placeholder="admin"
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#5E6676',
                    marginBottom: 6,
                  }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="ds-input"
                    style={{ paddingLeft: 38, paddingRight: 42, borderRadius: 14 }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94A3B8',
                      padding: 0,
                    }}
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="ds-btn ds-btn-primary ds-btn-lg"
                style={{ justifyContent: 'center', marginTop: 6, borderRadius: 14 }}
              >
                {isLoading ? 'Authenticating...' : 'Access DataShield'} <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ color: '#5E6676', fontSize: 12, marginBottom: 4 }}>
                One-click access with pre-configured Demo Users:
              </p>
              {(Object.keys(DEMO_PRESETS) as Role[]).map((roleKey) => {
                const preset = DEMO_PRESETS[roleKey];
                const accent = roleAccents[roleKey];
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => quickLogin(roleKey)}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 14px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: '#FAF8F5',
                      border: '1px solid var(--c-border)',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = accent;
                      (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(30,34,41,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)';
                      (e.currentTarget as HTMLElement).style.background = '#FAF8F5';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13, color: '#1E2229' }}>
                        {preset.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#5E6676', marginTop: 1 }}>{preset.roleName}</div>
                    </div>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: `${accent}14`,
                        border: `1px solid ${accent}35`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ChevronRight size={14} color={accent} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 18,
              borderTop: '1px solid var(--c-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              color: '#94A3B8',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="ds-dot ds-dot-green" style={{ width: 6, height: 6 }} />
              <Cloud size={12} color="#16A34A" />
              {firebaseConnected ? 'Firebase Realtime' : 'Local Mode'}
            </span>
            <span>NIST SP 800-88 Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
