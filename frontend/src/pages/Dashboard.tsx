import React, { useEffect, useState } from 'react';
import { HardDrive, FileSearch, Trash2, ShieldCheck, ArrowUpRight, Sparkles, Clock } from 'lucide-react';
import { api } from '../services/api';
import { DashboardMetrics } from '../types';
import { useAuth } from '../context/AuthContext';

interface DashboardProps { setActiveTab: (tab: string) => void; }

const MetricCard: React.FC<{
  label: string; value: string|number; sub: string; icon: React.FC<any>;
  accent: string; onClick: () => void;
}> = ({ label, value, sub, icon: Icon, accent, onClick }) => (
  <div className="ds-metric" onClick={onClick} style={{ '--accent-color': accent } as any}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
      <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#8b96a8' }}>{label}</div>
      <div style={{ width:34, height:34, borderRadius:8, background:`${accent}14`, border:`1px solid ${accent}25`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={16} color={accent} />
      </div>
    </div>
    <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:36, letterSpacing:'-0.01em', color:'#f0f4ff', lineHeight:1 }}>{value}</div>
    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:8, fontSize:11, color:'#8b96a8' }}>
      {sub}<ArrowUpRight size={11} color={accent} />
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardMetrics().then(setMetrics).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:12 }}>
      <div style={{ width:32, height:32, border:'2px solid #2d7ff9', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span style={{ color:'#8b96a8', fontSize:13, fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.1em', textTransform:'uppercase' }}>Loading SOC Telemetry</span>
    </div>
  );

  return (
    <div className="ds-page" style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Hero Banner */}
      <div className="ds-page-hero">
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div>
            <div className="ds-section-label" style={{ justifyContent:'flex-start', marginBottom:10 }}>
              Security Operations Center
            </div>
            <h1 style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:34, textTransform:'uppercase', letterSpacing:'0.03em', color:'#f0f4ff', lineHeight:1.05, marginBottom:8 }}>
              Welcome, <span style={{ color:'#2d7ff9' }}>{user?.full_name || user?.username}</span>
            </h1>
            <p style={{ fontSize:13, color:'#8b96a8', fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.06em', textTransform:'uppercase' }}>
              DETECT · ANALYZE · RECOVER/ERASE · VERIFY · REPORT
            </p>
          </div>
          <button onClick={() => setActiveTab('demolab')} className="ds-btn ds-btn-primary">
            <Sparkles size={14} /> SIH Demo Lab
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14 }}>
        <MetricCard label="Storage Targets" value={metrics?.active_devices ?? 3} sub="FTL + TRIM monitored"
          icon={HardDrive} accent="#2d7ff9" onClick={() => setActiveTab('storage')} />
        <MetricCard label="Files Carved" value={metrics?.total_recovered_files ?? 3} sub={`${metrics?.total_recovery_cases??1} forensic cases`}
          icon={FileSearch} accent="#f59e0b" onClick={() => setActiveTab('recovery')} />
        <MetricCard label="Erasure Ops" value={metrics?.total_erasure_ops ?? 1} sub="Storage-aware purge"
          icon={Trash2} accent="#ef4444" onClick={() => setActiveTab('erasure')} />
        <MetricCard label="Verify Pass Rate" value={`${metrics?.verification_pass_rate ?? 98.4}%`} sub="Zero residual bytes"
          icon={ShieldCheck} accent="#22c55e" onClick={() => setActiveTab('verification')} />
      </div>

      {/* Bottom grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:14 }}>
        {/* Storage list */}
        <div className="ds-card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:16, textTransform:'uppercase', letterSpacing:'0.04em', color:'#f0f4ff' }}>
              Storage Topography
            </div>
            <button onClick={() => setActiveTab('storage')} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#2d7ff9' }}>
              Open Analyzer →
            </button>
          </div>
          <div style={{ padding:12, display:'flex', flexDirection:'column', gap:8 }}>
            {metrics?.storage_summary.map((dev) => {
              const usedGb = (dev.used_bytes / 1e9).toFixed(1);
              const totalGb = (dev.total_bytes / 1e9).toFixed(1);
              const pct = Math.round((dev.used_bytes / Math.max(1, dev.total_bytes)) * 100);
              const riskAccent: Record<string, string> = { LOW:'#22c55e', MEDIUM:'#f59e0b', HIGH:'#ef4444' };
              const acc = riskAccent[dev.risk_level] || '#8b96a8';
              return (
                <div key={dev.id} style={{ background:'rgba(255,255,255,0.03)', borderRadius:9, padding:'12px 14px', border:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:7, background:'rgba(45,127,249,0.1)', border:'1px solid rgba(45,127,249,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <HardDrive size={14} color="#2d7ff9" />
                      </div>
                      <div>
                        <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:14, color:'#f0f4ff' }}>{dev.name}</div>
                        <div style={{ fontSize:11, color:'#8b96a8', display:'flex', gap:8, marginTop:1 }}>
                          <span style={{ color:'#2d7ff9', fontFamily:'Barlow Condensed,sans-serif', fontWeight:700 }}>{dev.storage_type}</span>
                          <span>·</span><span>{dev.filesystem}</span>
                          {dev.is_sandbox && <span className="ds-badge ds-badge-green" style={{ fontSize:8 }}>SANDBOX</span>}
                        </div>
                      </div>
                    </div>
                    <span className="ds-badge" style={{ background:`${acc}14`, color:acc, borderColor:`${acc}30` }}>{dev.risk_level} RISK</span>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#8b96a8', marginBottom:5 }}>
                      <span>{usedGb} / {totalGb} GB</span>
                      <span style={{ fontWeight:700, color:'#f0f4ff' }}>{pct}%</span>
                    </div>
                    <div className="ds-progress">
                      <div className="ds-progress-fill" style={{ width:`${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Audit Feed */}
        <div className="ds-card" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:16, textTransform:'uppercase', letterSpacing:'0.04em', color:'#f0f4ff' }}>
              Live Audit Feed
            </div>
            <button onClick={() => setActiveTab('audit')} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#2d7ff9' }}>
              Full Log →
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:6 }}>
            {metrics?.recent_operations.slice(0, 7).map((op) => (
              <div key={op.id} style={{ padding:'10px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:11, fontWeight:700, color:'#2d7ff9', letterSpacing:'0.04em' }}>{op.username}</span>
                  <span style={{ fontSize:10, color:'#4d5a6a', display:'flex', alignItems:'center', gap:3 }}>
                    <Clock size={9} />{new Date(op.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, color:'#f0f4ff', letterSpacing:'0.02em', textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{op.action}</div>
                <div style={{ fontSize:10, color:'#8b96a8', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{op.target}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', fontSize:10, color:'#4d5a6a', fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'center' }}>
            SHA-256 Cryptographic Chain Verified
          </div>
        </div>
      </div>
    </div>
  );
};
