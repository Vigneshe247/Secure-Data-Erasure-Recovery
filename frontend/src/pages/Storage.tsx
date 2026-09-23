import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  HardDrive, RefreshCw, Sparkles, AlertTriangle, ArrowRight,
  Thermometer, Gauge, Clock, HeartPulse, Zap, Activity,
  TrendingUp, TrendingDown, Minus, Wifi, WifiOff,
} from 'lucide-react';
import { api } from '../services/api';
import { StorageDevice, StorageProfile } from '../types';

interface StorageProps {
  setActiveTab: (tab: string) => void;
}

interface SmartReading {
  temperature_c: number;
  power_on_hours: number;
  health_score: number;
  health_grade: string;
  wear_leveling_pct: number;
  est_lifespan_years: number;
  tbw_remaining_pct: number;
  bad_sectors: number;
  total_read_gb: number;
  total_write_gb: number;
  cpu_percent: number;
  ram_percent: number;
  estimated_tbw_tb: number;
  actual_tbw_written_tb: number;
  timestamp: number;
}

type TrendDir = 'up' | 'down' | 'stable';

function getTrend(prev: number | null, curr: number): TrendDir {
  if (prev === null) return 'stable';
  const delta = curr - prev;
  if (Math.abs(delta) < 0.05) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

const TrendIcon: React.FC<{ dir: TrendDir; color?: string }> = ({ dir, color }) => {
  const sz = 12;
  if (dir === 'up') return <TrendingUp size={sz} color={color || '#D97706'} />;
  if (dir === 'down') return <TrendingDown size={sz} color={color || '#16A34A'} />;
  return <Minus size={sz} color="#94A3B8" />;
};

const GRADE_COLOR: Record<string, string> = {
  'A+': '#16A34A', A: '#22C55E', B: '#CA8A04', C: '#EA580C', D: '#DC2626',
};

export const Storage: React.FC<StorageProps> = ({ setActiveTab }) => {
  const [devices, setDevices] = useState<StorageDevice[]>([]);
  const [selected, setSelected] = useState<StorageDevice | null>(null);
  const [profile, setProfile] = useState<StorageProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnectedBanner, setDisconnectedBanner] = useState<string | null>(null);

  // Real-time SMART state
  const [smart, setSmart] = useState<SmartReading | null>(null);
  const [prevSmart, setPrevSmart] = useState<SmartReading | null>(null);
  const [smartLive, setSmartLive] = useState(false);
  const [smartError, setSmartError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const devicePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedRef = useRef<StorageDevice | null>(null);

  // ── Real-time polling ────────────────────────────────────────────────────
  const fetchSmart = useCallback(async () => {
    try {
      const data = await api.getSmartRealtime();
      setSmart((prev) => {
        setPrevSmart(prev);
        return data;
      });
      setSmartLive(true);
      setSmartError(false);
      setLastUpdated(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch {
      setSmartError(true);
      setSmartLive(false);
    }
  }, []);

  useEffect(() => {
    fetchSmart();
    pollRef.current = setInterval(fetchSmart, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSmart]);

  // keep selectedRef in sync so the auto-poll closure can read the latest value
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // ── Device loading ───────────────────────────────────────────────────────
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.getStorageDevices();
      setDevices(data);

      // Hot-plug detection: check if previously selected drive has disappeared
      const currentSelected = selectedRef.current;
      if (currentSelected) {
        const stillExists = data.some((d) => d.id === currentSelected.id);
        if (!stillExists) {
          // Drive was unplugged
          setSelected(data.length > 0 ? data[0] : null);
          setProfile(null);
          setDisconnectedBanner(`"${currentSelected.name}" was disconnected`);
          setTimeout(() => setDisconnectedBanner(null), 5000);
          if (data.length > 0) runAnalysis(data[0].id);
        } else {
          // Still present — update its stats silently
          const updated = data.find((d) => d.id === currentSelected.id);
          if (updated) setSelected(updated);
        }
      } else if (data.length > 0 && !silent) {
        // First load — auto-select first device
        setSelected(data[0]);
        runAnalysis(data[0].id);
      }
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load + auto-rescan every 10 s for hot-plug/unplug detection
  useEffect(() => {
    load();
    devicePollRef.current = setInterval(() => load(true), 10000);
    return () => {
      if (devicePollRef.current) clearInterval(devicePollRef.current);
    };
  }, []);

  const runAnalysis = async (id: string) => {
    try { setProfile(await api.analyzeStorage(id)); } catch {}
  };

  // ── Derived SMART display cards ──────────────────────────────────────────
  const smartCards = smart
    ? [
        {
          id: 'health',
          label: 'Health Score',
          value: smart.health_score.toFixed(1),
          unit: '%',
          sub: `${smart.bad_sectors} bad sectors`,
          icon: Gauge,
          color: smart.health_score >= 90 ? '#16A34A' : smart.health_score >= 70 ? '#D97706' : '#DC2626',
          trend: getTrend(prevSmart?.health_score ?? null, smart.health_score),
          trendInvertGood: true, // down is bad for health
        },
        {
          id: 'temp',
          label: 'Temperature',
          value: smart.temperature_c.toFixed(1),
          unit: '°C',
          sub: smart.temperature_c > 60 ? 'Hot — check cooling' : smart.temperature_c > 50 ? 'Warm range' : 'Optimal range',
          icon: Thermometer,
          color: smart.temperature_c > 60 ? '#DC2626' : smart.temperature_c > 50 ? '#D97706' : '#16A34A',
          trend: getTrend(prevSmart?.temperature_c ?? null, smart.temperature_c),
          trendInvertGood: false, // up in temp = bad
        },
        {
          id: 'power',
          label: 'Uptime Hrs',
          value: smart.power_on_hours.toFixed(1),
          unit: 'h',
          sub: 'Since last boot',
          icon: Clock,
          color: '#2563EB',
          trend: 'stable' as TrendDir,
          trendInvertGood: false,
        },
        {
          id: 'wear',
          label: 'Wear Leveling',
          value: smart.wear_leveling_pct.toFixed(3),
          unit: '%',
          sub: `${smart.actual_tbw_written_tb.toFixed(4)} TB written`,
          icon: Zap,
          color: smart.wear_leveling_pct > 70 ? '#DC2626' : smart.wear_leveling_pct > 30 ? '#D97706' : '#16A34A',
          trend: getTrend(prevSmart?.wear_leveling_pct ?? null, smart.wear_leveling_pct),
          trendInvertGood: false,
        },
        {
          id: 'life',
          label: 'Est. Lifespan',
          value: smart.est_lifespan_years.toFixed(1),
          unit: 'yr',
          sub: `TBW ${smart.tbw_remaining_pct.toFixed(1)}% left`,
          icon: HeartPulse,
          color: smart.est_lifespan_years > 5 ? '#16A34A' : smart.est_lifespan_years > 2 ? '#D97706' : '#DC2626',
          trend: getTrend(prevSmart?.est_lifespan_years ?? null, smart.est_lifespan_years),
          trendInvertGood: true,
        },
      ]
    : null;

  // ── Loading / Error states ───────────────────────────────────────────────
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

  const gradeColor = smart ? (GRADE_COLOR[smart.health_grade] || '#16A34A') : '#16A34A';

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
            Hardware Topography & FTL Profiler
          </div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#1E2229' }}>
            Storage Analyzer
          </h1>
        </div>
        <button onClick={load} className="ds-btn ds-btn-ghost ds-btn-sm">
          <RefreshCw size={13} /> Rescan
        </button>
      </div>
      {/* Drive Disconnected Banner */}
      {disconnectedBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 12,
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid rgba(220, 38, 38, 0.28)',
            color: '#DC2626',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            animation: 'slideDown 0.3s ease',
          }}
        >
          <AlertTriangle size={15} color="#DC2626" style={{ flexShrink: 0 }} />
          {disconnectedBanner} — device list updated automatically.
        </div>
      )}

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
                    width: 38, height: 38, borderRadius: 10,
                    background: sel ? 'rgba(255, 126, 95, 0.12)' : '#FAF8F5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          {/* Card Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={16} color="#16A34A" />
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
                S.M.A.R.T. Health Diagnostics
              </span>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
                {smartLive ? (
                  <>
                    <div
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#16A34A',
                        boxShadow: pulse ? '0 0 0 4px rgba(22,163,74,0.25)' : 'none',
                        transition: 'box-shadow 0.3s ease',
                      }}
                    />
                    <span style={{ fontSize: 10, color: '#16A34A', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Live
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff size={10} color="#DC2626" />
                    <span style={{ fontSize: 10, color: '#DC2626', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>
                      Offline
                    </span>
                  </>
                )}
              </div>
              {lastUpdated && (
                <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  · {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Health grade badge — updates in real time */}
              <span
                className="ds-badge"
                style={{
                  background: `${gradeColor}18`,
                  color: gradeColor,
                  border: `1px solid ${gradeColor}44`,
                  transition: 'all 0.5s ease',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Health Grade: {smart?.health_grade ?? 'A+'}
              </span>

              {/* CPU & RAM live mini-stats */}
              {smart && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#5E6676', background: '#F1F5F9', borderRadius: 8, padding: '3px 8px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>
                    CPU {smart.cpu_percent.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 11, color: '#5E6676', background: '#F1F5F9', borderRadius: 8, padding: '3px 8px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>
                    RAM {smart.ram_percent.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SMART Metric Cards */}
          {smartError && !smart && (
            <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: 12, border: '1px solid #FDE68A', color: '#92400E', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', marginBottom: 12 }}>
              <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Unable to fetch real-time SMART data from the backend. Ensure the backend server is running.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {(smartCards ?? []).map((m) => {
              const trendGoodUp = m.trendInvertGood;
              const isGoodTrend =
                m.trend === 'stable' ||
                (trendGoodUp && m.trend === 'up') ||
                (!trendGoodUp && m.trend === 'down');
              const trendColor = m.trend === 'stable'
                ? '#94A3B8'
                : isGoodTrend ? '#16A34A' : '#D97706';

              return (
                <div
                  key={m.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: '#FAF8F5',
                    border: '1px solid var(--c-border)',
                    transition: 'border-color 0.3s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <m.icon size={14} color={m.color} />
                      <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#5E6676' }}>
                        {m.label}
                      </span>
                    </div>
                    <TrendIcon dir={m.trend} color={trendColor} />
                  </div>
                  <div
                    style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 24, color: m.color,
                      transition: 'color 0.5s ease',
                    }}
                  >
                    {m.value}{m.unit}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{m.sub}</div>
                </div>
              );
            })}

            {/* While loading SMART for the first time, show skeleton cards */}
            {!smartCards && Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{ padding: '14px 16px', borderRadius: 14, background: '#FAF8F5', border: '1px solid var(--c-border)', animation: 'pulse 1.5s ease-in-out infinite' }}
              >
                <div style={{ height: 12, background: '#E2E8F0', borderRadius: 6, marginBottom: 12, width: '60%' }} />
                <div style={{ height: 28, background: '#E2E8F0', borderRadius: 8, marginBottom: 8 }} />
                <div style={{ height: 10, background: '#E2E8F0', borderRadius: 6, width: '40%' }} />
              </div>
            ))}
          </div>

          {/* Real-time I/O throughput bar */}
          {smart && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--c-border)', display: 'flex', gap: 24, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>Read (session)</span>
                  <span style={{ fontSize: 11, color: '#2563EB', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>{smart.total_read_gb.toFixed(1)} GB</span>
                </div>
                <div style={{ height: 4, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#2563EB', borderRadius: 4, width: `${Math.min((smart.total_read_gb / (smart.total_read_gb + smart.total_write_gb + 0.001)) * 100, 100)}%`, transition: 'width 1s ease' }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>Write (session)</span>
                  <span style={{ fontSize: 11, color: '#D97706', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>{smart.total_write_gb.toFixed(1)} GB</span>
                </div>
                <div style={{ height: 4, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#D97706', borderRadius: 4, width: `${Math.min((smart.total_write_gb / (smart.total_read_gb + smart.total_write_gb + 0.001)) * 100, 100)}%`, transition: 'width 1s ease' }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif', whiteSpace: 'nowrap' }}>
                Est. TBW: {smart.estimated_tbw_tb.toFixed(0)} TB rating
              </div>
            </div>
          )}
        </div>
      )}

      {/* Architecture & AI Recommendation Row */}
      {selected && profile && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18 }}>
          {/* Main Specs Card */}
          <div className="ds-card" style={{ padding: '22px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
                Architecture & FTL Profile — <span style={{ color: '#FF7E5F' }}>{selected.name}</span>
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
                  style={{ padding: '12px 14px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}
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
                  padding: '14px 16px', borderRadius: 14,
                  background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.22)',
                  marginBottom: 14, display: 'flex', gap: 12,
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
                fontSize: 13, color: '#5E6676', lineHeight: 1.7,
                padding: '14px 16px', borderRadius: 14,
                background: '#FAF8F5', border: '1px solid var(--c-border)',
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
            style={{ padding: '22px 24px', position: 'relative', overflow: 'hidden' }}
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
