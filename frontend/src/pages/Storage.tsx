import React, { useEffect, useState } from 'react';
import {
  HardDrive, RefreshCw, Sparkles, AlertTriangle, ArrowRight,
  Thermometer, Gauge, Clock, HeartPulse, Zap, Activity,
} from 'lucide-react';
import { api } from '../services/api';
import { StorageDevice, StorageProfile } from '../types';

interface StorageProps { setActiveTab: (tab: string) => void; }

const SMART = [
  { label:'Health Score', value:'99.4%', sub:'0 bad sectors', icon:Gauge,       color:'#22c55e' },
  { label:'Temperature',  value:'32°C',  sub:'Optimal range', icon:Thermometer, color:'#2d7ff9' },
  { label:'Power-On Hrs', value:'412h',  sub:'Total uptime',  icon:Clock,       color:'#818cf8' },
  { label:'Wear Leveling',value:'0.2%',  sub:'FTL used',      icon:Zap,         color:'#f59e0b' },
  { label:'Est. Lifespan',value:'9.8yr', sub:'TBW 99.8%',     icon:HeartPulse,  color:'#22c55e' },
];

export const Storage: React.FC<StorageProps> = ({ setActiveTab }) => {
  const [devices, setDevices]         = useState<StorageDevice[]>([]);
  const [selected, setSelected]       = useState<StorageDevice | null>(null);
  const [profile, setProfile]         = useState<StorageProfile | null>(null);
  const [loading, setLoading]         = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getStorageDevices();
      setDevices(data);
      if (data.length > 0) { setSelected(data[0]); runAnalysis(data[0].id); }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const runAnalysis = async (id: string) => {
    try { setProfile(await api.analyzeStorage(id)); } catch {}
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:12 }}>
      <div style={{ width:28, height:28, border:'2px solid #2d7ff9', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span style={{ color:'#8b96a8', fontSize:12, fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.12em', textTransform:'uppercase' }}>Scanning hardware</span>
    </div>
  );

  return (
    <div className="ds-page" style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Header */}
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', justifyContent:'space-between', gap:12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent:'flex-start', marginBottom:6 }}>Hardware Topography & FTL Profiler</div>
          <h1 style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:32, textTransform:'uppercase', letterSpacing:'0.03em', color:'#f0f4ff' }}>
            Storage Analyzer
          </h1>
        </div>
        <button onClick={load} className="ds-btn ds-btn-ghost ds-btn-sm">
          <RefreshCw size={13} /> Rescan
        </button>
      </div>

      {/* Device selector */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
        {devices.map((dev) => {
          const sel = selected?.id === dev.id;
          return (
            <div key={dev.id} onClick={() => { setSelected(dev); runAnalysis(dev.id); }}
              className="ds-card ds-card-interactive"
              style={{ padding:'14px', border: sel ? '1px solid rgba(45,127,249,0.5)' : undefined, boxShadow: sel ? '0 0 0 1px rgba(45,127,249,0.15), 0 0 20px rgba(45,127,249,0.1)' : undefined }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:34, height:34, borderRadius:8, background: sel ? 'rgba(45,127,249,0.2)' : 'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${sel ? 'rgba(45,127,249,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                  <HardDrive size={15} color={sel ? '#2d7ff9' : '#4d5a6a'} />
                </div>
                <div>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:14, color:'#f0f4ff', lineHeight:1 }}>{dev.name}</div>
                  <div style={{ fontSize:10, color:'#8b96a8', marginTop:3 }}>{dev.storage_type} · {dev.filesystem}</div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#8b96a8', borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:8 }}>
                <span>Capacity</span>
                <span style={{ fontWeight:700, color:'#f0f4ff' }}>{(dev.total_capacity_bytes/1e9).toFixed(1)} GB</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SMART */}
      {selected && (
        <div className="ds-card" style={{ padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:16, textTransform:'uppercase', letterSpacing:'0.04em', color:'#f0f4ff', display:'flex', alignItems:'center', gap:8 }}>
              <Activity size={15} color="#22c55e" /> S.M.A.R.T. Diagnostics
            </div>
            <span className="ds-badge ds-badge-green">Health Grade: A+</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10 }}>
            {SMART.map((m) => (
              <div key={m.label} style={{ padding:'12px 14px', borderRadius:9, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <m.icon size={12} color={m.color} />
                  <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#8b96a8' }}>{m.label}</span>
                </div>
                <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:22, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:10, color:'#4d5a6a', marginTop:3 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis panel */}
      {selected && profile && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14 }}>
          <div className="ds-card" style={{ padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:16, textTransform:'uppercase', color:'#f0f4ff' }}>
                Architecture — <span style={{ color:'#2d7ff9' }}>{selected.name}</span>
              </div>
              <span className="ds-badge" style={{ background:`${profile.risk_level==='LOW'?'rgba(34,197,94,0.1)':profile.risk_level==='MEDIUM'?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.1)'}`, color:profile.risk_level==='LOW'?'#4ade80':profile.risk_level==='MEDIUM'?'#fbbf24':'#f87171', border:`1px solid ${profile.risk_level==='LOW'?'rgba(34,197,94,0.25)':profile.risk_level==='MEDIUM'?'rgba(245,158,11,0.25)':'rgba(239,68,68,0.25)'}` }}>
                {profile.risk_level} Risk
              </span>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:14 }}>
              {[
                ['Class', profile.storage_type, '#2d7ff9'],
                ['FS', selected.filesystem, '#f0f4ff'],
                ['TRIM', profile.trim_active ? 'ENABLED' : 'DISABLED', profile.trim_active ? '#22c55e' : '#ef4444'],
                ['FTL', profile.ftl_warning ? 'ENFORCED' : 'N/A', profile.ftl_warning ? '#f59e0b' : '#8b96a8'],
              ].map(([k,v,c]) => (
                <div key={k as string} style={{ padding:'10px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#4d5a6a', marginBottom:5 }}>{k as string}</div>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:16, color:c as string }}>{v as string}</div>
                </div>
              ))}
            </div>

            {profile.ftl_warning && (
              <div style={{ padding:'12px 14px', borderRadius:9, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', marginBottom:12, display:'flex', gap:10 }}>
                <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink:0, marginTop:2 }} />
                <div style={{ fontSize:12, color:'#fbbf24', lineHeight:1.6 }}>
                  Wear-leveling prevents standard multi-pass overwrites from reaching over-provisioned NAND cells. Controller-level purge mandatory.
                </div>
              </div>
            )}

            <div style={{ fontSize:12, color:'#8b96a8', lineHeight:1.7, padding:'10px 14px', borderRadius:8, background:'rgba(45,127,249,0.06)', border:'1px solid rgba(45,127,249,0.15)' }}>
              {profile.technical_rationale}
            </div>

            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={() => setActiveTab('recovery')} className="ds-btn ds-btn-ghost ds-btn-sm">
                Recovery Scan <ArrowRight size={12} />
              </button>
              <button onClick={() => setActiveTab('erasure')} className="ds-btn ds-btn-ghost ds-btn-sm">
                Configure Erasure <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* AI Advisor */}
          <div className="ds-card-glow" style={{ padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <Sparkles size={15} color="#2d7ff9" />
              <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:14, textTransform:'uppercase', letterSpacing:'0.06em', color:'#f0f4ff' }}>AI Advisor</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14, fontSize:12 }}>
              {[
                { label:'Recommended Protocol', val:profile.recommended_strategy, col:'#60a5fa' },
                { label:'Compliance Standard',  val:profile.compliance_standard||'NIST SP 800-88', col:'#4ade80' },
              ].map((r) => (
                <div key={r.label}>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#4d5a6a', marginBottom:4 }}>{r.label}</div>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:14, color:r.col }}>{r.val}</div>
                </div>
              ))}
              <div>
                <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#4d5a6a', marginBottom:6 }}>AI Confidence</div>
                <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:32, color:'#f0f4ff' }}>{Math.round(profile.ai_confidence*100)}%</div>
                <div className="ds-progress" style={{ marginTop:6 }}>
                  <div className="ds-progress-fill" style={{ width:`${Math.round(profile.ai_confidence*100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
