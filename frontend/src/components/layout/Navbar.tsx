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
  admin:            '#ef4444',
  security_admin:   '#2d7ff9',
  forensic_analyst: '#f59e0b',
  auditor:          '#22c55e',
  demo_user:        '#818cf8',
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout, quickLogin, firebaseConnected } = useAuth();
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [tick, setTick] = useState('');

  useEffect(() => {
    const fmt = () => setTick(new Date().toLocaleTimeString('en-US', { hour12: false }));
    fmt(); const t = setInterval(fmt, 1000); return () => clearInterval(t);
  }, []);

  const accent = roleColors[user?.role || 'demo_user'] || '#2d7ff9';

  return (
    <>
      <header className="ds-topbar" style={{ height:56, display:'flex', alignItems:'center', paddingLeft:20, paddingRight:20, gap:16, position:'sticky', top:0, zIndex:50 }}>
        {/* Brand */}
        <button onClick={() => setActiveTab('dashboard')}
          style={{ display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer', padding:0 }}>
          <div style={{ width:34, height:34, background:'linear-gradient(135deg,#2d7ff9,#1a5fd4)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 14px rgba(45,127,249,0.35)' }}>
            <Shield size={17} color="#fff" />
          </div>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:17, letterSpacing:'0.06em', textTransform:'uppercase', color:'#f0f4ff', lineHeight:1 }}>DataShield</div>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, letterSpacing:'0.15em', color:'#2d7ff9', textTransform:'uppercase', lineHeight:1, marginTop:2 }}>SIH26149</div>
          </div>
        </button>

        {/* Divider */}
        <div style={{ width:1, height:28, background:'rgba(255,255,255,0.08)', marginRight:4 }} />

        {/* Status strip */}
        <div className="hidden xl:flex" style={{ display:'flex', alignItems:'center', gap:16, fontSize:11, color:'#8b96a8', fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.08em', textTransform:'uppercase' }}>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span className="ds-dot ds-dot-green" /> SOC Active
          </span>
          <span style={{ color:'rgba(255,255,255,0.12)' }}>|</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Clock size={11} color="#4d5a6a" /> {tick}
          </span>
          <span style={{ color:'rgba(255,255,255,0.12)' }}>|</span>
          <span style={{ display:'flex', alignItems:'center', gap:5, color: firebaseConnected ? '#22c55e' : '#8b96a8' }}>
            <Cloud size={11} /> {firebaseConnected ? 'Firebase Live' : 'Local'}
          </span>
        </div>

        {/* Right */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {/* AI Copilot */}
          <button onClick={() => setIsAIOpen(true)}
            style={{
              display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
              borderRadius:7, border:'1px solid rgba(45,127,249,0.3)',
              background:'rgba(45,127,249,0.08)', cursor:'pointer',
              fontFamily:'Barlow Condensed,sans-serif', fontSize:11, fontWeight:700,
              letterSpacing:'0.08em', textTransform:'uppercase', color:'#60a5fa',
            }}>
            <Bot size={13} /> AI Copilot
          </button>

          {/* Role switcher */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setDemoMenuOpen(!demoMenuOpen)}
              style={{
                display:'flex', alignItems:'center', gap:7, padding:'6px 12px',
                borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'#111318',
                cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif',
                fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#8b96a8',
              }}>
              <Terminal size={12} />
              <span style={{ color:'#f0f4ff' }}>{user?.role?.replace(/_/g,' ').toUpperCase()}</span>
              <ChevronDown size={12} style={{ transform: demoMenuOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }} />
            </button>

            {demoMenuOpen && (
              <div style={{
                position:'absolute', right:0, top:'calc(100% + 6px)', width:240,
                background:'#111318', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:10, padding:6, zIndex:100,
                boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
              }}>
                <div style={{ padding:'4px 10px 6px', fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'#4d5a6a', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:4 }}>
                  Demo Users Switcher
                </div>
                {(Object.keys(DEMO_PRESETS) as Role[]).map((roleKey) => {
                  const preset = DEMO_PRESETS[roleKey];
                  const isCurrent = user?.role === roleKey;
                  const acc = roleColors[roleKey];
                  return (
                    <button key={roleKey} onClick={() => { quickLogin(roleKey); setDemoMenuOpen(false); }}
                      style={{
                        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'7px 10px', borderRadius:7, border:'none', cursor:'pointer',
                        background: isCurrent ? `${acc}15` : 'transparent',
                        transition:'background 0.12s',
                      }}
                      onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)'; }}
                      onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background='transparent'; }}
                    >
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:13, fontWeight:700, color: isCurrent ? acc : '#f0f4ff', letterSpacing:'0.03em' }}>{preset.label}</div>
                        <div style={{ fontSize:10, color:'#8b96a8', marginTop:1 }}>{preset.roleName}</div>
                      </div>
                      {isCurrent && <CheckCircle2 size={13} color={acc} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:10, borderLeft:'1px solid rgba(255,255,255,0.08)', marginLeft:2 }}>
            <div style={{
              width:32, height:32, borderRadius:8,
              background:`linear-gradient(135deg,${accent},${accent}88)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:14, color:'#fff',
              boxShadow:`0 0 12px ${accent}40`,
            }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ display:'none' }} className="sm:block">
              <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:13, letterSpacing:'0.04em', color:'#f0f4ff' }}>{user?.full_name || user?.username}</div>
              <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color: accent, marginTop:1 }}>{user?.role?.replace(/_/g,' ')}</div>
            </div>
          </div>

          {/* Logout */}
          <button onClick={logout}
            style={{ width:32, height:32, borderRadius:7, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#4d5a6a', transition:'all 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor='rgba(239,68,68,0.4)'; (e.currentTarget as HTMLElement).style.color='#ef4444'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color='#4d5a6a'; }}
            title="Sign Out">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <AIAssistantModal isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </>
  );
};
