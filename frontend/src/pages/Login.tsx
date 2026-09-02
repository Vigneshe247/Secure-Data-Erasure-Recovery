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
    try { await login(username, password); }
    catch (err: any) { setError(err.message || 'Authentication failed.'); }
  };

  const roleAccents: Record<Role, string> = {
    admin:            '#ef4444',
    security_admin:   '#2d7ff9',
    forensic_analyst: '#f59e0b',
    auditor:          '#22c55e',
    demo_user:        '#818cf8',
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#0a0c10', backgroundImage:'linear-gradient(rgba(45,127,249,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(45,127,249,0.04) 1px,transparent 1px)', backgroundSize:'48px 48px' }}>
      {/* ── Left Panel: branding ── */}
      <div style={{ width:'52%', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'48px 56px', position:'relative', overflow:'hidden', borderRight:'1px solid rgba(255,255,255,0.05)' }}>
        {/* Background glow */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
          <div style={{
            position:'absolute', top:'-20%', left:'-10%', width:'600px', height:'600px',
            background:'radial-gradient(ellipse, rgba(45,127,249,0.12) 0%, transparent 65%)',
          }} />
          <div style={{
            position:'absolute', bottom:'-20%', right:'-10%', width:'500px', height:'500px',
            background:'radial-gradient(ellipse, rgba(0,212,200,0.07) 0%, transparent 65%)',
          }} />
        </div>

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div style={{
            width:44, height:44,
            background:'linear-gradient(135deg,#2d7ff9,#1a5fd4)',
            borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 24px rgba(45,127,249,0.4)',
          }}>
            <Shield size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:20, letterSpacing:'0.05em', textTransform:'uppercase', color:'#f0f4ff' }}>
              DataShield
            </div>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:10, letterSpacing:'0.15em', color:'#2d7ff9', textTransform:'uppercase' }}>
              SIH 2026 · SIH26149
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <div className="ds-section-label mb-4" style={{ justifyContent:'flex-start' }}>
            Smart India Hackathon 2026
          </div>
          <h1 style={{
            fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:56,
            textTransform:'uppercase', letterSpacing:'0.02em', lineHeight:1.05,
            color:'#f0f4ff', marginBottom:20,
          }}>
            AI-Assisted<br />
            <span style={{ color:'#2d7ff9' }}>Secure Data</span><br />
            Erasure &amp; Recovery
          </h1>
          <p style={{ color:'#8b96a8', fontSize:15, lineHeight:1.7, maxWidth:420 }}>
            DETECT → ANALYZE → RECOVER / ERASE → VERIFY → REPORT
            <br />
            Storage-aware sanitization with cryptographic verification and immutable audit trails.
          </p>
        </div>

        {/* Feature tags */}
        <div className="relative z-10 flex flex-wrap gap-2">
          {['NIST SP 800-88', 'DoD 5220.22-M', 'SHA-256 Chain', 'Firebase RBAC', 'Magic-Byte Carving'].map((t) => (
            <span key={t} className="ds-badge ds-badge-ghost">{t}</span>
          ))}
        </div>
      </div>

      {/* ── Right Panel: login form ── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 40px' }}>
        <div style={{ width:'100%', maxWidth:420 }}>


          <h2 style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:28, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>
            Operator Access
          </h2>
          <p style={{ color:'#8b96a8', fontSize:13, marginBottom:28 }}>
            Authenticate to enter the Security Operations Center
          </p>

          {/* Tab switcher */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, padding:4, background:'#111318', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', marginBottom:24 }}>
            {[
              { id:'credentials', label:'Operator Login', icon:<KeyRound size={13}/> },
              { id:'sih_presets', label:'Demo Users', icon:<Sparkles size={13}/> },
            ].map((tab) => (
              <button key={tab.id} type="button" onClick={() => setAuthMode(tab.id as any)}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  padding:'8px 12px', borderRadius:7, border:'none', cursor:'pointer',
                  fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700,
                  letterSpacing:'0.06em', textTransform:'uppercase', transition:'all 0.15s',
                  background: authMode === tab.id ? 'linear-gradient(135deg,#2d7ff9,#1a5fd4)' : 'transparent',
                  color: authMode === tab.id ? '#fff' : '#8b96a8',
                  boxShadow: authMode === tab.id ? '0 2px 12px rgba(45,127,249,0.4)' : 'none',
                }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#f87171', fontSize:12 }}>
              {error}
            </div>
          )}

          {authMode === 'credentials' ? (
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ display:'block', fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'#8b96a8', marginBottom:6 }}>
                  Username
                </label>
                <div style={{ position:'relative' }}>
                  <User size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#4d5a6a' }} />
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                    className="ds-input" style={{ paddingLeft:36 }} placeholder="admin" />
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'#8b96a8', marginBottom:6 }}>
                  Password
                </label>
                <div style={{ position:'relative' }}>
                  <Lock size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#4d5a6a' }} />
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="ds-input" style={{ paddingLeft:36, paddingRight:40 }} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#4d5a6a', padding:0 }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="ds-btn ds-btn-primary ds-btn-lg" style={{ justifyContent:'center', marginTop:4 }}>
                {isLoading ? 'Authenticating...' : 'Access DataShield'} <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <p style={{ color:'#8b96a8', fontSize:12, marginBottom:4 }}>
                One-click access with pre-configured Demo Users:
              </p>
              {(Object.keys(DEMO_PRESETS) as Role[]).map((roleKey) => {
                const preset = DEMO_PRESETS[roleKey];
                const accent = roleAccents[roleKey];
                return (
                  <button key={roleKey} type="button" onClick={() => quickLogin(roleKey)} disabled={isLoading}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'11px 14px', borderRadius:9, cursor:'pointer', transition:'all 0.15s',
                      background:'#111318', border:`1px solid rgba(255,255,255,0.08)`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = accent; (e.currentTarget as HTMLElement).style.background = `${accent}10`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.background = '#111318'; }}
                  >
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:14, color:'#f0f4ff', letterSpacing:'0.02em' }}>{preset.label}</div>
                      <div style={{ fontSize:11, color:'#8b96a8', marginTop:1 }}>{preset.roleName}</div>
                    </div>
                    <div style={{ width:28, height:28, borderRadius:7, background:`${accent}18`, border:`1px solid ${accent}40`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <ChevronRight size={14} color={accent} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, color:'#4d5a6a' }}>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span className="ds-dot ds-dot-green" style={{ width:5, height:5 }} />
              <Cloud size={12} color="#2d7ff9" />
              {firebaseConnected ? 'Firebase Realtime' : 'Offline Mode'}
            </span>
            <span>NIST SP 800-88 Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
