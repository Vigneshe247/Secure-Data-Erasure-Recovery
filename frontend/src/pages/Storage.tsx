import React, { useEffect, useState } from 'react';
import {
  HardDrive, RefreshCw, Sparkles, AlertTriangle, ArrowRight,
  Thermometer, Gauge, Clock, HeartPulse, Zap, Activity,
} from 'lucide-react';
import { api } from '../services/api';
import { StorageDevice, StorageProfile } from '../types';

interface StorageProps {
  setActiveTab: (tab: string) => void;
}

const INITIAL_SMART = [
  { id: 'health', label: 'Health Score', value: 99.4, unit: '%', sub: '0 bad sectors', icon: Gauge, color: '#16A34A' },
  { id: 'temp', label: 'Temperature', value: 32, unit: '°C', sub: 'Optimal range', icon: Thermometer, color: '#16A34A' },
  { id: 'power', label: 'Power-On Hrs', value: 412, unit: 'h', sub: 'Total uptime', icon: Clock, color: '#2563EB' },
  { id: 'wear', label: 'Wear Leveling', value: 0.20, unit: '%', sub: 'FTL used', icon: Zap, color: '#D97706' },
  { id: 'life', label: 'Est. Lifespan', value: 9.8, unit: 'yr', sub: 'TBW 99.8%', icon: HeartPulse, color: '#16A34A' },
];

export const Storage: React.FC<StorageProps> = ({ setActiveTab }) => {
  const [devices, setDevices] = useState<StorageDevice[]>([]);
  const [selected, setSelected] = useState<StorageDevice | null>(null);
  const [profile, setProfile] = useState<StorageProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smartData, setSmartData] = useState(INITIAL_SMART);

  useEffect(() => {
    const interval = setInterval(() => {
      setSmartData((prev) =>
        prev.map((item) => {
          if (item.id === 'temp') {
            const fluctuation = (Math.random() * 2) - 1;
            const newTemp = Math.max(30, Math.min(42, item.value + fluctuation));
            const color = newTemp > 38 ? '#DC2626' : newTemp > 35 ? '#FF7E5F' : '#16A34A';
            return { ...item, value: parseFloat(newTemp.toFixed(1)), color };
          }
          if (item.id === 'wear') {
            const newWear = item.value + (Math.random() * 0.005);
            return { ...item, value: parseFloat(newWear.toFixed(3)) };
          }
          if (item.id === 'health') {
             const fluctuation = (Math.random() * 0.2) - 0.1;
             const newHealth = Math.max(98, Math.min(100, item.value + fluctuation));
             return { ...item, value: parseFloat(newHealth.toFixed(1)) };
          }
          return item;
        })
      );
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStorageDevices();
      setDevices(data);
      if (data.length > 0) {
        setSelected(data[0]);
        runAnalysis(data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAnalysis = async (id: string) => {
    try {
      setProfile(await api.analyzeStorage(id));
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,126,95,0.25)', borderTopColor: '#FF7E5F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#5E6676', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Scanning hardware topology
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ padding: 16, background: '#FEE2E2', color: '#DC2626', borderRadius: 12, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          <strong>Error loading storage devices:</strong> {error}
        </div>
        <button onClick={load} className="ds-btn ds-btn-primary" style={{ alignSelf: 'flex-start' }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          No storage devices detected.
        </div>
        <button onClick={load} className="ds-btn ds-btn-primary">
          <RefreshCw size={14} /> Rescan
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
            Hardware Topography &amp; FTL Profiler
          </div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#1E2229' }}>
            Storage Analyzer
          </h1>
        </div>
        <button onClick={load} className="ds-btn ds-btn-ghost ds-btn-sm">
          <RefreshCw size={13} /> Rescan
        </button>
      </div>

      {/* Device Selector Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {devices.map((dev) => {
          const sel = selected?.id === dev.id;
          return (
            <div
              key={dev.id}
              onClick={() => { setSelected(dev); runAnalysis(dev.id); }}
              className="ds-card ds-card-interactive"
              style={{
                padding: '16px 18px',
                border: sel ? '2px solid #FF7E5F' : '1px solid var(--c-border)',
                boxShadow: sel ? '0 8px 24px rgba(255, 126, 95, 0.18)' : undefined,
                background: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: sel ? 'rgba(255, 126, 95, 0.12)' : '#FAF8F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${sel ? 'rgba(255, 126, 95, 0.3)' : 'var(--c-border)'}`,
                  }}
                >
                  <HardDrive size={18} color={sel ? '#FF7E5F' : '#94A3B8'} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: '#1E2229', lineHeight: 1.2 }}>
                    {dev.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#5E6676', marginTop: 3 }}>
                    {dev.storage_type} · {dev.filesystem}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5E6676', borderTop: '1px solid var(--c-border)', paddingTop: 10 }}>
                <span>Capacity</span>
                <span style={{ fontWeight: 700, color: '#1E2229' }}>{(dev.total_capacity_bytes / 1e9).toFixed(1)} GB</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* S.M.A.R.T. Diagnostics Card */}
      {selected && (
        <div className="ds-card" style={{ padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="#16A34A" /> S.M.A.R.T. Health Diagnostics
            </div>
            <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7' }}>
              Health Grade: A+
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {smartData.map((m) => (
              <div
                key={m.label}
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: '#FAF8F5',
                  border: '1px solid var(--c-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <m.icon size={14} color={m.color} />
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#5E6676' }}>
                    {m.label}
                  </span>
                </div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 24, color: m.color }}>
                  {m.value}{m.unit}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Architecture & AI Recommendation Row */}
      {selected && profile && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18 }}>
          {/* Main Specs Card */}
          <div className="ds-card" style={{ padding: '22px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
                Architecture &amp; FTL Profile — <span style={{ color: '#FF7E5F' }}>{selected.name}</span>
              </div>
              <span
                className="ds-badge"
                style={{
                  background: profile.risk_level === 'LOW' ? 'rgba(22,163,74,0.08)' : 'rgba(217,119,6,0.08)',
                  color: profile.risk_level === 'LOW' ? '#16A34A' : '#D97706',
                  border: `1px solid ${profile.risk_level === 'LOW' ? 'rgba(22,163,74,0.22)' : 'rgba(217,119,6,0.22)'}`,
                }}
              >
                {profile.risk_level} Residual Risk
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                ['Class', profile.storage_type, '#FF7E5F'],
                ['FS', selected.filesystem, '#1E2229'],
                ['TRIM', profile.trim_active ? 'ENABLED' : 'DISABLED', profile.trim_active ? '#16A34A' : '#DC2626'],
                ['FTL Wear', profile.ftl_warning ? 'ENFORCED' : 'N/A', profile.ftl_warning ? '#D97706' : '#5E6676'],
              ].map(([k, v, c]) => (
                <div
                  key={k as string}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#FAF8F5',
                    border: '1px solid var(--c-border)',
                  }}
                >
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 6 }}>
                    {k as string}
                  </div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: c as string }}>
                    {v as string}
                  </div>
                </div>
              ))}
            </div>

            {profile.ftl_warning && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'rgba(217, 119, 6, 0.08)',
                  border: '1px solid rgba(217, 119, 6, 0.22)',
                  marginBottom: 14,
                  display: 'flex',
                  gap: 12,
                }}
              >
                <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13, color: '#B45309', lineHeight: 1.6 }}>
                  Flash wear-leveling prevents standard multi-pass overwrites from reaching hidden over-provisioned NAND blocks. Controller-level cryptographic purge is mandatory.
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: 13,
                color: '#5E6676',
                lineHeight: 1.7,
                padding: '14px 16px',
                borderRadius: 14,
                background: '#FAF8F5',
                border: '1px solid var(--c-border)',
              }}
            >
              {profile.technical_rationale}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setActiveTab('recovery')} className="ds-btn ds-btn-ghost ds-btn-sm">
                Run Recovery Scan <ArrowRight size={13} />
              </button>
              <button onClick={() => setActiveTab('erasure')} className="ds-btn ds-btn-primary ds-btn-sm">
                Configure Secure Erasure <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* AI Advisor Card */}
          <div
            className="ds-card"
            style={{
              padding: '22px 24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--c-border)' }}>
              <Sparkles size={16} color="#FF7E5F" />
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#1E2229' }}>
                AI Advisor
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
              {[
                { label: 'Recommended Protocol', val: profile.recommended_strategy, col: '#FF7E5F' },
                { label: 'Compliance Standard', val: profile.compliance_standard || 'NIST SP 800-88', col: '#16A34A' },
              ].map((r) => (
                <div key={r.label}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 4 }}>
                    {r.label}
                  </div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: r.col }}>
                    {r.val}
                  </div>
                </div>
              ))}
              <div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 6 }}>
                  AI Confidence
                </div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 36, color: '#1E2229', lineHeight: 1 }}>
                  {Math.round(profile.ai_confidence * 100)}%
                </div>
                <div className="ds-progress" style={{ marginTop: 10 }}>
                  <div className="ds-progress-fill" style={{ width: `${Math.round(profile.ai_confidence * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
