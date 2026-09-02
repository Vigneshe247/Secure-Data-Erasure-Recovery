import React, { useEffect, useState } from 'react';
import {
  FileSearch, Plus, Play, CheckCircle2, Binary, Sparkles, Hash, Layers, X,
} from 'lucide-react';
import { api } from '../services/api';
import { RecoveryCase, RecoveryCandidate, StorageDevice } from '../types';
import { HexViewer } from '../components/HexViewer';

const S = {
  card: { background:'#111318', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12 } as React.CSSProperties,
  label: { fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' as const, color:'#4d5a6a' },
  heading: { fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, letterSpacing:'0.03em', textTransform:'uppercase' as const, color:'#f0f4ff' },
  input: { width:'100%', background:'#161921', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', color:'#f0f4ff', fontFamily:'Barlow,sans-serif', fontSize:13, outline:'none' } as React.CSSProperties,
  select: { background:'#161921', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'7px 12px', color:'#f0f4ff', fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.04em', outline:'none' } as React.CSSProperties,
  btn: (color: string) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, transition:'all 0.15s', background:`${color}1a`, color, border_:`1px solid ${color}30` } as React.CSSProperties),
};

const badge = (color: string, text: string) => (
  <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', padding:'2px 7px', borderRadius:4, background:`${color}14`, color, border:`1px solid ${color}28` }}>
    {text}
  </span>
);

export const Recovery: React.FC = () => {
  const [cases, setCases]           = useState<RecoveryCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<RecoveryCase | null>(null);
  const [devices, setDevices]       = useState<StorageDevice[]>([]);
  const [scanning, setScanning]     = useState(false);
  const [selectedCand, setSelectedCand] = useState<RecoveryCandidate | null>(null);
  const [recoveringIds, setRecoveringIds] = useState<string[]>([]);
  const [hexCand, setHexCand]       = useState<RecoveryCandidate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle]     = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newNotes, setNewNotes]     = useState('');
  const [scanPct, setScanPct]       = useState(0);
  const [scanSector, setScanSector] = useState(0);
  const [scanHex, setScanHex]       = useState('');

  const load = async () => {
    const [c, d] = await Promise.all([api.getRecoveryCases(), api.getStorageDevices()]);
    setCases(c); setDevices(d);
    if (c.length > 0) setSelectedCase(c[0]);
    if (d.length > 0) setNewDeviceId(d[0].id);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const nc = await api.createRecoveryCase(newTitle, newDeviceId, newNotes); setIsModalOpen(false); setNewTitle(''); await load(); setSelectedCase(nc); }
    catch (err: any) { alert(err.message); }
  };

  const handleScan = async () => {
    if (!selectedCase) return;
    setScanning(true); setScanPct(0);
    const HEX = ['FF D8 FF E0', '89 50 4E 47', '25 50 44 46', '50 4B 03 04'];
    let p = 0;
    const iv = setInterval(() => {
      p += 8; setScanPct(Math.min(p, 100)); setScanSector(p * 128);
      setScanHex(HEX[Math.floor(Math.random() * HEX.length)]);
      if (p >= 100) clearInterval(iv);
    }, 120);
    try {
      await api.scanRecoveryCase(selectedCase.id);
      setTimeout(async () => { setScanning(false); const u = await api.getRecoveryCase(selectedCase.id); setSelectedCase(u); await load(); }, 1200);
    } catch (err: any) { clearInterval(iv); setScanning(false); alert(err.message); }
  };

  const handleRecover = async (id: string) => {
    setRecoveringIds(p => [...p, id]);
    try { await api.recoverCandidates([id]); if (selectedCase) setSelectedCase(await api.getRecoveryCase(selectedCase.id)); }
    catch (err: any) { alert(err.message); }
    finally { setRecoveringIds(p => p.filter(i => i !== id)); }
  };

  const intColor: Record<string, string> = { PASS:'#22c55e', PARTIAL:'#f59e0b', FAIL:'#ef4444', CORRUPT:'#ef4444' };

  return (
    <div className="ds-page" style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Header */}
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', justifyContent:'space-between', gap:12 }}>
        <div>
          <div style={{ ...S.label, color:'#f59e0b', marginBottom:6 }}>Forensic Deleted-File Carving & Integrity Validation</div>
          <h1 style={{ ...S.heading, fontSize:32 }}>Authorized File Recovery</h1>
        </div>
        <button onClick={() => setIsModalOpen(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', background:'linear-gradient(135deg,#2d7ff9,#1a5fd4)', color:'#fff', boxShadow:'0 4px 16px rgba(45,127,249,0.3)' }}>
          <Plus size={14} /> New Forensic Case
        </button>
      </div>

      {/* Case selector bar */}
      <div style={{ ...S.card, padding:'14px 18px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ ...S.label }}>Investigation Case:</span>
          <select value={selectedCase?.id || ''} onChange={(e) => { const c = cases.find(i => i.id===e.target.value); if(c) setSelectedCase(c); }} style={S.select}>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} · {c.title}</option>)}
          </select>
        </div>
        {selectedCase && (
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:12, color:'#8b96a8' }}>Candidates: <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, color:'#f0f4ff' }}>{selectedCase.total_candidates}</span></div>
            <div style={{ fontSize:12, color:'#8b96a8' }}>Recovered: <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, color:'#22c55e' }}>{selectedCase.recovered_count}</span></div>
            <button onClick={handleScan} disabled={scanning} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', background: scanning ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', opacity: scanning ? 0.6 : 1 }}>
              <Play size={11} style={{ fill:'#fff' }} /> {scanning ? 'Carving...' : 'Execute Scan'}
            </button>
          </div>
        )}
      </div>

      {/* Scan progress */}
      {scanning && (
        <div style={{ ...S.card, padding:'14px 18px', borderLeft:'2px solid #f59e0b', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.06em', color:'#fbbf24' }}>
              <span style={{ width:6,height:6,borderRadius:'50%',background:'#f59e0b',boxShadow:'0 0 6px rgba(245,158,11,0.7)', display:'inline-block', animation:'pulse 1s infinite' }} />
              LIVE CARVER · SECTOR #{scanSector}
            </div>
            <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:14, color:'#f0f4ff' }}>{scanPct}%</span>
          </div>
          <div style={{ padding:'8px 12px', borderRadius:7, background:'#0a0c10', fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#22c55e' }}>
            <span style={{ color:'#4d5a6a', fontSize:10 }}>SECTOR BUFFER: </span>{scanHex} <span style={{ color:'#4d5a6a' }}>...</span>
          </div>
          <div style={{ height:4, borderRadius:99, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,#f59e0b,#2d7ff9)', width:`${scanPct}%`, transition:'width 0.15s' }} />
          </div>
        </div>
      )}

      {/* Candidates table */}
      {selectedCase && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Layers size={14} color="#2d7ff9" />
              <span style={{ ...S.heading, fontSize:15 }}>Detected File Candidates</span>
              <span style={{ ...S.label, fontSize:11, color:'#8b96a8' }}>({selectedCase.candidates?.length || 0})</span>
            </div>
            {badge('#00d4c8', 'Magic-Byte Carving')}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  {['Candidate File','Format','Byte Offset','Size','Integrity','Confidence','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:'Barlow Condensed,sans-serif', fontSize:9, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#4d5a6a', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedCase.candidates?.map(cand => {
                  const isRec = recoveringIds.includes(cand.id);
                  const isRecovered = cand.recovery_status === 'RECOVERED';
                  const ic = intColor[cand.integrity_status] || '#8b96a8';
                  return (
                    <tr key={cand.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', transition:'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.025)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
                    >
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <FileSearch size={12} color="#4d5a6a" />
                          <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:13, color:'#f0f4ff' }}>{cand.file_name}</span>
                        </div>
                      </td>
                      <td style={{ padding:'11px 14px' }}>{badge('#2d7ff9', cand.detected_format)}</td>
                      <td style={{ padding:'11px 14px', fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#8b96a8' }}>0x{cand.byte_offset.toString(16).toUpperCase()}</td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:'#8b96a8' }}>{(cand.file_size_bytes/1024).toFixed(1)} KB</td>
                      <td style={{ padding:'11px 14px' }}>{badge(ic, cand.integrity_status)}</td>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:15, color: cand.confidence_score>=80?'#22c55e':'#f59e0b' }}>{cand.confidence_score}%</span>
                          <span style={{ fontSize:10, color:'#4d5a6a' }}>({cand.confidence_level})</span>
                        </div>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <button onClick={() => setHexCand(cand)} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, border:'1px solid rgba(45,127,249,0.25)', background:'rgba(45,127,249,0.07)', color:'#60a5fa', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                            <Binary size={11}/> Hex
                          </button>
                          <button onClick={() => setSelectedCand(cand)} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, border:'1px solid rgba(129,140,248,0.25)', background:'rgba(129,140,248,0.07)', color:'#a5b4fc', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                            <Sparkles size={11}/> AI
                          </button>
                          {isRecovered
                            ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', color:'#4ade80', fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}><CheckCircle2 size={11}/>Done</span>
                            : <button onClick={() => handleRecover(cand.id)} disabled={isRec} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, border:'none', background: isRec?'rgba(255,255,255,0.05)':'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', opacity:isRec?0.5:1 }}>
                                {isRec?'Working...':'Recover'}
                              </button>
                          }
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!selectedCase.candidates || selectedCase.candidates.length === 0) && (
              <div style={{ padding:48, textAlign:'center', color:'#4d5a6a', fontFamily:'Barlow Condensed,sans-serif', fontSize:14, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                Run a recovery scan to detect file candidates
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hex Inspector Modal */}
      {hexCand && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ maxWidth:900, width:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ ...S.heading, fontSize:14 }}>Hex Inspector — {hexCand.file_name}</span>
              <button onClick={() => setHexCand(null)} style={{ ...S.btn('#8b96a8'), padding:'4px 10px' }}><X size={12}/>Close</button>
            </div>
            <HexViewer initialOffset={hexCand.byte_offset} fileName={hexCand.file_name} detectedFormat={hexCand.detected_format}/>
          </div>
        </div>
      )}

      {/* AI Explainability Modal */}
      {selectedCand && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ ...S.card, maxWidth:480, width:'100%', padding:24, borderTop:'2px solid #818cf8' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Sparkles size={15} color="#818cf8"/>
                <span style={{ ...S.heading, fontSize:16 }}>Explainable AI Confidence</span>
              </div>
              <button onClick={() => setSelectedCand(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#4d5a6a', padding:4 }}><X size={16}/></button>
            </div>
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:14, color:'#f0f4ff', marginBottom:14 }}>{selectedCand.file_name}</div>
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:9, padding:'14px 16px', marginBottom:14 }}>
              <div style={{ ...S.label, marginBottom:10 }}>Confidence Determinants</div>
              {[['Signature Match', selectedCand.signature_match_pct], ['Structural Validity', selectedCand.structure_validity_pct], ['Fragment Continuity', selectedCand.continuity_pct], ['Metadata Quality', selectedCand.metadata_quality_pct]].map(([k,v]) => (
                <div key={k as string} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, color:'#8b96a8' }}>{k as string}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:100, height:4, borderRadius:99, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,#2d7ff9,#00d4c8)', width:`${v}%`, transition:'width 0.5s' }} />
                    </div>
                    <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:13, color:'#60a5fa', minWidth:32, textAlign:'right' }}>{v}%</span>
                  </div>
                </div>
              ))}
            </div>
            {selectedCand.ai_explanation && <div style={{ padding:'12px 14px', borderRadius:8, background:'rgba(129,140,248,0.07)', border:'1px solid rgba(129,140,248,0.18)', fontSize:12, color:'#c7d2fe', lineHeight:1.7, marginBottom:12 }}>{selectedCand.ai_explanation}</div>}
            {selectedCand.sha256_hash && (
              <div style={{ padding:'9px 12px', borderRadius:7, background:'rgba(255,255,255,0.03)', display:'flex', gap:7, alignItems:'flex-start' }}>
                <Hash size={11} color="#2d7ff9" style={{ flexShrink:0, marginTop:2 }}/>
                <code style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'#8b96a8', wordBreak:'break-all' }}>SHA-256: {selectedCand.sha256_hash}</code>
              </div>
            )}
            <button onClick={() => setSelectedCand(null)} style={{ marginTop:14, width:'100%', padding:'9px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'#8b96a8', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>Done</button>
          </div>
        </div>
      )}

      {/* New Case Modal */}
      {isModalOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ ...S.card, maxWidth:440, width:'100%', padding:24, borderTop:'2px solid #2d7ff9' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ ...S.heading, fontSize:16 }}>Create Recovery Case</div>
              <button onClick={() => setIsModalOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#4d5a6a' }}><X size={16}/></button>
            </div>
            <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[{ label:'Case Title', val:newTitle, set:setNewTitle, placeholder:'e.g. Incident Triage 2026-A', type:'text' }].map(f => (
                <div key={f.label}>
                  <div style={{ ...S.label, marginBottom:6 }}>{f.label}</div>
                  <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} required placeholder={f.placeholder} style={S.input}/>
                </div>
              ))}
              <div>
                <div style={{ ...S.label, marginBottom:6 }}>Target Storage Device</div>
                <select value={newDeviceId} onChange={e => setNewDeviceId(e.target.value)} style={{ ...S.select, width:'100%' }}>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.storage_type})</option>)}
                </select>
              </div>
              <div>
                <div style={{ ...S.label, marginBottom:6 }}>Case Notes</div>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={3} placeholder="Authorized investigation under SIH26149..." style={{ ...S.input, resize:'none' as const, lineHeight:1.6 }}/>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:4 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding:'8px 16px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#8b96a8', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>Cancel</button>
                <button type="submit" style={{ padding:'8px 16px', borderRadius:7, border:'none', background:'linear-gradient(135deg,#2d7ff9,#1a5fd4)', color:'#fff', cursor:'pointer', fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>Create Case</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
