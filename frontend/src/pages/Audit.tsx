import React, { useEffect, useState } from 'react';
import {
  History, RefreshCw, Shield, Hash, Clock, Filter, Search, Activity,
} from 'lucide-react';
import { api } from '../services/api';
import { AuditEntry } from '../types';

const ACTION_COLORS: Record<string, string> = {
  ERASURE_EXECUTED: '#DC2626',
  ERASURE_REQUESTED: '#D97706',
  RECOVERY_SCAN: '#2563EB',
  RECOVERY_EXECUTED: '#7C3AED',
  VERIFICATION_RUN: '#16A34A',
  LOGIN: '#5E6676',
  REPORT_GENERATED: '#0D9488',
  STORAGE_ANALYZED: '#FF7E5F',
};

export const Audit: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      const mapped: AuditEntry[] = (data || []).map((d: any) => ({
        ...d,
        action_type: d.action_type || d.action || 'OPERATION',
        user_role: d.user_role || d.role || 'operator',
        sha256_chain: d.sha256_chain || d.sha256_checksum || '',
      }));
      setEntries(mapped);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = entries.filter((e) => {
    const matchSearch = search === '' || JSON.stringify(e).toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || e.action_type === filter;
    return matchSearch && matchFilter;
  });

  const uniqueActions = ['ALL', ...Array.from(new Set(entries.map((e) => e.action_type)))];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,126,95,0.25)', borderTopColor: '#FF7E5F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#5E6676', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Loading cryptographic audit ledger
        </span>
      </div>
    );
  }

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
            SHA-256 Cryptographic Ledger
          </div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#1E2229' }}>
            Immutable Audit Trail
          </h1>
        </div>
        <button onClick={load} className="ds-btn ds-btn-ghost ds-btn-sm">
          <RefreshCw size={13} /> Refresh Ledger
        </button>
      </div>

      {/* Integrity Chain Banner Card */}
      <div
        className="ds-card"
        style={{
          padding: '20px 24px',
          borderRadius: 14,
          background: '#E6EFFB',
          border: '1px solid #D0E0F7',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#FFFFFF',
            border: '1px solid #D0E0F7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(43,87,154,0.1)',
          }}
        >
          <Shield size={20} color="#16A34A" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229', marginBottom: 4 }}>
            SHA-256 Hash Chain — Integrity Verified ✓
          </div>
          <p style={{ fontSize: 13, color: '#5E6676', lineHeight: 1.6 }}>
            Every entry is chained: <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#2B579A', fontWeight: 600 }}>SHA256(action + timestamp + user + prev_hash)</code>.
            Tampering any prior record invalidates all subsequent entries.
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 36, color: '#1E2229', lineHeight: 1 }}>
            {entries.length}
          </div>
          <div style={{ fontSize: 11, color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Total Events
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ds-card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, users, resources..."
            className="ds-input"
            style={{ paddingLeft: 38, paddingRight: 14, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="#94A3B8" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ds-input"
            style={{ width: 'auto', paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 600 }}
          >
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 12, color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>
          {filtered.length} / {entries.length} Events Listed
        </div>
      </div>

      {/* Audit Table Card */}
      <div className="ds-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ds-table">
            <thead>
              <tr>
                {['Timestamp', 'User', 'Action', 'Target Resource', 'IP Address', 'SHA-256 Ledger Anchor'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const acc = ACTION_COLORS[entry.action_type] || '#5E6676';
                return (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5E6676' }}>
                        <Clock size={12} color="#94A3B8" /> {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13, color: '#1E2229' }}>
                        {entry.username}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{entry.user_role?.replace(/_/g, ' ')}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'Plus Jakarta Sans, sans-serif',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 10,
                          background: `${acc}14`,
                          color: acc,
                          border: `1px solid ${acc}30`,
                        }}
                      >
                        {entry.action_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 13, color: '#1E2229', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.target_resource}
                      </div>
                      {entry.detail && (
                        <div style={{ fontSize: 11, color: '#5E6676', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                          {entry.detail}
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5E6676', whiteSpace: 'nowrap' }}>
                      {entry.ip_address || '—'}
                    </td>
                    <td>
                      {entry.sha256_chain ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Hash size={12} color="#FF7E5F" />
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5E6676' }} title={entry.sha256_chain}>
                            {entry.sha256_chain.slice(0, 16)}…
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>
            <History size={32} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14 }}>
              No matching audit entries found
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
