import React, { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw, Shield, Hash, Sparkles, Trophy } from 'lucide-react';
import { api } from '../services/api';
import { Report } from '../types';

export const Reports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReports();
      setReports(data);
      if (data.length > 0) setSelected(data[0]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.generateReport({ type: 'COMPREHENSIVE', format: 'PDF', include_certificates: true });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const blob = await api.downloadReport(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DataShield_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,126,95,0.25)', borderTopColor: '#FF7E5F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#5E6676', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Loading compliance reports
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ padding: 16, background: '#FEE2E2', color: '#DC2626', borderRadius: 12, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          <strong>Error loading reports:</strong> {error}
        </div>
        <button onClick={load} className="ds-btn ds-btn-primary" style={{ alignSelf: 'flex-start' }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
            Compliance Certification &amp; Audit Documentation
          </div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#1E2229' }}>
            Reports &amp; Certificates
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} className="ds-btn ds-btn-ghost ds-btn-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleGenerate} disabled={generating} className="ds-btn ds-btn-primary ds-btn-sm">
            <Sparkles size={14} /> {generating ? 'Compiling...' : 'Generate New Certificate'}
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="ds-card" style={{ padding: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <FileText size={40} color="#94A3B8" />
          <div style={{ color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15 }}>
            No compliance certificates or audit reports generated yet.
          </div>
          <button onClick={handleGenerate} disabled={generating} className="ds-btn ds-btn-primary" style={{ marginTop: 8 }}>
            <Sparkles size={14} /> {generating ? 'Compiling...' : 'Generate New Certificate'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18 }}>
          {/* Document List */}
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)' }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: '#1E2229', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="#FF7E5F" /> Documents ({reports.length})
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 560 }}>
            {reports.map((r) => {
              const isSel = selected?.id === r.id;
              const statusColor = r.status === 'FINAL' ? '#16A34A' : r.status === 'DRAFT' ? '#D97706' : '#2563EB';
              return (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    padding: '14px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    background: isSel ? 'rgba(255, 126, 95, 0.08)' : 'transparent',
                    borderLeft: isSel ? '4px solid #FF7E5F' : '4px solid transparent',
                    borderBottom: '1px solid var(--c-border)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel) (e.currentTarget as HTMLElement).style.background = '#FAF8F5';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#1E2229', lineHeight: 1.3 }}>
                      {r.title || r.report_type}
                    </span>
                    <span
                      style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 10,
                        background: `${statusColor}14`,
                        color: statusColor,
                        border: `1px solid ${statusColor}30`,
                        flexShrink: 0,
                      }}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(r.generated_at).toLocaleString()}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {r.standards_covered?.slice(0, 2).map((s: string) => (
                      <span key={s} className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7', fontSize: 9 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Document Detail */}
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header Summary Card */}
            <div
              className="ds-card"
              style={{
                padding: '26px 28px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Trophy size={18} color="#FF7E5F" />
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 22, color: '#1E2229' }}>
                      {selected.title || selected.report_type}
                    </span>
                    <span className="ds-badge" style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.22)' }}>
                      {selected.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#5E6676' }}>
                    Generated: {new Date(selected.generated_at).toLocaleString()} · Auditor: <strong style={{ color: '#1E2229' }}>{selected.generated_by}</strong>
                  </p>
                </div>
                <button onClick={() => handleDownload(selected.id)} className="ds-btn ds-btn-primary ds-btn-sm" style={{ flexShrink: 0 }}>
                  <Download size={14} /> Download PDF
                </button>
              </div>

              {selected.sha256_hash && (
                <div style={{ marginTop: 18, padding: '12px 16px', borderRadius: 14, background: '#FAF8F5', border: '1px solid var(--c-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Hash size={14} color="#FF7E5F" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 4 }}>
                      Immutable Cryptographic Anchor
                    </div>
                    <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5E6676', wordBreak: 'break-all', lineHeight: 1.6 }}>
                      {selected.sha256_hash}
                    </code>
                  </div>
                </div>
              )}
            </div>

            {/* Compliance Standards Card */}
            <div className="ds-card" style={{ padding: '20px 24px' }}>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: '#1E2229', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color="#FF7E5F" /> Standards Covered &amp; Certified
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {selected.standards_covered?.map((s: string) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, background: '#E6EFFB', border: '1px solid #D0E0F7' }}>
                    <Shield size={13} color="#2B579A" />
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13, color: '#2B579A' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations Included Table Card */}
            {Boolean(selected.operations_covered && selected.operations_covered.length > 0) && (
              <div className="ds-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--c-border)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: '#1E2229' }}>
                  Operations Included in Certificate
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="ds-table">
                    <thead>
                      <tr>
                        {['Op ID', 'Type', 'Target Device', 'Completed At', 'Result'].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.operations_covered!.map((op: any) => (
                        <tr key={op.id}>
                          <td>
                            <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5E6676' }}>{op.id.slice(-8)}</code>
                          </td>
                          <td>
                            <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7' }}>
                              {op.type}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#1E2229', fontSize: 13 }}>
                            {op.device_name}
                          </td>
                          <td style={{ fontSize: 12, color: '#5E6676' }}>
                            {new Date(op.completed_at).toLocaleString()}
                          </td>
                          <td>
                            <span className="ds-badge" style={{ background: op.result === 'PASS' ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)', color: op.result === 'PASS' ? '#16A34A' : '#DC2626', border: `1px solid ${op.result === 'PASS' ? 'rgba(22,163,74,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
                              {op.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="ds-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 60 }}>
            <FileText size={36} color="#94A3B8" />
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: '#94A3B8' }}>
              Select a Report to View Details
            </span>
          </div>
        )}
        </div>
      )}
    </div>
  );
};
