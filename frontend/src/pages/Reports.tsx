import React, { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw, Shield, Hash, Sparkles, Trophy } from 'lucide-react';
import { api } from '../services/api';
import { Report } from '../types';

export const Reports: React.FC = () => {
  const [reports, setReports]     = useState<Report[]>([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected]   = useState<Report | null>(null);

  const load = async () => {
    setLoading(true);
    try { const data = await api.getReports(); setReports(data); if (data.length > 0) setSelected(data[0]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try { await api.generateReport({ type:'COMPREHENSIVE', format:'PDF', include_certificates:true }); await load(); }
    finally { setGenerating(false); }
  };

  const handleDownload = async (id: string) => {
    try {
      const blob = await api.downloadReport(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=`DataShield_${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch(e:any) { alert(e.message); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:12 }}>
      <div style={{ width:28, height:28, border:'2px solid #2d7ff9', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span style={{ color:'#8b96a8', fontSize:12, fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.12em', textTransform:'uppercase' }}>Loading reports</span>
    </div>
  );

  return (
    <div className="ds-page" style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Header */}
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', justifyContent:'space-between', gap:12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent:'flex-start', marginBottom:6 }}>Compliance Certification & Audit Documentation</div>
          <h1 style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:32, textTransform:'uppercase', letterSpacing:'0.03em', color:'#f0f4ff' }}>
            Reports & Certificates
          </h1>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} className="ds-btn ds-btn-ghost ds-btn-sm"><RefreshCw size={12}/>Refresh</button>
          <button onClick={handleGenerate} disabled={generating} className="ds-btn ds-btn-primary ds-btn-sm">
            <Sparkles size={13}/>{generating?'Compiling...':'Generate Report'}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:14 }}>
        {/* List */}
        <div className="ds-card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:14, textTransform:'uppercase', letterSpacing:'0.04em', color:'#f0f4ff', display:'flex', alignItems:'center', gap:7 }}>
              <FileText size={13} color="#2d7ff9" /> Documents ({reports.length})
            </div>
          </div>
          <div style={{ overflowY:'auto', maxHeight:520 }}>
            {reports.map((r) => {
              const isSel = selected?.id === r.id;
              const statusColor = r.status==='FINAL' ? '#22c55e' : r.status==='DRAFT' ? '#f59e0b' : '#2d7ff9';
              return (
                <div key={r.id} onClick={() => setSelected(r)}
                  style={{ padding:'12px 16px', cursor:'pointer', transition:'background 0.12s', background: isSel ? 'rgba(45,127,249,0.08)' : 'transparent', borderLeft: isSel ? '2px solid #2d7ff9' : '2px solid transparent' }}
                  onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background='transparent'; }}
                >
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:13, fontWeight:700, color:'#f0f4ff', lineHeight:1.3 }}>{r.title||r.report_type}</span>
                    <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.1em', padding:'2px 6px', borderRadius:3, background:`${statusColor}14`, color:statusColor, border:`1px solid ${statusColor}30`, flexShrink:0 }}>
                      {r.status}
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:'#4d5a6a' }}>{new Date(r.generated_at).toLocaleString()}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                    {r.standards_covered?.slice(0,2).map((s:string) => (
                      <span key={s} style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:8, fontWeight:700, letterSpacing:'0.08em', padding:'1px 5px', borderRadius:3, background:'rgba(45,127,249,0.1)', color:'#60a5fa', border:'1px solid rgba(45,127,249,0.2)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        {selected ? (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Summary */}
            <div style={{ padding:'22px 24px', background:'linear-gradient(135deg,#111318,#161921)', border:'1px solid rgba(45,127,249,0.18)', borderRadius:12, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, right:0, width:200, height:'100%', background:'radial-gradient(ellipse at top right, rgba(45,127,249,0.08),transparent 70%)', pointerEvents:'none' }} />
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <Trophy size={16} color="#f59e0b" />
                    <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:20, textTransform:'uppercase', letterSpacing:'0.04em', color:'#f0f4ff' }}>{selected.title||selected.report_type}</span>
                    <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, background:'rgba(34,197,94,0.12)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.25)' }}>{selected.status}</span>
                  </div>
                  <p style={{ fontSize:12, color:'#8b96a8' }}>Generated: {new Date(selected.generated_at).toLocaleString()} · By: {selected.generated_by}</p>
                </div>
                <button onClick={() => handleDownload(selected.id)} className="ds-btn ds-btn-primary ds-btn-sm" style={{ flexShrink:0 }}>
                  <Download size={13}/> PDF
                </button>
              </div>

              {selected.sha256_hash && (
                <div style={{ marginTop:16, padding:'10px 14px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'flex-start', gap:8 }}>
                  <Hash size={12} color="#2d7ff9" style={{ flexShrink:0, marginTop:2 }} />
                  <div>
                    <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#4d5a6a', marginBottom:3 }}>Immutable SHA-256 Anchor</div>
                    <code style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#8b96a8', wordBreak:'break-all', lineHeight:1.6 }}>{selected.sha256_hash}</code>
                  </div>
                </div>
              )}
            </div>

            {/* Standards */}
            <div className="ds-card" style={{ padding:'16px 20px' }}>
              <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:14, textTransform:'uppercase', letterSpacing:'0.04em', color:'#f0f4ff', marginBottom:12, display:'flex', alignItems:'center', gap:7 }}>
                <Shield size={13} color="#2d7ff9" /> Compliance Standards
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {selected.standards_covered?.map((s:string) => (
                  <div key={s} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'rgba(45,127,249,0.07)', border:'1px solid rgba(45,127,249,0.2)' }}>
                    <Shield size={11} color="#2d7ff9" />
                    <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:13, color:'#60a5fa', letterSpacing:'0.04em' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations table */}
            {selected.operations_covered?.length > 0 && (
              <div className="ds-card" style={{ overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:14, textTransform:'uppercase', letterSpacing:'0.04em', color:'#f0f4ff' }}>
                  Operations Included
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table className="ds-table">
                    <thead><tr>
                      {['Op ID','Type','Device','Completed','Result'].map((h) => <th key={h}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {selected.operations_covered.map((op:any) => (
                        <tr key={op.id}>
                          <td><code style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10 }}>{op.id.slice(-8)}</code></td>
                          <td><span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:3, background:'rgba(45,127,249,0.1)', color:'#60a5fa', border:'1px solid rgba(45,127,249,0.2)' }}>{op.type}</span></td>
                          <td style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, color:'#f0f4ff', fontSize:13 }}>{op.device_name}</td>
                          <td>{new Date(op.completed_at).toLocaleString()}</td>
                          <td><span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:3, background: op.result==='PASS'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', color: op.result==='PASS'?'#4ade80':'#f87171', border: op.result==='PASS'?'1px solid rgba(34,197,94,0.25)':'1px solid rgba(239,68,68,0.25)' }}>{op.result}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="ds-card" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, padding:60 }}>
            <FileText size={32} color="#4d5a6a" />
            <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:14, textTransform:'uppercase', letterSpacing:'0.1em', color:'#4d5a6a' }}>Select a Report</span>
          </div>
        )}
      </div>
    </div>
  );
};
