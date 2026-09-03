import React from 'react';
import {
  ShieldCheck, Sparkles, Play, HardDrive, FileSearch, Trash2,
  CheckCheck, History, ArrowRight, CheckCircle2, Code2,
} from 'lucide-react';

interface DemoLabProps {
  setActiveTab: (tab: string) => void;
}

const PHASES = [
  {
    n: 1,
    phase: 'DETECT',
    title: 'Storage Analysis',
    icon: HardDrive,
    tab: 'storage',
    accent: '#FF7E5F',
    desc: 'Profile SSD/NVMe wear-leveling, TRIM status, filesystem topology, and over-provisioning boundaries.',
    bullets: ['FTL Wear-Leveling Detection', 'TRIM Command Validation', 'S.M.A.R.T. Diagnostics', 'Filesystem Metadata Scan'],
  },
  {
    n: 2,
    phase: 'ANALYZE',
    title: 'Authorized Recovery',
    icon: FileSearch,
    tab: 'recovery',
    accent: '#D97706',
    desc: 'Magic-byte file carving from raw sectors. Fragment reassembly with SHA-256 integrity validation.',
    bullets: ['Magic-Byte Carving 15+ types', 'AI Confidence Scoring', 'SHA-256 Integrity Verify', 'Hex/ASCII Sector Inspector'],
  },
  {
    n: 3,
    phase: 'ERASE',
    title: 'Secure Sanitization',
    icon: Trash2,
    tab: 'erasure',
    accent: '#DC2626',
    desc: '8 industry-standard protocols with 4-step authorization guard. Real-time sector block bitmap.',
    bullets: ['NIST SP 800-88 / DoD', 'Gutmann 35-Pass', '4-Step Safety Guard', 'Block Bitmap Visualizer'],
  },
  {
    n: 4,
    phase: 'VERIFY',
    title: 'Post-Erasure Scan',
    icon: CheckCheck,
    tab: 'verification',
    accent: '#16A34A',
    desc: 'Shannon entropy measurement ≥7.98 bits/byte. Sector sampling, hash chain verification.',
    bullets: ['Shannon Entropy Analysis', 'Sector Sampling', 'Hash Chain Integrity', 'Zero-Residue Proof'],
  },
  {
    n: 5,
    phase: 'REPORT',
    title: 'Compliance Reports',
    icon: History,
    tab: 'reports',
    accent: '#2563EB',
    desc: 'Auto-generate PDF compliance certificates anchored to SHA-256. NIST, DoD, GDPR coverage.',
    bullets: ['SHA-256 Immutable Ledger', 'GDPR / IT Act Coverage', 'PDF Certificate Export', 'Signed Audit Records'],
  },
];

export const DemoLab: React.FC<DemoLabProps> = ({ setActiveTab }) => (
  <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    {/* Hero Card */}
    <div
      className="ds-card"
      style={{
        padding: '36px 42px',
        position: 'relative',
        overflow: 'hidden',
        background: '#FFFFFF',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255, 126, 95, 0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 12 }}>
        SIH 2026 · Problem Statement SIH26149
      </div>
      <h1
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: '-0.02em',
          color: '#1E2229',
          lineHeight: 1.1,
          marginBottom: 14,
        }}
      >
        DataShield <span style={{ color: '#FF7E5F' }}>Interactive</span> Demo Lab
      </h1>
      <p style={{ color: '#5E6676', fontSize: 14, maxWidth: 580, lineHeight: 1.7, marginBottom: 24 }}>
        End-to-end walkthrough of the DataShield lifecycle in fully sandboxed <code style={{ color: '#FF7E5F', fontSize: 12, fontWeight: 700 }}>.img</code> containers. Host disk partitions are completely write-protected.
      </p>

      {/* Pipeline Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {['DETECT', 'ANALYZE', 'RECOVER/ERASE', 'VERIFY', 'REPORT'].map((p, i, arr) => (
          <React.Fragment key={p}>
            <span
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: 14,
                background: '#E6EFFB',
                border: '1px solid #D0E0F7',
                color: '#2B579A',
              }}
            >
              {p}
            </span>
            {i < arr.length - 1 && <ArrowRight size={14} color="#94A3B8" />}
          </React.Fragment>
        ))}
      </div>
    </div>

    {/* Phase Cards Grid */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {PHASES.map((ph) => {
        const Icon = ph.icon;
        return (
          <div
            key={ph.tab}
            onClick={() => setActiveTab(ph.tab)}
            className="ds-card ds-card-interactive"
            style={{ padding: '22px', position: 'relative', overflow: 'hidden' }}
          >
            {/* Top accent line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ph.accent }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: `${ph.accent}14`,
                  border: `1px solid ${ph.accent}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} color={ph.accent} />
              </div>
              <div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8' }}>
                  Phase {ph.n}
                </div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 800, color: ph.accent }}>
                  {ph.phase}
                </div>
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: '#FAF8F5',
                  border: '1px solid var(--c-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#5E6676',
                }}
              >
                {ph.n}
              </div>
            </div>

            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229', marginBottom: 8 }}>
              {ph.title}
            </div>
            <p style={{ fontSize: 12, color: '#5E6676', lineHeight: 1.65, marginBottom: 14 }}>
              {ph.desc}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
              {ph.bullets.map((b) => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5E6676' }}>
                  <CheckCircle2 size={13} color={ph.accent} style={{ flexShrink: 0 }} />
                  {b}
                </div>
              ))}
            </div>

            <button
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                background: `linear-gradient(135deg, ${ph.accent}, ${ph.accent}cc)`,
                color: '#fff',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: `0 4px 14px ${ph.accent}35`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab(ph.tab);
              }}
            >
              <Play size={12} style={{ fill: '#fff' }} /> Launch {ph.phase}
            </button>
          </div>
        );
      })}

      {/* Technical Differentiators Card */}
      <div className="ds-card" style={{ padding: '22px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ShieldCheck size={18} color="#FF7E5F" />
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 15, color: '#1E2229' }}>
            Technical Differentiators
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'FTL-aware algorithm selection per storage class',
            'Magic-byte carving: 15+ file formats',
            'Shannon entropy ≥7.98 post-erase guarantee',
            'SHA-256 cryptographic audit chain',
            '8 international sanitization standards',
            'Firebase RBAC with 5 distinct roles',
            'Explainable AI confidence score per candidate',
            'Real-time sector block bitmap visualizer',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#5E6676' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF7E5F', flexShrink: 0, marginTop: 5 }} />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
