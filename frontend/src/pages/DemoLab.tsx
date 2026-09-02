import React from 'react';
import {
  ShieldCheck, Sparkles, Play, HardDrive, FileSearch, Trash2,
  CheckCheck, History, ArrowRight, CheckCircle2, Code2,
} from 'lucide-react';

interface DemoLabProps { setActiveTab: (tab: string) => void; }

const PHASES = [
  {
    n:1, phase:'DETECT', title:'Storage Analysis', icon:HardDrive, tab:'storage', accent:'#2d7ff9',
    desc:'Profile SSD/NVMe wear-leveling, TRIM status, filesystem topology, and over-provisioning boundaries.',
    bullets:['FTL Wear-Leveling Detection','TRIM Command Validation','S.M.A.R.T. Diagnostics','File System Metadata Scan'],
  },
  {
    n:2, phase:'ANALYZE', title:'Authorized Recovery', icon:FileSearch, tab:'recovery', accent:'#f59e0b',
    desc:'Magic-byte file carving from raw sectors. Fragment reassembly with SHA-256 integrity validation.',
    bullets:['Magic-Byte Carving 15+ types','AI Confidence Scoring','SHA-256 Integrity Verify','Hex/ASCII Sector Inspector'],
  },
  {
    n:3, phase:'ERASE', title:'Secure Sanitization', icon:Trash2, tab:'erasure', accent:'#ef4444',
    desc:'8 industry-standard protocols with 4-step authorization guard. Real-time sector block bitmap.',
    bullets:['NIST SP 800-88 / DoD','Gutmann 35-Pass','4-Step Safety Guard','Block Bitmap Visualizer'],
  },
  {
    n:4, phase:'VERIFY', title:'Post-Erasure Scan', icon:CheckCheck, tab:'verification', accent:'#22c55e',
    desc:'Shannon entropy measurement ≥7.98 bits/byte. Sector sampling, hash chain verification.',
    bullets:['Shannon Entropy Analysis','Sector Sampling','Hash Chain Integrity','Zero-Residue Proof'],
  },
  {
    n:5, phase:'REPORT', title:'Compliance Reports', icon:History, tab:'reports', accent:'#818cf8',
    desc:'Auto-generate PDF compliance certificates anchored to SHA-256. NIST, DoD, GDPR coverage.',
    bullets:['SHA-256 Immutable Ledger','GDPR / IT Act Coverage','PDF Certificate Export','Signed Audit Records'],
  },
];

export const DemoLab: React.FC<DemoLabProps> = ({ setActiveTab }) => (
  <div className="ds-page" style={{ display:'flex', flexDirection:'column', gap:24 }}>
    {/* Hero */}
    <div style={{
      background:'linear-gradient(135deg, #111318 0%, #161921 100%)',
      border:'1px solid rgba(45,127,249,0.2)',
      borderRadius:14, padding:'36px 40px',
      position:'relative', overflow:'hidden',
      boxShadow:'0 0 60px rgba(45,127,249,0.08)',
    }}>
      <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(45,127,249,0.1) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div className="ds-section-label" style={{ justifyContent:'flex-start', marginBottom:14 }}>SIH 2026 · Problem Statement SIH26149</div>
      <h1 style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:48, textTransform:'uppercase', letterSpacing:'0.02em', color:'#f0f4ff', lineHeight:1.05, marginBottom:16 }}>
        DataShield<br /><span style={{ color:'#2d7ff9' }}>Interactive</span> Demo Lab
      </h1>
      <p style={{ color:'#8b96a8', fontSize:14, maxWidth:560, lineHeight:1.7, marginBottom:24 }}>
        End-to-end walkthrough of the DataShield lifecycle in fully sandboxed <code style={{ color:'#2d7ff9', fontSize:12 }}>.img</code> containers. No host data is ever touched.
      </p>
      {/* Pipeline */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        {['DETECT','ANALYZE','RECOVER/ERASE','VERIFY','REPORT'].map((p, i, arr) => (
          <React.Fragment key={p}>
            <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.1em', padding:'4px 12px', borderRadius:4, background:'rgba(45,127,249,0.12)', border:'1px solid rgba(45,127,249,0.25)', color:'#60a5fa' }}>{p}</span>
            {i<arr.length-1 && <ArrowRight size={13} color="#4d5a6a" />}
          </React.Fragment>
        ))}
      </div>
    </div>

    {/* Phase grid */}
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
      {PHASES.map((ph) => {
        const Icon = ph.icon;
        return (
          <div key={ph.tab} onClick={() => setActiveTab(ph.tab)}
            className="ds-card ds-card-interactive"
            style={{ padding:'20px', position:'relative', overflow:'hidden' }}
          >
            {/* Top accent line */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${ph.accent}, transparent)`, borderRadius:'12px 12px 0 0' }} />

            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ width:38, height:38, borderRadius:9, background:`${ph.accent}14`, border:`1px solid ${ph.accent}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon size={17} color={ph.accent} />
              </div>
              <div>
                <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:'#4d5a6a' }}>Phase {ph.n}</div>
                <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:15, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.04em', color:ph.accent }}>{ph.phase}</div>
              </div>
              <div style={{ marginLeft:'auto', width:24, height:24, borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:800, color:'#4d5a6a' }}>{ph.n}</div>
            </div>

            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:17, textTransform:'uppercase', letterSpacing:'0.03em', color:'#f0f4ff', marginBottom:8 }}>{ph.title}</div>
            <p style={{ fontSize:12, color:'#8b96a8', lineHeight:1.65, marginBottom:14 }}>{ph.desc}</p>

            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:18 }}>
              {ph.bullets.map((b) => (
                <div key={b} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11.5, color:'#8b96a8' }}>
                  <CheckCircle2 size={12} color={ph.accent} style={{ flexShrink:0 }} />
                  {b}
                </div>
              ))}
            </div>

            <button style={{
              width:'100%', padding:'9px', borderRadius:8, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg, ${ph.accent}, ${ph.accent}cc)`,
              color:'#fff', fontFamily:'Barlow Condensed,sans-serif', fontWeight:700,
              fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              <Play size={12} style={{ fill:'#fff' }} /> Launch {ph.phase}
            </button>
          </div>
        );
      })}

      {/* Differentiators card */}
      <div className="ds-card-glow" style={{ padding:'20px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg, #00d4c8, transparent)', borderRadius:'12px 12px 0 0' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <ShieldCheck size={16} color="#00d4c8" />
          <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:14, textTransform:'uppercase', letterSpacing:'0.06em', color:'#2dd4bf' }}>Technical Differentiators</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[
            'FTL-aware algorithm selection per storage class',
            'Magic-byte carving: 15+ file formats',
            'Shannon entropy ≥7.98 post-erase guarantee',
            'SHA-256 cryptographic audit chain',
            '8 international sanitization standards',
            'Firebase RBAC with 5 distinct roles',
            'Explainable AI per recovered file',
            'Real-time sector block bitmap',
          ].map((item) => (
            <div key={item} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'#8b96a8' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#00d4c8', flexShrink:0, marginTop:5 }} />{item}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
