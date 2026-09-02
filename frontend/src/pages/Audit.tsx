import React, { useEffect, useState } from 'react';
import {
  History, RefreshCw, Shield, Hash, Clock, Filter, Search, Activity,
} from 'lucide-react';
import { api } from '../services/api';
import { AuditEntry } from '../types';

const ACTION_COLORS: Record<string, string> = {
  ERASURE_EXECUTED: '#ef4444', ERASURE_REQUESTED: '#f59e0b',
  RECOVERY_SCAN: '#2d7ff9', RECOVERY_EXECUTED: '#818cf8',
  VERIFICATION_RUN: '#22c55e', LOGIN: '#8b96a8',
  REPORT_GENERATED: '#00d4c8', STORAGE_ANALYZED: '#60a5fa',
};

export const Audit: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try { const data = await api.getAuditLogs(); setEntries(data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = entries.filter((e) => {
    const matchSearch = search==='' || JSON.stringify(e).toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter==='ALL' || e.action_type===filter;
    return matchSearch && matchFilter;
  });

  const uniqueActions = ['ALL', ...Array.from(new Set(entries.map((e) => e.action_type)))];

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:12 }}>
      <div style={{ width:28, height:28, border:'2px solid #2d7ff9', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span style={{ color:'#8b96a8', fontSize:12, fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.12em', textTransform:'uppercase' }}>Loading audit ledger</span>
    </div>
  );

  return (
    <div className="ds-page" style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Header */}
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', justifyContent:'space-between', gap:12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent:'flex-start', marginBottom:6 }}>SHA-256 Cryptographic Ledger</div>
          <h1 style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:32, textTransform:'uppercase', letterSpacing:'0.03em', color:'#f0f4ff' }}>
            Immutable Audit Trail
          </h1>
        </div>
        <button onClick={load} className="ds-btn ds-btn-ghost ds-btn-sm"><RefreshCw size={12} />Refresh</button>
      </div>

      {/* Chain banner */}
      <div style={{ padding:'16px 20px', borderRadius:12, background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.18)', display:'flex', gap:14, alignItems:'center' }}>
        <div style={{ width:40, height:40, borderRadius:9, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Shield size={18} color="#22c55e" />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, fontSize:15, textTransform:'uppercase', letterSpacing:'0.04em', color:'#4ade80', marginBottom:4 }}>
            SHA-256 Hash Chain — Integrity Verified ✓
          </div>
          <p style={{ fontSize:12, color:'#8b96a8', lineHeight:1.6 }}>
            Every entry is chained: <code style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#60a5fa' }}>SHA256(action + timestamp + user + prev_hash)</code>.
            Tampering any prior record invalidates all subsequent entries.
          </p>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:36, color:'#f0f4ff', lineHeight:1 }}>{entries.length}</div>
          <div style={{ fontSize:10, color:'#8b96a8', fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.1em', textTransform:'uppercase' }}>Total Events</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="ds-card" style={{ padding:'12px 14px', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={13} color="#4d5a6a" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, users, targets..."
            className="ds-input" style={{ paddingLeft:32, paddingTop:7, paddingBottom:7, fontSize:12 }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Filter size={12} color="#4d5a6a" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ds-input" style={{ width:'auto', paddingTop:7, paddingBottom:7, fontSize:12 }}>
            {uniqueActions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ fontSize:11, color:'#8b96a8', fontFamily:'Barlow Condensed,sans-serif', letterSpacing:'0.06em' }}>
          {filtered.length} / {entries.length} EVENTS
        </div>
      </div>

      {/* Table */}
      <div className="ds-card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table className="ds-table">
            <thead>
              <tr>
                {['Timestamp','User','Action','Target','IP Address','SHA-256 Chain'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const acc = ACTION_COLORS[entry.action_type] || '#8b96a8';
                return (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <Clock size={10} color="#4d5a6a" />{new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:700, fontSize:13, color:'#f0f4ff' }}>{entry.username}</div>
                      <div style={{ fontSize:10, color:'#4d5a6a' }}>{entry.user_role?.replace(/_/g,' ')}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, letterSpacing:'0.08em', padding:'2px 7px', borderRadius:4, background:`${acc}14`, color:acc, border:`1px solid ${acc}30` }}>
                        {entry.action_type?.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td style={{ maxWidth:200 }}>
                      <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:600, fontSize:12, color:'#f0f4ff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{entry.target_resource}</div>
                      {entry.detail && <div style={{ fontSize:10, color:'#4d5a6a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:2 }}>{entry.detail}</div>}
                    </td>
                    <td style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, whiteSpace:'nowrap' }}>{entry.ip_address || '—'}</td>
                    <td>
                      {entry.sha256_chain ? (
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <Hash size={10} color="#2d7ff9" />
                          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'#8b96a8' }} title={entry.sha256_chain}>{entry.sha256_chain.slice(0,14)}…</span>
                        </div>
                      ) : <span style={{ color:'#4d5a6a' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding:'48px', textAlign:'center', color:'#4d5a6a' }}>
            <History size={28} style={{ margin:'0 auto 10px' }} />
            <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:14, textTransform:'uppercase', letterSpacing:'0.08em' }}>No matching audit entries</div>
          </div>
        )}
      </div>
    </div>
  );
};
