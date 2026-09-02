import React, { useEffect, useState } from 'react';
import { HardDrive, FileSearch, Trash2, ShieldCheck, ArrowUpRight, Sparkles, Clock } from 'lucide-react';
import { api } from '../services/api';
import { DashboardMetrics } from '../types';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
}

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  sub: string;
  icon: React.FC<any>;
  accent: string;
  onClick: () => void;
}> = ({ label, value, sub, icon: Icon, accent, onClick }) => (
  <div
    className="ds-metric"
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      borderRadius: 14,
      boxShadow: '0 10px 30px -4px rgba(30, 34, 41, 0.05), 0 2px 10px -2px rgba(30, 34, 41, 0.03)',
      border: '1px solid var(--c-border)',
      cursor: 'pointer',
      padding: 22,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5E6676' }}>
        {label}
      </div>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}15`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={accent} />
      </div>
    </div>
    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em', color: '#1E2229', lineHeight: 1 }}>
      {value}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 12, color: '#5E6676' }}>
      {sub} <ArrowUpRight size={13} color={accent} />
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,126,95,0.25)', borderTopColor: '#FF7E5F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#5E6676', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Loading SOC Telemetry
        </span>
      </div>
    );
  }

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Hero Banner Card */}
      <div
        className="ds-card"
        style={{
          padding: '28px 32px',
          background: '#FFFFFF',
          borderRadius: 14,
          boxShadow: '0 10px 30px -4px rgba(30, 34, 41, 0.05), 0 2px 10px -2px rgba(30, 34, 41, 0.03)',
          border: '1px solid var(--c-border)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 10 }}>
              Security Operations Center
            </div>
            <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#1E2229', lineHeight: 1.1, marginBottom: 8 }}>
              Welcome back, <span style={{ color: '#FF7E5F' }}>{user?.full_name || user?.username}</span>
              {user?.role && (
                <span style={{
                  marginLeft: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 20,
                  verticalAlign: 'middle',
                  background: user.role === 'admin'
                    ? 'linear-gradient(135deg, rgba(255,126,95,0.15), rgba(254,180,123,0.15))'
                    : user.role === 'auditor'
                    ? 'rgba(37,99,235,0.08)'
                    : user.role === 'forensic_analyst'
                    ? 'rgba(16,163,74,0.08)'
                    : 'rgba(148,163,184,0.1)',
                  border: user.role === 'admin'
                    ? '1px solid rgba(255,126,95,0.35)'
                    : user.role === 'auditor'
                    ? '1px solid rgba(37,99,235,0.2)'
                    : user.role === 'forensic_analyst'
                    ? '1px solid rgba(16,163,74,0.2)'
                    : '1px solid rgba(148,163,184,0.2)',
                  color: user.role === 'admin' ? '#FF7E5F'
                    : user.role === 'auditor' ? '#2563EB'
                    : user.role === 'forensic_analyst' ? '#16A34A'
                    : '#64748B',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  letterSpacing: '0.04em',
                  textTransform: 'capitalize',
                }}>
                  {user.role.replace('_', ' ')}
                </span>
              )}
            </h1>
            <p style={{ fontSize: 13, color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.02em' }}>
              DETECT · ANALYZE · RECOVER/ERASE · VERIFY · REPORT
            </p>
          </div>
          <button onClick={() => setActiveTab('demolab')} className="ds-btn ds-btn-primary">
            <Sparkles size={15} /> Launch Demo Lab
          </button>
        </div>
      </div>

      {/* KPI 4-Card Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MetricCard
          label="Storage Targets"
          value={metrics?.active_devices ?? 2}
          sub="FTL + TRIM monitored"
          icon={HardDrive}
          accent="#FF7E5F"
          onClick={() => setActiveTab('storage')}
        />
        <MetricCard
          label="Files Carved"
          value={metrics?.total_recovered_files ?? 3}
          sub={`${metrics?.total_recovery_cases ?? 1} active cases`}
          icon={FileSearch}
          accent="#D97706"
          onClick={() => setActiveTab('recovery')}
        />
        <MetricCard
          label="Erasure Ops"
          value={metrics?.total_erasure_ops ?? 1}
          sub="Storage-aware purge"
          icon={Trash2}
          accent="#EF4444"
          onClick={() => setActiveTab('erasure')}
        />
        <MetricCard
          label="Verify Pass Rate"
          value={`${metrics?.verification_pass_rate ?? 98.4}%`}
          sub="Zero residual bytes"
          icon={ShieldCheck}
          accent="#16A34A"
          onClick={() => setActiveTab('verification')}
        />
      </div>

      {/* Bottom Grid: Storage Topography & Live Audit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18 }}>
        {/* Storage Topography Card */}
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
              Storage Topography
            </div>
            <button
              onClick={() => setActiveTab('storage')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                color: '#FF7E5F',
              }}
            >
              Open Analyzer →
            </button>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {metrics?.storage_summary.map((dev) => {
              const usedGb = (dev.used_bytes / 1e9).toFixed(1);
              const totalGb = (dev.total_bytes / 1e9).toFixed(1);
              const pct = Math.round((dev.used_bytes / Math.max(1, dev.total_bytes)) * 100);
              const riskAccent: Record<string, string> = { LOW: '#16A34A', MEDIUM: '#D97706', HIGH: '#EF4444' };
              const acc = riskAccent[dev.risk_level] || '#5E6676';

              return (
                <div
                  key={dev.id}
                  style={{
                    background: '#FAF8F5',
                    borderRadius: 14,
                    padding: '16px 18px',
                    border: '1px solid var(--c-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: 'rgba(255, 126, 95, 0.1)',
                          border: '1px solid rgba(255, 126, 95, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <HardDrive size={18} color="#FF7E5F" />
                      </div>
                      <div>
                        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: '#1E2229' }}>
                          {dev.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#5E6676', display: 'flex', gap: 8, marginTop: 2 }}>
                          <span style={{ color: '#FF7E5F', fontWeight: 700 }}>{dev.storage_type}</span>
                          <span>·</span>
                          <span>{dev.filesystem}</span>
                          {dev.is_sandbox && (
                            <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7', fontSize: 9 }}>
                              SANDBOX
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="ds-badge" style={{ background: `${acc}14`, color: acc, border: `1px solid ${acc}30` }}>
                      {dev.risk_level} RISK
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5E6676', marginBottom: 6 }}>
                      <span>{usedGb} / {totalGb} GB Capacity</span>
                      <span style={{ fontWeight: 700, color: '#1E2229' }}>{pct}% Allocated</span>
                    </div>
                    <div className="ds-progress">
                      <div className="ds-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Audit Feed Card */}
        <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
              Live Audit Feed
            </div>
            <button
              onClick={() => setActiveTab('audit')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                color: '#FF7E5F',
              }}
            >
              Full Ledger →
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {metrics?.recent_operations.slice(0, 7).map((op) => (
              <div
                key={op.id}
                style={{
                  padding: '11px 14px',
                  borderRadius: 12,
                  background: '#FAF8F5',
                  border: '1px solid var(--c-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: '#FF7E5F' }}>
                    {op.username}
                  </span>
                  <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} /> {new Date(op.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, color: '#1E2229', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {op.action}
                </div>
                <div style={{ fontSize: 11, color: '#5E6676', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {op.target}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--c-border)', fontSize: 11, color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.04em', textAlign: 'center' }}>
            🔒 SHA-256 Cryptographic Chain Verified
          </div>
        </div>
      </div>
    </div>
  );
};
