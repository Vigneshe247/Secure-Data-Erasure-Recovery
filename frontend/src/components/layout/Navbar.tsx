import React, { useState, useEffect } from 'react';
import {
  Shield, LogOut, Terminal, CheckCircle2, ChevronDown,
  Cloud, Clock, Sparkles, Bot, Activity,
} from 'lucide-react';
import { useAuth, DEMO_PRESETS } from '../../context/AuthContext';
import { Role } from '../../types';
import { AIAssistantModal } from '../AIAssistantModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const roleColors: Record<string, string> = {
  admin:            '#EF4444',
  security_admin:   '#FF7E5F',
  forensic_analyst: '#D97706',
  auditor:          '#16A34A',
  demo_user:        '#2563EB',
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout, quickLogin, firebaseConnected } = useAuth();
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [tick, setTick] = useState('');

  useEffect(() => {
    const fmt = () => setTick(new Date().toLocaleTimeString('en-US', { hour12: false }));
    fmt();
    const t = setInterval(fmt, 1000);
    return () => clearInterval(t);
  }, []);

  const accent = roleColors[user?.role || 'demo_user'] || '#FF7E5F';

  return (
    <>
      <header
        className="ds-topbar"
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24,
          paddingRight: 24,
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#FFFFFF',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        {/* Brand */}
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(255, 126, 95, 0.35)',
            }}
          >
            <Shield size={18} color="#FFFFFF" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', color: '#1E2229', lineHeight: 1.1 }}>
              DataShield
            </div>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#FF7E5F', textTransform: 'uppercase', lineHeight: 1, marginTop: 2 }}>
              SIH26149
            </div>
          </div>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 26, background: 'var(--c-border)', margin: '0 4px' }} />

        {/* Status Pills */}
        <div className="hidden xl:flex" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 14,
              background: '#E6EFFB',
              border: '1px solid #D0E0F7',
              fontSize: 11,
              fontWeight: 700,
              color: '#2B579A',
            }}
          >
            <span className="ds-dot ds-dot-green" /> SOC Active
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 14,
              background: '#FAF8F5',
              border: '1px solid var(--c-border)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--c-text-muted)',
            }}
          >
            <Clock size={12} color="#94A3B8" /> {tick}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 14,
              background: firebaseConnected ? 'rgba(22, 163, 74, 0.08)' : '#FAF8F5',
              border: firebaseConnected ? '1px solid rgba(22, 163, 74, 0.2)' : '1px solid var(--c-border)',
              fontSize: 11,
              fontWeight: 600,
              color: firebaseConnected ? '#16A34A' : 'var(--c-text-muted)',
            }}
          >
            <Cloud size={12} /> {firebaseConnected ? 'Firebase Realtime' : 'Local Sandbox'}
          </div>
        </div>

        {/* Right Section */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* AI Copilot Button */}
          <button
            onClick={() => setIsAIOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 14,
              border: '1px solid rgba(255,126,95,0.3)',
              background: 'rgba(255,126,95,0.08)',
              cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              color: '#FF7E5F',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,126,95,0.14)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,126,95,0.08)'; }}
          >
            <Bot size={14} color="#FF7E5F" /> AI Copilot
          </button>

          {/* Role switcher */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDemoMenuOpen(!demoMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 14px',
                borderRadius: 14,
                border: '1px solid var(--c-border)',
                background: '#FFFFFF',
                cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                color: '#1E2229',
                boxShadow: '0 2px 8px rgba(30, 34, 41, 0.03)',
              }}
            >
              <Terminal size={13} color="#94A3B8" />
              <span>{user?.role?.replace(/_/g, ' ').toUpperCase()}</span>
              <ChevronDown size={12} style={{ transform: demoMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {demoMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: 250,
                  background: '#FFFFFF',
                  border: '1px solid var(--c-border)',
                  borderRadius: 14,
                  padding: 8,
                  zIndex: 100,
                  boxShadow: '0 12px 36px -4px rgba(30, 34, 41, 0.12), 0 4px 12px rgba(30, 34, 41, 0.04)',
                }}
              >
                <div style={{ padding: '6px 12px 8px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', borderBottom: '1px solid var(--c-border)', marginBottom: 6 }}>
                  Demo Users Switcher
                </div>
                {(Object.keys(DEMO_PRESETS) as Role[]).map((roleKey) => {
                  const preset = DEMO_PRESETS[roleKey];
                  const isCurrent = user?.role === roleKey;
                  const acc = roleColors[roleKey];
                  return (
                    <button
                      key={roleKey}
                      onClick={() => { quickLogin(roleKey); setDemoMenuOpen(false); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: 'none',
                        cursor: 'pointer',
                        background: isCurrent ? 'rgba(255, 126, 95, 0.1)' : 'transparent',
                        transition: 'background 0.12s',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = '#FAF8F5'; }}
                      onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div>
                        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: isCurrent ? '#FF7E5F' : '#1E2229' }}>
                          {preset.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#5E6676', marginTop: 1 }}>{preset.roleName}</div>
                      </div>
                      {isCurrent && <CheckCircle2 size={14} color="#FF7E5F" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 8, borderLeft: '1px solid var(--c-border)' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(255, 126, 95, 0.28)',
              }}
            >
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ display: 'none' }} className="sm:block">
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13, color: '#1E2229' }}>
                {user?.full_name || user?.username}
              </div>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 600, color: '#FF7E5F', textTransform: 'uppercase' }}>
                {user?.role?.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={logout}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid var(--c-border)',
              background: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
            title="Sign Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <AIAssistantModal isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </>
  );
};
